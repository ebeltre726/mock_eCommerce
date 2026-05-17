variable "frontend_bucket_id"     { type = string }
variable "frontend_bucket_domain"  { type = string }
variable "products_bucket_id"      { type = string }
variable "products_bucket_domain"  { type = string }
variable "avatars_bucket_domain"   { type = string }
variable "api_gateway_url"         { type = string }

variable "acm_certificate_arn" {
  description = "Validated ACM certificate ARN (us-east-1). Enables custom domain + HTTPS."
  type        = string
  default     = null
}

variable "domain_aliases" {
  description = "Custom domain names served by this distribution (e.g. furnitria.com, www.furnitria.com)"
  type        = list(string)
  default     = []
}

variable "aws_region" {
  description = "AWS region for region-specific CSP directives (e.g. Cognito endpoint)."
  type        = string
  default     = "us-east-1"
}

variable "waf_auth_rate_limit" {
  description = "Maximum requests per IP per 5-minute window to /api/auth/* before WAF blocks. AWS minimum is 100. Set to 0 to disable the auth rate-limiting rule."
  type        = number
  default     = 300
}
