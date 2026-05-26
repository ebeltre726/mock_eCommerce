output "table_name" {
  description = "DynamoDB application table name"
  value       = aws_dynamodb_table.main.name
}

output "table_arn" {
  description = "DynamoDB application table ARN"
  value       = aws_dynamodb_table.main.arn
}
