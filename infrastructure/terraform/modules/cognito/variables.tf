variable "aws_region"      { type = string }
variable "dynamodb_table"  { type = string }
variable "ecr_repo_name"   { type = string }
variable "image_tag"       { type = string }

variable "ses_email_arn" {
  description = "SES verified identity ARN to use as the Cognito email sender. When set, Cognito sends via SES (no 50/day limit). Leave empty to use the default Cognito sandbox sender."
  type        = string
  default     = ""
}
