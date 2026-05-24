output "domain_identity_arn" {
  description = "ARN of the verified SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "email_identity_arn" {
  description = "ARN of the verified SES email identity for the contact recipient"
  value       = aws_ses_email_identity.contact_recipient.arn
}
