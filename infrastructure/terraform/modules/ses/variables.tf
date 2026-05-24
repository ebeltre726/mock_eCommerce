variable "domain_name" {
  description = "Root domain to verify in SES (e.g. furnitria.com)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID — used to create verification and DKIM DNS records"
  type        = string
}

variable "ses_contact_to_address" {
  description = "Email address that receives contact form submissions. Must be verified in SES sandbox."
  type        = string
}
