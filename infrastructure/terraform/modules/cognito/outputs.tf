output "user_pool_id" {
  description = "Cognito User Pool ID — passed to Lambda as COGNITO_USER_POOL_ID"
  value       = aws_cognito_user_pool.main.id
}

output "client_id" {
  description = "Cognito App Client ID — passed to Lambda as COGNITO_CLIENT_ID"
  value       = aws_cognito_user_pool_client.frontend.id
}

output "user_pool_arn" {
  description = "User Pool ARN — used by the Lambda permission resource"
  value       = aws_cognito_user_pool.main.arn
}
