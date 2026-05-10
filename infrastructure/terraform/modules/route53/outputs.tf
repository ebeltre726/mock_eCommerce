output "zone_id" {
  description = "Route 53 hosted zone ID — used to create alias records in the root module"
  value       = aws_route53_zone.main.zone_id
}

output "name_servers" {
  description = "Delegate these four NS records at your registrar to activate Route 53 DNS"
  value       = aws_route53_zone.main.name_servers
}

output "certificate_arn" {
  description = "Validated ACM certificate ARN (us-east-1) — pass to CloudFront"
  value       = aws_acm_certificate_validation.main.certificate_arn
}
