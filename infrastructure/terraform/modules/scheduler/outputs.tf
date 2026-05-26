output "order_processor_function_name" {
  description = "Lambda function name for the order processor"
  value       = aws_lambda_function.order_processor.function_name
}

output "order_processor_function_arn" {
  description = "Lambda function ARN for the order processor"
  value       = aws_lambda_function.order_processor.arn
}

output "return_processor_function_name" {
  description = "Lambda function name for the return processor"
  value       = aws_lambda_function.return_processor.function_name
}

output "return_processor_function_arn" {
  description = "Lambda function ARN for the return processor"
  value       = aws_lambda_function.return_processor.arn
}

output "processor_role_arn" {
  description = "IAM role ARN shared by both processor Lambdas"
  value       = aws_iam_role.processor.arn
}

output "order_processor_dlq_arn" {
  description = "SQS ARN for the order processor dead-letter queue"
  value       = aws_sqs_queue.order_processor_dlq.arn
}

output "return_processor_dlq_arn" {
  description = "SQS ARN for the return processor dead-letter queue"
  value       = aws_sqs_queue.return_processor_dlq.arn
}
