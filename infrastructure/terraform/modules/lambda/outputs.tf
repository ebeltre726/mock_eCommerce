output "arn"                { value = aws_lambda_function.backend.arn }
output "invoke_arn"         { value = aws_lambda_function.backend.invoke_arn }
output "ecr_repository_url" { value = aws_ecr_repository.backend.repository_url }
