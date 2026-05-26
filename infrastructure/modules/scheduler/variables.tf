variable "environment" {
  description = "Deployment environment name (e.g. production, staging)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "image_uri" {
  description = "ECR image URI shared with the main API Lambda (same image, different CMD)"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Application DynamoDB table name"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "Application DynamoDB table ARN (for IAM scoping)"
  type        = string
}

variable "dynamodb_gsi_name" {
  description = "Name of the GSI1PK-createdAt index used by processors"
  type        = string
  default     = "GSI1PK-createdAt-index"
}

variable "ses_from_address" {
  description = "SES verified sender address"
  type        = string
}

variable "ses_identity_arn" {
  description = "ARN of the SES domain/email identity (for IAM scoping)"
  type        = string
}

variable "stripe_ssm_param" {
  description = "SSM Parameter Store path for the Stripe secret key"
  type        = string
}

variable "stripe_ssm_param_arn" {
  description = "ARN of the SSM parameter (for IAM scoping)"
  type        = string
}

# ── Schedule expressions ──────────────────────────────────────────────────────
# Expressed as cron so the wall-clock time is predictable in logs.
# Default: order processor every 5 min, return processor every 10 min.

variable "order_processor_schedule" {
  description = "EventBridge rate/cron expression for the order processor"
  type        = string
  default     = "rate(5 minutes)"
}

variable "return_processor_schedule" {
  description = "EventBridge rate/cron expression for the return processor"
  type        = string
  default     = "rate(10 minutes)"
}

# ── Delay overrides (milliseconds) ───────────────────────────────────────────
# These are passed as Lambda env vars so the demo can run on accelerated
# timers without modifying source code.  Production values mirror the
# defaults baked into the processor source files.

variable "order_processing_delay_ms" {
  description = "Delay before confirmed→processing transition (ms)"
  type        = number
  default     = 1800000 # 30 minutes
}

variable "order_shipped_delay_ms" {
  description = "Delay before processing→shipped transition (ms)"
  type        = number
  default     = 7200000 # 2 hours
}

variable "order_delivered_delay_ms" {
  description = "Delay before shipped→delivered transition (ms)"
  type        = number
  default     = 21600000 # 6 hours
}

variable "return_approval_delay_ms" {
  description = "Delay before Pending→Approved transition (ms)"
  type        = number
  default     = 86400000 # 24 hours
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}
