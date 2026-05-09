variable "frontend_bucket"  { type = string }
variable "avatars_bucket"   { type = string }
variable "products_bucket"  { type = string }

# Set to true only for dev/staging where teardown must be frictionless.
# Defaults to false to protect user and product data in production.
variable "force_destroy_data_buckets" {
  type    = bool
  default = false
}

# Gate force_destroy on the frontend bucket separately from data buckets.
# Defaults to false so a plain `terraform destroy` never auto-deletes production assets.
variable "force_destroy_frontend" {
  type    = bool
  default = false
}
