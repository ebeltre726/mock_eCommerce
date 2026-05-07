data "aws_caller_identity" "current" {}

# ECR repository for backend container images
resource "aws_ecr_repository" "backend" {
  name                 = var.ecr_repo_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep the 10 most recent images; expire everything older.
# IMMUTABLE tags mean every deploy adds a new image — without this the
# registry grows unboundedly at ~$0.10/GB/month.
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# IAM role assumed by the Lambda function
resource "aws_iam_role" "lambda_exec" {
  name = "mock-ecommerce-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "mock-ecommerce-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table}*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_avatars}/*",
          "arn:aws:s3:::${var.s3_bucket_products}/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = [var.stripe_secret_arn]
      },
      {
        # CloudWatch Logs
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_lambda_function" "backend" {
  function_name = "mock-ecommerce-backend"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"

  # 29s matches API Gateway's maximum integration timeout
  timeout      = 29
  memory_size  = 512

  environment {
    variables = {
      NODE_ENV             = "production"
      AWS_REGION_OVERRIDE  = var.aws_region   # avoid conflict with reserved AWS_REGION
      DYNAMODB_TABLE       = var.dynamodb_table
      S3_BUCKET_AVATARS    = var.s3_bucket_avatars
      S3_BUCKET_PRODUCTS   = var.s3_bucket_products
      ALLOWED_ORIGINS      = var.allowed_origins
      # Cognito identifiers are not secrets — safe as plain env vars
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_CLIENT_ID    = var.cognito_client_id
      # Stripe secret loaded at startup from SSM (avoids storing in plaintext env vars)
      STRIPE_SECRET_SSM    = "/mock-ecommerce/prod/STRIPE_SECRET_KEY"
    }
  }

  image_config {
    # Override CMD to use Lambda handler instead of server.js
    command = ["lambda.handler"]
  }
}
