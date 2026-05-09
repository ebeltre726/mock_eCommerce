resource "aws_s3_bucket" "frontend" {
  bucket        = var.frontend_bucket
  force_destroy = var.force_destroy_frontend
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  # CloudFront OAC accesses the bucket — keep public access off
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "avatars" {
  bucket        = var.avatars_bucket
  force_destroy = var.force_destroy_data_buckets
}

resource "aws_s3_bucket_public_access_block" "avatars" {
  bucket                  = aws_s3_bucket.avatars.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Explicit SSE-S3 for avatars — AWS applies this by default, but declaring it
# makes the encryption intent visible in Terraform state and plan output.
resource "aws_s3_bucket_server_side_encryption_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "products" {
  bucket        = var.products_bucket
  force_destroy = var.force_destroy_data_buckets
}

# Products bucket: private — access granted only to CloudFront OAC (see cloudfront module)
resource "aws_s3_bucket_public_access_block" "products" {
  bucket                  = aws_s3_bucket.products.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Explicit SSE-S3 for products — AWS applies this by default, but declaring it
# makes the encryption intent visible in Terraform state and plan output.
resource "aws_s3_bucket_server_side_encryption_configuration" "products" {
  bucket = aws_s3_bucket.products.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
