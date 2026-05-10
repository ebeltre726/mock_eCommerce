output "frontend_bucket_id"              { value = aws_s3_bucket.frontend.id }
output "frontend_bucket_arn"             { value = aws_s3_bucket.frontend.arn }
output "frontend_bucket_regional_domain" { value = aws_s3_bucket.frontend.bucket_regional_domain_name }
output "avatars_bucket_arn"              { value = aws_s3_bucket.avatars.arn }
output "avatars_bucket_regional_domain" { value = aws_s3_bucket.avatars.bucket_regional_domain_name }
output "products_bucket_id"               { value = aws_s3_bucket.products.id }
output "products_bucket_arn"              { value = aws_s3_bucket.products.arn }
output "products_bucket_regional_domain"  { value = aws_s3_bucket.products.bucket_regional_domain_name }
