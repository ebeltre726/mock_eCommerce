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

resource "aws_cloudfront_distribution" "main" {
  provider = aws.us_east_1
  enabled  = true
  comment  = "mock-ecommerce"

  default_root_object = "index.html"

  # Origin 1: S3 frontend (private bucket via OAC)
  origin {
    domain_name              = var.frontend_bucket_domain
    origin_id                = "S3Frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: API Gateway
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
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "APIGateway"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled managed policy
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
    compress               = true
  }

  # Default behavior: /* → S3 frontend (cached)
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3Frontend"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
    compress               = true

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
    cloudfront_default_certificate = true
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
