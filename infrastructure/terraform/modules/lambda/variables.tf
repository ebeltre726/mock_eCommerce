variable "ecr_repo_name" {
  type = string
}
variable "image_tag" {
  type = string
}
variable "aws_region" {
  type = string
}
variable "dynamodb_table" {
  type = string
}
variable "s3_bucket_avatars" {
  type = string
}
variable "s3_bucket_products" {
  type = string
}
variable "allowed_origins" {
  type = string
}
variable "stripe_secret_arn" {
  type = string
}
variable "cognito_user_pool_id" {
  type = string
}
variable "cognito_client_id" {
  type = string
}

# SES — transactional email
variable "ses_identity_arn" {
  description = "ARN of the verified SES domain identity — scopes the ses:SendEmail IAM permission"
  type        = string
}
variable "ses_from_address" {
  description = "Verified sender address (e.g. noreply@furnitria.com)"
  type        = string
}
variable "ses_contact_to_address" {
  description = "Address that receives contact form submissions"
  type        = string
}
