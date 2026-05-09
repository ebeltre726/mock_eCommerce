variable "ecr_repo_name"        { type = string }
variable "image_tag"            { type = string }
variable "aws_region"           { type = string }
variable "dynamodb_table"       { type = string }
variable "s3_bucket_avatars"    { type = string }
variable "s3_bucket_products"   { type = string }
variable "allowed_origins"      { type = string }
variable "stripe_secret_arn"        { type = string }
variable "emailjs_private_key_arn"  { type = string }
variable "cognito_user_pool_id" { type = string }
variable "cognito_client_id"    { type = string }

# EmailJS non-secret config — safe as plaintext env vars.
# The private key is stored in SSM and loaded at cold start (see lambda.js).
variable "emailjs_service_id"            { type = string; default = "" }
variable "emailjs_public_key"            { type = string; default = "" }
variable "emailjs_template_contact"      { type = string; default = "" }
variable "emailjs_template_subscribed"   { type = string; default = "" }
variable "emailjs_template_unsubscribed" { type = string; default = "" }
