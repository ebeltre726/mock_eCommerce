resource "aws_dynamodb_table" "main" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "entityType"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # Enables O(products) Query instead of full-table Scan for fetchAllProducts
  global_secondary_index {
    name            = "EntityTypeIndex"
    hash_key        = "entityType"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  # DynamoDB encrypts all data at rest by default using an AWS-owned AES-256 key
  # (SSE-DDB). Omitting the server_side_encryption block here accepts that default.
  # To use a customer-managed KMS key instead, uncomment and configure:
  # server_side_encryption {
  #   enabled     = true
  #   kms_key_arn = aws_kms_key.dynamodb.arn
  # }

  tags = {
    Project = "mock-ecommerce"
  }
}
