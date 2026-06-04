terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — create the S3 bucket and DynamoDB table manually once before first apply
  backend "s3" {
    bucket         = "mock-ecommerce-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "mock-ecommerce-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

# us-east-1 provider required for CloudFront ACM certificates
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

module "dynamodb" {
  source     = "./modules/dynamodb"
  table_name = var.dynamodb_table
}

module "s3" {
  source                     = "./modules/s3"
  frontend_bucket            = var.frontend_bucket
  avatars_bucket             = var.s3_bucket_avatars
  products_bucket            = var.s3_bucket_products
  force_destroy_data_buckets = var.force_destroy_data_buckets
  force_destroy_frontend     = var.force_destroy_frontend
}

module "cognito" {
  source         = "./modules/cognito"
  aws_region     = var.aws_region
  dynamodb_table = var.dynamodb_table
  ecr_repo_name  = var.ecr_repo_name
  image_tag      = var.image_tag
  ses_email_arn  = var.ses_email_arn
}

module "ses" {
  source                 = "./modules/ses"
  domain_name            = var.domain_name
  route53_zone_id        = module.route53.zone_id
  ses_contact_to_address = var.ses_contact_to_address
}


module "scheduler" {
  source = "./modules/scheduler"

  environment         = var.environment
  aws_region          = var.aws_region
  # Processors reuse the same ECR image as the API Lambda; the CMD override in
  # image_config selects the correct handler entry point per function.
  image_uri           = "${module.lambda.ecr_repository_url}:${var.image_tag}"
  dynamodb_table_name = module.dynamodb.table_name
  dynamodb_table_arn  = module.dynamodb.table_arn
  ses_from_address    = var.ses_from_address
  ses_identity_arn    = module.ses.domain_identity_arn
  stripe_ssm_param    = var.stripe_ssm_param
  stripe_ssm_param_arn = aws_ssm_parameter.stripe_secret.arn

  # Delay overrides omitted — module variable defaults apply:
  #   order_processing_delay_ms = 1800000   (30 min)
  #   order_shipped_delay_ms    = 7200000   (2 hours)
  #   order_delivered_delay_ms  = 21600000  (6 hours)
  #   return_approval_delay_ms  = 86400000  (24 hours)
}

module "lambda" {
  source               = "./modules/lambda"
  ecr_repo_name        = var.ecr_repo_name
  image_tag            = var.image_tag
  aws_region           = var.aws_region
  dynamodb_table       = var.dynamodb_table
  s3_bucket_avatars    = var.s3_bucket_avatars
  s3_bucket_products   = var.s3_bucket_products
  allowed_origins      = "https://${var.domain_name}"
  stripe_secret_arn    = aws_ssm_parameter.stripe_secret.arn
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  ses_identity_arns    = [module.ses.domain_identity_arn, module.ses.email_identity_arn]
  ses_from_address     = var.ses_from_address
  ses_contact_to_address = var.ses_contact_to_address
}

module "api_gateway" {
  source            = "./modules/api_gateway"
  lambda_invoke_arn = module.lambda.invoke_arn
  lambda_arn        = module.lambda.arn
  # var.domain_name is a root variable with no module dependency, so using it here
  # avoids the cloudfront→api_gateway→cloudfront cycle while still restricting origins.
  allowed_origins   = ["https://${var.domain_name}", "https://www.${var.domain_name}"]
}

module "route53" {
  source      = "./modules/route53"
  providers   = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  domain_name = var.domain_name
}

module "cloudfront" {
  source                 = "./modules/cloudfront"
  providers              = { aws.us_east_1 = aws.us_east_1 }
  frontend_bucket_id     = module.s3.frontend_bucket_id
  frontend_bucket_domain = module.s3.frontend_bucket_regional_domain
  products_bucket_id     = module.s3.products_bucket_id
  products_bucket_domain = module.s3.products_bucket_regional_domain
  avatars_bucket_domain  = module.s3.avatars_bucket_regional_domain
  api_gateway_url        = module.api_gateway.endpoint
  acm_certificate_arn    = module.route53.certificate_arn
  domain_aliases         = [var.domain_name, "www.${var.domain_name}"]
  aws_region             = var.aws_region
  waf_auth_rate_limit    = var.waf_auth_rate_limit
}

# Route 53 alias records — kept in root to avoid a circular dependency between
# the route53 module (cert) and the cloudfront module (distribution domain).
resource "aws_route53_record" "apex_a" {
  zone_id = module.route53.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = module.cloudfront.domain_name
    zone_id                = module.cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  zone_id = module.route53.zone_id
  name    = var.domain_name
  type    = "AAAA"
  alias {
    name                   = module.cloudfront.domain_name
    zone_id                = module.cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_a" {
  zone_id = module.route53.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  alias {
    name                   = module.cloudfront.domain_name
    zone_id                = module.cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_aaaa" {
  zone_id = module.route53.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"
  alias {
    name                   = module.cloudfront.domain_name
    zone_id                = module.cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}

# Stripe secret in SSM (SecureString — set via AWS Console or CLI after first apply)
resource "aws_ssm_parameter" "stripe_secret" {
  name  = "/mock-ecommerce/prod/STRIPE_SECRET_KEY"
  type  = "SecureString"
  value = "REPLACE_ME"   # update via: aws ssm put-parameter --name ... --value <secret> --overwrite

  lifecycle {
    ignore_changes = [value]  # prevents Terraform from overwriting manually set secrets
  }
}

