resource "aws_s3_bucket" "frontend" {
  bucket        = var.frontend_bucket
  force_destroy = true
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
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "avatars" {
  bucket                  = aws_s3_bucket.avatars.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "products" {
  bucket        = var.products_bucket
  force_destroy = true
}

# Products bucket: public read for product images served directly
resource "aws_s3_bucket_public_access_block" "products" {
  bucket                  = aws_s3_bucket.products.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "products_public_read" {
  bucket = aws_s3_bucket.products.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.products.arn}/*"
    }]
  })
}
