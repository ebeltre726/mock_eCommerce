variable "frontend_bucket_id"     { type = string }
variable "frontend_bucket_domain"  { type = string }
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
