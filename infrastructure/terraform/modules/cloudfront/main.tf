terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

# Origin Access Control — lets CloudFront read the private S3 frontend bucket
resource "aws_cloudfront_origin_access_control" "frontend" {
  provider                          = aws.us_east_1
  name                              = "mock-ecommerce-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "frontend_oac" {
  provider = aws.us_east_1
  bucket   = var.frontend_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "arn:aws:s3:::${var.frontend_bucket_id}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}

# Origin Access Control — lets CloudFront read the private S3 products bucket
resource "aws_cloudfront_origin_access_control" "products" {
  provider                          = aws.us_east_1
  name                              = "mock-ecommerce-products-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "products_oac" {
  provider = aws.us_east_1
  bucket   = var.products_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "arn:aws:s3:::${var.products_bucket_id}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}

# Security response headers applied to all viewer responses
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  provider = aws.us_east_1
  name     = "mock-ecommerce-security-headers"

  security_headers_config {
    content_security_policy {
      # 'unsafe-inline' on style-src is a known trade-off: the SPA sets inline style=
      # attributes via JS (spinner visibility, overlay positioning). A nonce-based
      # approach would require server-side rendering support.
      # All other directives follow strict least-privilege.
      # cognito-idp.*.amazonaws.com is required by amazon-cognito-identity-js for SRP auth.
      content_security_policy = "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://${var.products_bucket_domain} https://${var.avatars_bucket_domain}; connect-src 'self' https://api.stripe.com https://q.stripe.com https://cognito-idp.*.amazonaws.com; frame-src https://js.stripe.com https://hooks.stripe.com; form-action 'self'; object-src 'none'; base-uri 'self'"
      override = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }
  }
}

locals {
  use_custom_cert    = var.acm_certificate_arn != null
  enable_auth_waf    = var.waf_auth_rate_limit > 0
}

# ─────────────────────────────────────────────
# WAF WebACL — per-IP rate limit on auth paths
# Scope must be CLOUDFRONT and must be in us-east-1.
# ─────────────────────────────────────────────
resource "aws_wafv2_web_acl" "cloudfront" {
  provider    = aws.us_east_1
  name        = "mock-ecommerce-cloudfront"
  description = "Per-IP rate limiting for auth endpoints"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  dynamic "rule" {
    for_each = local.enable_auth_waf ? [1] : []
    content {
      name     = "AuthEndpointRateLimit"
      priority = 1

      action {
        block {}
      }

      statement {
        rate_based_statement {
          limit              = var.waf_auth_rate_limit
          aggregate_key_type = "IP"
          # Only count requests to auth endpoints, not the whole site.
          scope_down_statement {
            byte_match_statement {
              field_to_match { uri_path {} }
              positional_constraint = "STARTS_WITH"
              search_string         = "/api/auth/"
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "AuthEndpointRateLimit"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "MockEcommerceWAF"
    sampled_requests_enabled   = true
  }
}

resource "aws_cloudfront_distribution" "main" {
  provider = aws.us_east_1
  enabled  = true
  comment  = "mock-ecommerce"

  web_acl_id = aws_wafv2_web_acl.cloudfront.arn

  default_root_object = "index.html"
  aliases             = local.use_custom_cert ? var.domain_aliases : []

  # Origin 1: S3 frontend (private bucket via OAC)
  origin {
    domain_name              = var.frontend_bucket_domain
    origin_id                = "S3Frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: S3 products images (private bucket via OAC)
  # Images must be stored under a product-images/ prefix in the bucket.
  # Image URLs stored in DynamoDB should use the CloudFront domain:
  # e.g. https://<distribution>/product-images/<filename>
  origin {
    domain_name              = var.products_bucket_domain
    origin_id                = "S3Products"
    origin_access_control_id = aws_cloudfront_origin_access_control.products.id
  }

  # Origin 3: API Gateway
  origin {
    domain_name = replace(replace(var.api_gateway_url, "https://", ""), "/", "")
    origin_id   = "APIGateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Behavior 1: /api/* → API Gateway (no caching)
  ordered_cache_behavior {
    path_pattern                = "/api/*"
    allowed_methods             = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods              = ["GET", "HEAD"]
    target_origin_id            = "APIGateway"
    viewer_protocol_policy      = "redirect-to-https"
    cache_policy_id             = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled managed policy
    origin_request_policy_id    = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
    response_headers_policy_id  = aws_cloudfront_response_headers_policy.security_headers.id
    compress                    = true
  }

  # Behavior 2: /product-images/* → S3 products bucket (cached, OAC)
  ordered_cache_behavior {
    path_pattern               = "/product-images/*"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Products"
    viewer_protocol_policy     = "redirect-to-https"
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    compress                   = true
  }

  # Default behavior: /* → S3 frontend (cached)
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3Frontend"
    viewer_protocol_policy     = "redirect-to-https"
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    compress                   = true

    # SPA fallback: serve index.html for any 404 so client-side routing works
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.use_custom_cert
    acm_certificate_arn            = local.use_custom_cert ? var.acm_certificate_arn : null
    ssl_support_method             = local.use_custom_cert ? "sni-only" : null
    minimum_protocol_version       = local.use_custom_cert ? "TLSv1.2_2021" : null
  }
}

# Lightweight CloudFront Function for SPA fallback routing
resource "aws_cloudfront_function" "spa_router" {
  provider = aws.us_east_1
  name     = "mock-ecommerce-spa-router"
  runtime  = "cloudfront-js-2.0"
  publish  = true

  code = <<-EOT
    async function handler(event) {
      const request = event.request;
      const uri = request.uri;
      // Serve index.html for paths without a file extension (SPA routes)
      if (!uri.includes('.')) {
        request.uri = '/index.html';
      }
      return request;
    }
  EOT
}
