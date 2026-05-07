terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  # Construct the ECR URI directly rather than importing it from the lambda module.
  # Importing it would create a cycle: cognito → lambda → cognito.
  ecr_image_uri = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.ecr_repo_name}:${var.image_tag}"
}

# ─────────────────────────────────────────────
# User Pool
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool" "main" {
  name = "mock-ecommerce-users"

  # Email is the login identifier — no separate username
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  email_verification_subject = "Verify your Furnituria account"
  email_verification_message = "Your verification code is {####}"

  # Matches the password policy enforced by the old auth.service.js
  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # Required standard attributes — Cognito stores these so the Lambda doesn't
  schema {
    attribute_data_type      = "String"
    name                     = "given_name"
    required                 = true
    mutable                  = true
    string_attribute_constraints { min_length = 1; max_length = 64 }
  }

  schema {
    attribute_data_type      = "String"
    name                     = "family_name"
    required                 = true
    mutable                  = true
    string_attribute_constraints { min_length = 1; max_length = 64 }
  }

  # Optional TOTP MFA — users opt in via account settings
  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration { enabled = true }

  # PostConfirmation fires after a user verifies their email.
  # It creates the DynamoDB profile rows that the rest of the app reads.
  lambda_config {
    post_confirmation = aws_lambda_function.post_confirmation.arn
  }

  # Password-reset path
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # NOTE: Cognito sends verification emails from its own address by default
  # (limit: 50/day). For production, configure an SES identity here:
  #   email_configuration { email_sending_account = "DEVELOPER"; source_arn = <ses_arn> }

  tags = { Project = "mock-ecommerce" }
}

# ─────────────────────────────────────────────
# App Client (public — no secret, SPA-safe)
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "mock-ecommerce-frontend"
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client — SPAs cannot keep a secret
  generate_secret = false

  # USER_PASSWORD_AUTH: our backend proxies email+password on the user's behalf
  # REFRESH_TOKEN_AUTH: silent re-auth without re-login
  # USER_SRP_AUTH: forward-compatible with Amplify client-side auth
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  # ID / access tokens expire in 1 hour; refresh token lasts 30 days
  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30
  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  read_attributes  = ["email", "given_name", "family_name", "email_verified"]
  write_attributes = ["email", "given_name", "family_name"]

  # Prevents "User does not exist" vs "Incorrect password" distinction
  prevent_user_existence_errors = "ENABLED"
}

# ─────────────────────────────────────────────
# PostConfirmation Lambda — creates DynamoDB rows
# ─────────────────────────────────────────────

resource "aws_iam_role" "post_confirmation_exec" {
  name = "mock-ecommerce-post-confirmation-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "post_confirmation_policy" {
  name = "mock-ecommerce-post-confirmation-policy"
  role = aws_iam_role.post_confirmation_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Only needs to write the initial profile rows — no read, no delete
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/${var.dynamodb_table}"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Reuses the same ECR image as the main backend — different CMD entry point
resource "aws_lambda_function" "post_confirmation" {
  function_name = "mock-ecommerce-post-confirmation"
  role          = aws_iam_role.post_confirmation_exec.arn
  package_type  = "Image"
  image_uri     = local.ecr_image_uri
  timeout       = 30
  memory_size   = 256

  environment {
    variables = {
      DYNAMODB_TABLE      = var.dynamodb_table
      AWS_REGION_OVERRIDE = var.aws_region
    }
  }

  image_config {
    command = ["post_confirmation.handler"]
  }
}

# Grants Cognito permission to invoke the trigger Lambda
resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
