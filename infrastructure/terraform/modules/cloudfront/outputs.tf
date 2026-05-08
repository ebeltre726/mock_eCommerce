output "domain_name"     { value = aws_cloudfront_distribution.main.domain_name }
output "arn"             { value = aws_cloudfront_distribution.main.arn }
# CloudFront's fixed hosted zone ID — required by Route 53 alias records
output "hosted_zone_id"  { value = aws_cloudfront_distribution.main.hosted_zone_id }
