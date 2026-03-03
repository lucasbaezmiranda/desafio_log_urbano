resource "aws_sns_topic" "billing_notifications" {
  name = "${var.project_name}-billing-notifications"

  tags = { Name = "${var.project_name}-billing-notifications" }
}

# Suscripción email (solo si se configura)
resource "aws_sns_topic_subscription" "email" {
  count     = var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.billing_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}
