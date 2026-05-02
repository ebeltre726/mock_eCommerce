variable "aws_region" {
  description = "AWS region for all resources"
  default     = "us-east-1"
}

variable "dynamodb_table" {
  description = "DynamoDB table name"
  default     = "Furnituria"
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
  description = "Docker image tag to deploy (set by CI to the Git SHA)"
  default     = "latest"
}
