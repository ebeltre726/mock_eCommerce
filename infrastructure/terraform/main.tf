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
  source          = "./modules/s3"
  frontend_bucket = var.frontend_bucket
  avatars_bucket  = var.s3_bucket_avatars
  products_bucket = var.s3_bucket_products
}

module "cognito" {
  source         = "./modules/cognito"
  aws_region     = var.aws_region
  dynamodb_table = var.dynamodb_table
  ecr_repo_name  = var.ecr_repo_name
  image_tag      = var.image_tag
}

module "lambda" {
  source              = "./modules/lambda"
  ecr_repo_name       = var.ecr_repo_name
  image_tag           = var.image_tag
  aws_region          = var.aws_region
  dynamodb_table      = var.dynamodb_table
  s3_bucket_avatars   = var.s3_bucket_avatars
  s3_bucket_products  = var.s3_bucket_products
  allowed_origins     = "https://${module.cloudfront.domain_name}"
  stripe_secret_arn   = aws_ssm_parameter.stripe_secret.arn
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id   = module.cognito.client_id
}

module "api_gateway" {
  source            = "./modules/api_gateway"
  lambda_invoke_arn = module.lambda.invoke_arn
  lambda_arn        = module.lambda.arn
  # CloudFront URL can't be used here — it creates a cycle (cloudfront → api_gateway → cloudfront).
  # Express middleware is the real gatekeeper; this only covers direct preflight to API GW.
  allowed_origins   = ["*"]
}

module "cloudfront" {
  source                 = "./modules/cloudfront"
  providers              = { aws.us_east_1 = aws.us_east_1 }
  frontend_bucket_id     = module.s3.frontend_bucket_id
  frontend_bucket_domain = module.s3.frontend_bucket_regional_domain
  api_gateway_url        = module.api_gateway.endpoint
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
