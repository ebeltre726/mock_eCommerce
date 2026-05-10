# Copy these ARNs into GitHub → Settings → Secrets and variables → Actions

output "AWS_ROLE_ARN_ECR" {
  description = "bootstrap-ecr job → GitHub Secret: AWS_ROLE_ARN_ECR"
  value       = aws_iam_role.ecr_bootstrap.arn
}

output "AWS_ROLE_ARN_BUILD" {
  description = "build-backend job → GitHub Secret: AWS_ROLE_ARN_BUILD"
  value       = aws_iam_role.build.arn
}

output "AWS_ROLE_ARN_TF_PLAN" {
  description = "terraform-plan job → GitHub Secret: AWS_ROLE_ARN_TF_PLAN"
  value       = aws_iam_role.tf_plan.arn
}

output "AWS_ROLE_ARN_TF_APPLY" {
  description = "terraform-apply job → GitHub Secret: AWS_ROLE_ARN_TF_APPLY"
  value       = aws_iam_role.tf_apply.arn
}

output "AWS_ROLE_ARN_SEED" {
  description = "seed-products job → GitHub Secret: AWS_ROLE_ARN_SEED"
  value       = aws_iam_role.seed.arn
}

output "AWS_ROLE_ARN_FRONTEND" {
  description = "deploy-frontend job → GitHub Secret: AWS_ROLE_ARN_FRONTEND"
  value       = aws_iam_role.frontend.arn
}
