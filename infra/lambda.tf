# ---------- Lambda Function ----------
data "archive_file" "lambda_worker" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda_worker.zip"
}

resource "aws_lambda_function" "billing_worker" {
  function_name    = "${var.project_name}-billing-worker"
  filename         = data.archive_file.lambda_worker.output_path
  source_code_hash = data.archive_file.lambda_worker.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256
  role             = aws_iam_role.lambda_execution.arn

  environment {
    variables = {
      BACKEND_URL   = "http://${aws_lb.main.dns_name}"
      SNS_TOPIC_ARN = aws_sns_topic.billing_notifications.arn
      AWS_REGION_OVERRIDE = var.aws_region
    }
  }

  tags = { Name = "${var.project_name}-billing-worker" }
}

# ---------- SQS Event Source Mapping ----------
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.billing.arn
  function_name    = aws_lambda_function.billing_worker.arn
  batch_size       = 1
  enabled          = true
}
