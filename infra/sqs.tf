# ---------- Dead Letter Queue ----------
resource "aws_sqs_queue" "billing_dlq" {
  name                      = "${var.project_name}-billing-dlq"
  message_retention_seconds = 1209600 # 14 días

  tags = { Name = "${var.project_name}-billing-dlq" }
}

# ---------- Cola Principal ----------
resource "aws_sqs_queue" "billing" {
  name                       = "${var.project_name}-billing-queue"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 días
  receive_wait_time_seconds  = 10     # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.billing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${var.project_name}-billing-queue" }
}
