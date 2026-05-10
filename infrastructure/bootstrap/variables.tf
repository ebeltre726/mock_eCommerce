variable "aws_region" {
  description = "AWS region for all bootstrap resources"
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub username or organization that owns the repository"
  default     = "ebeltre726"
}

variable "github_repo" {
  description = "GitHub repository name"
  default     = "mock_eCommerce"
}

variable "state_bucket" {
  description = "S3 bucket name for the main workspace's Terraform state"
  default     = "mock-ecommerce-tf-state"
}

variable "lock_table" {
  description = "DynamoDB table name for the main workspace's state locking"
  default     = "mock-ecommerce-tf-locks"
}
