output "cloudfront_url" {
  description = "Public URL for the frontend + API (set VITE_API_URL to this + /api)"
  value       = "https://${module.cloudfront.domain_name}"
}

output "api_gateway_endpoint" {
  description = "Direct API Gateway endpoint (used internally by CloudFront)"
  value       = module.api_gateway.endpoint
}

output "ecr_repository_url" {
  description = "ECR URL for pushing backend container images"
  value       = module.lambda.ecr_repository_url
}
