# ─────────────────────────────────────────────────────────────────────────────
# modules/scheduler — EventBridge-triggered background processors
#
# Two Lambda functions share the same ECR image as the API Lambda but use
# different CMD overrides to invoke separate handler entry points:
#
#   order-processor  — advances order status (confirmed→processing→shipped→delivered)
#   return-processor — auto-approves returns and triggers Stripe refunds
#
# Architecture decisions:
#   • Separate functions keep IAM blast radius small and CloudWatch log groups
#     distinct — each processor's behaviour is easy to grep independently.
#   • Both functions reuse the ECR image; no extra build step is required when
#     deploying. image_config.command is the only difference between them.
#   • EventBridge "at-least-once" delivery is safe here because every
#     UpdateCommand in the processors carries a ConditionExpression that acts
#     as an idempotency guard (optimistic lock on the current status value).
# ─────────────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

locals {
  prefix     = "mock-ecommerce-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
}

# ── Shared execution role ─────────────────────────────────────────────────────

resource "aws_iam_role" "processor" {
  name = "${local.prefix}-processor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "processor" {
  name = "processor-policy"
  role = aws_iam_role.processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ── CloudWatch Logs ───────────────────────────────────────────────
      {
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/lambda/${local.prefix}-*:*"
      },
      # ── DynamoDB — table + GSI ────────────────────────────────────────
      # Query on the GSI requires both the table and the index ARN.
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/${var.dynamodb_gsi_name}",
        ]
      },
      # ── SES — transactional status emails ────────────────────────────
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = var.ses_identity_arn
      },
      # ── SSM — read Stripe secret ──────────────────────────────────────
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = var.stripe_ssm_param_arn
      },
      # ── SQS — write failures to dead-letter queues ────────────────────
      # Lambda async invocation config routes unhandled failures here so
      # poison-pill events can be inspected or replayed rather than lost.
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = [
          aws_sqs_queue.order_processor_dlq.arn,
          aws_sqs_queue.return_processor_dlq.arn,
        ]
      },
    ]
  })
}

# ── Dead-Letter Queues ───────────────────────────────────────────────────────
# EventBridge delivers events with at-least-once semantics; Lambda's async
# invocation layer retries failures up to 2 times by default.  We set
# maximum_retry_attempts = 0 on both processors (below) so a handler that
# throws repeatedly doesn't hammer DynamoDB or Stripe.  Failed invocation
# payloads land in these queues for manual inspection / replay.

resource "aws_sqs_queue" "order_processor_dlq" {
  name                      = "${local.prefix}-order-processor-dlq"
  message_retention_seconds = 1209600 # 14 days — gives operators time to inspect
}

resource "aws_sqs_queue" "return_processor_dlq" {
  name                      = "${local.prefix}-return-processor-dlq"
  message_retention_seconds = 1209600
}

# ── CloudWatch log groups (explicit so retention is managed by Terraform) ─────

resource "aws_cloudwatch_log_group" "order_processor" {
  name              = "/aws/lambda/${local.prefix}-order-processor"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "return_processor" {
  name              = "/aws/lambda/${local.prefix}-return-processor"
  retention_in_days = var.log_retention_days
}

# ── Common environment variables for both processors ─────────────────────────

locals {
  processor_env = {
    DYNAMODB_TABLE            = var.dynamodb_table_name
    DYNAMODB_GSI_NAME         = var.dynamodb_gsi_name
    AWS_REGION                = var.aws_region
    SES_FROM_ADDRESS          = var.ses_from_address
    STRIPE_SECRET_SSM         = var.stripe_ssm_param
    ORDER_PROCESSING_DELAY_MS = tostring(var.order_processing_delay_ms)
    ORDER_SHIPPED_DELAY_MS    = tostring(var.order_shipped_delay_ms)
    ORDER_DELIVERED_DELAY_MS  = tostring(var.order_delivered_delay_ms)
    RETURN_APPROVAL_DELAY_MS  = tostring(var.return_approval_delay_ms)
  }
}

# ── Order Processor Lambda ────────────────────────────────────────────────────

resource "aws_lambda_function" "order_processor" {
  function_name = "${local.prefix}-order-processor"
  role          = aws_iam_role.processor.arn
  package_type  = "Image"
  image_uri     = var.image_uri

  # Override the default CMD so the same image serves multiple handlers.
  image_config {
    command = ["src/background/orderProcessor.handler"]
  }

  timeout      = 300 # 5 min — enough to paginate through a backlog
  memory_size  = 256

  environment {
    variables = local.processor_env
  }

  depends_on = [aws_cloudwatch_log_group.order_processor]
}

# Disable Lambda's built-in async retry for the order processor.
# Our ConditionExpression-based idempotency guard is already designed to handle
# at-least-once delivery from EventBridge; an extra Lambda-level retry on top
# creates unnecessary DynamoDB load.  Failures route to the DLQ instead.
resource "aws_lambda_function_event_invoke_config" "order_processor" {
  function_name          = aws_lambda_function.order_processor.function_name
  maximum_retry_attempts = 0

  destination_config {
    on_failure {
      destination = aws_sqs_queue.order_processor_dlq.arn
    }
  }
}

# ── Return Processor Lambda ───────────────────────────────────────────────────

resource "aws_lambda_function" "return_processor" {
  function_name = "${local.prefix}-return-processor"
  role          = aws_iam_role.processor.arn
  package_type  = "Image"
  image_uri     = var.image_uri

  image_config {
    command = ["src/background/returnProcessor.handler"]
  }

  timeout     = 300
  memory_size = 256

  environment {
    variables = local.processor_env
  }

  depends_on = [aws_cloudwatch_log_group.return_processor]
}

resource "aws_lambda_function_event_invoke_config" "return_processor" {
  function_name          = aws_lambda_function.return_processor.function_name
  maximum_retry_attempts = 0

  destination_config {
    on_failure {
      destination = aws_sqs_queue.return_processor_dlq.arn
    }
  }
}

# ── EventBridge Scheduled Rules ───────────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "order_processor" {
  name                = "${local.prefix}-order-processor"
  description         = "Advance order status: confirmed→processing→shipped→delivered"
  schedule_expression = var.order_processor_schedule
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_rule" "return_processor" {
  name                = "${local.prefix}-return-processor"
  description         = "Auto-approve pending returns and trigger Stripe refunds"
  schedule_expression = var.return_processor_schedule
  state               = "ENABLED"
}

# ── EventBridge Targets ───────────────────────────────────────────────────────

resource "aws_cloudwatch_event_target" "order_processor" {
  rule      = aws_cloudwatch_event_rule.order_processor.name
  target_id = "order-processor"
  arn       = aws_lambda_function.order_processor.arn
}

resource "aws_cloudwatch_event_target" "return_processor" {
  rule      = aws_cloudwatch_event_rule.return_processor.name
  target_id = "return-processor"
  arn       = aws_lambda_function.return_processor.arn
}

# ── Lambda Permissions — grant EventBridge the right to invoke ────────────────

resource "aws_lambda_permission" "order_processor" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.order_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.order_processor.arn
}

resource "aws_lambda_permission" "return_processor" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.return_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.return_processor.arn
}
