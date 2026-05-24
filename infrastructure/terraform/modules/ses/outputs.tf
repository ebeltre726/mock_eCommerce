output "domain_identity_arn" {
  description = "ARN of the verified SES domain identity — used to scope the Lambda IAM ses:SendEmail permission"
  value       = aws_ses_domain_identity.main.arn
}
