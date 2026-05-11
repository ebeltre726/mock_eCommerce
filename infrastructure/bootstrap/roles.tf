locals {
  account_id = data.aws_caller_identity.current.account_id

  # Sub claim for jobs triggered by a push to main (no environment)
  sub_main = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"

  # Sub claim for jobs running inside the 'production' GitHub environment
  sub_production = "repo:${var.github_org}/${var.github_repo}:environment:production"

  oidc_arn = aws_iam_openid_connect_provider.github.arn

  # Reusable trust policy builder — returns a policy document as a map
  # so it can be jsonencode'd inline in each role resource.
  trust = {
    main = {
      Version = "2012-10-17"
      Statement = [{
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = local.sub_main
          }
        }
      }]
    }

    production = {
      Version = "2012-10-17"
      Statement = [{
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = local.sub_production
          }
        }
      }]
    }
  }
}

# ─────────────────────────────────────────────
# 1. ECR Bootstrap
# Checks for and creates the ECR repository before the build job runs.
# ─────────────────────────────────────────────

resource "aws_iam_role" "ecr_bootstrap" {
  name               = "mock-ecommerce-gha-ecr-bootstrap"
  assume_role_policy = jsonencode(local.trust.main)
}

resource "aws_iam_role_policy" "ecr_bootstrap" {
  role = aws_iam_role.ecr_bootstrap.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ecr:DescribeRepositories",
        "ecr:CreateRepository",
        "ecr:PutLifecyclePolicy",
        "ecr:PutImageTagMutability",
        "ecr:PutImageScanningConfiguration",
      ]
      Resource = "arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/mock-ecommerce-backend"
    }]
  })
}

# ─────────────────────────────────────────────
# 2. Build
# Authenticates to ECR, builds the Docker image, and pushes it.
# ─────────────────────────────────────────────

resource "aws_iam_role" "build" {
  name               = "mock-ecommerce-gha-build"
  assume_role_policy = jsonencode(local.trust.main)
}

resource "aws_iam_role_policy" "build" {
  role = aws_iam_role.build.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # GetAuthorizationToken is account-scoped — cannot be narrowed to a repo ARN
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/mock-ecommerce-backend"
      },
    ]
  })
}

# ─────────────────────────────────────────────
# 3. Terraform Plan
# Reads state, acquires a lock, and calls read-only AWS APIs to compute the diff.
# ─────────────────────────────────────────────

resource "aws_iam_role" "tf_plan" {
  name               = "mock-ecommerce-gha-tf-plan"
  assume_role_policy = jsonencode(local.trust.main)
}

# ReadOnlyAccess covers all the resource-read API calls Terraform makes during plan.
resource "aws_iam_role_policy_attachment" "tf_plan_readonly" {
  role       = aws_iam_role.tf_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Plan also needs to lock and read the remote state.
resource "aws_iam_role_policy" "tf_plan_state" {
  name = "state-access"
  role = aws_iam_role.tf_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetEncryptionConfiguration",
        ]
        Resource = [
          "arn:aws:s3:::${var.state_bucket}",
          "arn:aws:s3:::${var.state_bucket}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.lock_table}"
      },
    ]
  })
}

# ─────────────────────────────────────────────
# 4. Terraform Apply
# Creates, updates, and destroys all resources in the main workspace.
# Scoped to the 'production' GitHub environment so the approval gate applies.
# ─────────────────────────────────────────────

resource "aws_iam_role" "tf_apply" {
  name                 = "mock-ecommerce-gha-tf-apply"
  assume_role_policy   = jsonencode(local.trust.production)
  max_session_duration = 7200
}

