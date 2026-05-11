variable "aws_region" {
  description = "AWS region for all resources"
  default     = "us-east-1"
}

variable "dynamodb_table" {
  description = "DynamoDB table name"
  default     = "Furnitria"
}

variable "frontend_bucket" {
  description = "S3 bucket for the static frontend"
  default     = "mock-ecommerce-frontend"
}

variable "s3_bucket_avatars" {
  description = "S3 bucket for user avatar uploads"
  default     = "mock-ecommerce-avatars"
}

variable "s3_bucket_products" {
  description = "S3 bucket for product images"
  default     = "mock-ecommerce-products"
}

variable "ecr_repo_name" {
  description = "ECR repository name for the backend container"
  default     = "mock-ecommerce-backend"
}

variable "image_tag" {
  description = "Docker image tag to deploy (set by CI to the Git SHA). No default — must be provided explicitly to prevent accidental :latest deploys."
  type        = string
}

variable "domain_name" {
  description = "Root domain registered in Route 53 (e.g. furnitria.com)"
  default     = "furnitria.com"
}

variable "force_destroy_data_buckets" {
  description = "Allow terraform destroy to delete avatars/products bucket contents. Set true for dev/staging only."
  type        = bool
  default     = false
}

variable "force_destroy_frontend" {
  description = "Allow terraform destroy to delete frontend bucket contents. Set true for dev/staging only."
  type        = bool
  default     = false
}

# ── WAF ───────────────────────────────────────────────────────────────────────
variable "waf_auth_rate_limit" {
  description = "Max requests per IP per 5-minute window to /api/auth/* (WAF CloudFront rule). AWS minimum is 100. Set to 0 to disable."
  type        = number
  default     = 300
}

# ── Cognito Email ─────────────────────────────────────────────────────────────
variable "ses_email_arn" {
  description = "SES verified identity ARN for Cognito email sending (removes the 50/day default limit). Set to a verified SES identity ARN in production; leave empty for dev/staging."
  type        = string
  default     = ""
}

# ── EmailJS ───────────────────────────────────────────────────────────────────
# Non-secret config — safe to commit. Only EMAILJS_PRIVATE_KEY is sensitive
# and is stored in SSM, written by the deploy workflow after apply.
variable "emailjs_service_id" {
  type = string
}
variable "emailjs_public_key" {
  type = string
}
variable "emailjs_template_contact" {
  type = string
}
variable "emailjs_template_subscribed" {
  type = string
}
variable "emailjs_template_unsubscribed" {
  type = string
}