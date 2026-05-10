output "site_url" {
  description = "Primary public URL for the frontend (custom domain)"
  value       = "https://${var.domain_name}"
}

output "cloudfront_url" {
  description = "CloudFront distribution URL (direct, bypasses custom domain)"
  value       = "https://${module.cloudfront.domain_name}"
}

output "route53_name_servers" {
  description = "Set these NS records at your registrar to delegate DNS to Route 53"
  value       = module.route53.name_servers
}

output "api_gateway_endpoint" {
  description = "Direct API Gateway endpoint (used internally by CloudFront)"
  value       = module.api_gateway.endpoint
}

output "ecr_repository_url" {
  description = "ECR URL for pushing backend container images"
  value       = module.lambda.ecr_repository_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID (public — safe to expose to the frontend)"
  value       = module.cognito.client_id
}