resource "aws_iam_role_policy" "tf_apply" {
  role = aws_iam_role.tf_apply.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ── State bucket ──────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
          "s3:ListBucket", "s3:GetBucketLocation", "s3:GetEncryptionConfiguration",
        ]
        Resource = [
          "arn:aws:s3:::${var.state_bucket}",
          "arn:aws:s3:::${var.state_bucket}/*",
        ]
      },
      # ── State lock table ──────────────────────────────────────────
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.lock_table}"
      },
      # ── DynamoDB — application table ──────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable", "dynamodb:DeleteTable", "dynamodb:DescribeTable",
          "dynamodb:UpdateTable", "dynamodb:ListTagsOfResource", "dynamodb:TagResource",
          "dynamodb:UntagResource", "dynamodb:DescribeTimeToLive",
          "dynamodb:DescribeContinuousBackups", "dynamodb:UpdateContinuousBackups",
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/Furnitria*"
      },
      # ── S3 — application buckets (bucket-level operations) ────────
      {
        Effect = "Allow"
        Action = [
          "s3:CreateBucket", "s3:DeleteBucket", "s3:GetBucketLocation",
          "s3:GetBucketTagging", "s3:PutBucketTagging", "s3:ListBucket",
          "s3:GetBucketVersioning", "s3:PutBucketVersioning",
          "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration",
          "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock",
          "s3:GetBucketPolicy", "s3:PutBucketPolicy", "s3:DeleteBucketPolicy",
          "s3:GetBucketCORS", "s3:PutBucketCORS",
          "s3:GetBucketWebsite", "s3:GetLifecycleConfiguration",
          "s3:GetBucketObjectLockConfiguration", "s3:GetBucketRequestPayment",
          "s3:GetBucketLogging", "s3:GetBucketAcl", "s3:GetAccelerateConfiguration",
          "s3:GetReplicationConfiguration",
        ]
        Resource = [
          "arn:aws:s3:::mock-ecommerce-frontend",
          "arn:aws:s3:::mock-ecommerce-avatars",
          "arn:aws:s3:::mock-ecommerce-products",
        ]
      },
      # ── ECR ───────────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "ecr:CreateRepository", "ecr:DeleteRepository", "ecr:DescribeRepositories",
          "ecr:GetRepositoryPolicy", "ecr:SetRepositoryPolicy", "ecr:DeleteRepositoryPolicy",
          "ecr:PutLifecyclePolicy", "ecr:GetLifecyclePolicy", "ecr:DeleteLifecyclePolicy",
          "ecr:PutImageTagMutability", "ecr:PutImageScanningConfiguration",
          "ecr:ListTagsForResource", "ecr:TagResource", "ecr:UntagResource",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/mock-ecommerce-backend"
      },
      # ── Lambda ───────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction", "lambda:DeleteFunction", "lambda:GetFunction",
          "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
          "lambda:AddPermission", "lambda:RemovePermission", "lambda:GetPolicy",
          "lambda:ListVersionsByFunction", "lambda:PublishVersion",
          "lambda:ListTags", "lambda:TagResource", "lambda:UntagResource",
          "lambda:GetFunctionCodeSigningConfig",
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${local.account_id}:function:mock-ecommerce-*"
      },
      # ── IAM — scoped to mock-ecommerce- prefixed roles ────────────
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
          "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
          "iam:ListRolePolicies", "iam:AttachRolePolicy", "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies", "iam:PassRole",
          "iam:TagRole", "iam:UntagRole", "iam:ListInstanceProfilesForRole",
        ]
        Resource = "arn:aws:iam::${local.account_id}:role/mock-ecommerce-*"
      },
      # ── SSM — application parameter path ─────────────────────────
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter", "ssm:GetParameters", "ssm:PutParameter", "ssm:DeleteParameter",
          "ssm:AddTagsToResource", "ssm:ListTagsForResource",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/mock-ecommerce/*"
      },
      {
        # DescribeParameters is not resource-scoped in IAM
        Effect   = "Allow"
        Action   = ["ssm:DescribeParameters"]
        Resource = "*"
      },
      # ── API Gateway v2 ───────────────────────────────────────────
      {
        Effect   = "Allow"
        Action   = ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE", "apigateway:TagResource", "apigateway:UntagResource"]
        Resource = "arn:aws:apigateway:${var.aws_region}::/*"
      },
      # ── CloudFront ───────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateDistribution", "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution", "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:CreateOriginAccessControl", "cloudfront:UpdateOriginAccessControl",
          "cloudfront:DeleteOriginAccessControl", "cloudfront:GetOriginAccessControl",
          "cloudfront:ListOriginAccessControls",
          "cloudfront:CreateResponseHeadersPolicy", "cloudfront:UpdateResponseHeadersPolicy",
          "cloudfront:DeleteResponseHeadersPolicy", "cloudfront:GetResponseHeadersPolicy",
          "cloudfront:CreateFunction", "cloudfront:UpdateFunction",
          "cloudfront:DeleteFunction", "cloudfront:GetFunction", "cloudfront:PublishFunction",
          "cloudfront:DescribeFunction",
          "cloudfront:CreateInvalidation",
          "cloudfront:ListTagsForResource", "cloudfront:TagResource", "cloudfront:UntagResource",
        ]
        Resource = "*"
      },
      # ── WAFv2 ────────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "wafv2:CreateWebACL", "wafv2:UpdateWebACL", "wafv2:DeleteWebACL",
          "wafv2:GetWebACL", "wafv2:ListWebACLs",
          "wafv2:AssociateWebACL", "wafv2:DisassociateWebACL", "wafv2:GetWebACLForResource",
          "wafv2:ListTagsForResource", "wafv2:TagResource", "wafv2:UntagResource",
          "wafv2:CheckCapacity",
        ]
        Resource = "*"
      },
      # ── Route 53 ─────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "route53:CreateHostedZone", "route53:DeleteHostedZone",
          "route53:GetHostedZone", "route53:ListHostedZones", "route53:ListHostedZonesByName",
          "route53:ChangeResourceRecordSets", "route53:GetChange",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResource", "route53:ChangeTagsForResource",
        ]
        Resource = "*"
      },
      # ── ACM ──────────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "acm:RequestCertificate", "acm:DeleteCertificate",
          "acm:DescribeCertificate", "acm:ListCertificates",
          "acm:AddTagsToCertificate", "acm:ListTagsForCertificate",
        ]
        Resource = "*"
      },
      # ── Cognito ──────────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:CreateUserPool", "cognito-idp:DeleteUserPool",
          "cognito-idp:DescribeUserPool", "cognito-idp:UpdateUserPool",
          "cognito-idp:SetUserPoolMfaConfig", "cognito-idp:GetUserPoolMfaConfig",
          "cognito-idp:CreateUserPoolClient", "cognito-idp:DeleteUserPoolClient",
          "cognito-idp:DescribeUserPoolClient", "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:ListUserPoolClients",
          "cognito-idp:ListTagsForResource", "cognito-idp:TagResource", "cognito-idp:UntagResource",
        ]
        Resource = "*"
      },
      # ── CloudWatch Logs ──────────────────────────────────────────
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup", "logs:DeleteLogGroup", "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy", "logs:DeleteRetentionPolicy",
          "logs:ListTagsLogGroup", "logs:TagLogGroup", "logs:UntagLogGroup",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/mock-ecommerce-*"
      },
      # ── STS — needed for data.aws_caller_identity in modules ─────
      {
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      },
    ]
  })
}

# ─────────────────────────────────────────────
# 5. Seed
# Runs seed-products.js after terraform-apply to populate DynamoDB and S3.
# ─────────────────────────────────────────────

resource "aws_iam_role" "seed" {
  name               = "mock-ecommerce-gha-seed"
  assume_role_policy = jsonencode(local.trust.main)
}

resource "aws_iam_role_policy" "seed" {
  role = aws_iam_role.seed.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:DescribeTable",
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/Furnitria"
      },
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:HeadObject"]
        Resource = "arn:aws:s3:::mock-ecommerce-products/*"
      },
    ]
  })
}

# ─────────────────────────────────────────────
# 6. Frontend
# Syncs the built Vite bundle to S3 and invalidates the CloudFront cache.
# ─────────────────────────────────────────────

resource "aws_iam_role" "frontend" {
  name               = "mock-ecommerce-gha-frontend"
  assume_role_policy = jsonencode(local.trust.main)
}

resource "aws_iam_role_policy" "frontend" {
  role = aws_iam_role.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"]
        Resource = "arn:aws:s3:::mock-ecommerce-frontend/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::mock-ecommerce-frontend"
      },
      {
        # Scoped to all distributions in the account — the specific distribution ID
        # isn't known at bootstrap time. Tighten this after the first apply if desired.
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::${local.account_id}:distribution/*"
      },
    ]
  })
}
