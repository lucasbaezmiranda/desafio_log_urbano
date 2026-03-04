# ---------- Log Groups ----------
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 14

  tags = { Name = "${var.project_name}-backend-logs" }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}-frontend"
  retention_in_days = 14

  tags = { Name = "${var.project_name}-frontend-logs" }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.project_name}-billing-worker"
  retention_in_days = 14

  tags = { Name = "${var.project_name}-lambda-logs" }
}

# ---------- Alarmas ----------

# DLQ con mensajes = algo falló
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.project_name}-dlq-has-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in DLQ - billing processing failures"

  dimensions = {
    QueueName = aws_sqs_queue.billing_dlq.name
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# ECS backend CPU alta
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project_name}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS backend CPU utilization above 80%"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# RDS conexiones altas
resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.project_name}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 50 # db.t3.micro soporta ~60 conexiones
  alarm_description   = "RDS connections above 80% capacity"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# RDS memoria baja (< 100MB)
resource "aws_cloudwatch_metric_alarm" "rds_low_memory" {
  alarm_name          = "${var.project_name}-rds-low-memory"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 100000000 # 100 MB en bytes
  alarm_description   = "RDS freeable memory below 100MB"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# RDS disco bajo (< 2GB)
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name          = "${var.project_name}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2000000000 # 2 GB en bytes
  alarm_description   = "RDS free storage below 2GB"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# Lambda throttles
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.project_name}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Lambda billing worker is being throttled"

  dimensions = {
    FunctionName = aws_lambda_function.billing_worker.function_name
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# SQS mensajes envejeciendo (> 5 min sin procesar)
resource "aws_cloudwatch_metric_alarm" "sqs_message_age" {
  alarm_name          = "${var.project_name}-sqs-old-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 300 # 5 minutos en segundos
  alarm_description   = "SQS messages waiting longer than 5 minutes"

  dimensions = {
    QueueName = aws_sqs_queue.billing.name
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# ALB errores 5xx
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "ALB receiving more than 10 5xx errors in 5 minutes"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = var.notification_email != "" ? [aws_sns_topic.billing_notifications.arn] : []
}

# ---------- Metric Filters (logs → métricas custom) ----------

resource "aws_cloudwatch_log_metric_filter" "auth_failures" {
  name           = "${var.project_name}-auth-failures"
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "\"Unauthorized\""

  metric_transformation {
    name          = "AuthFailures"
    namespace     = "LogUrbano/Backend"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "billing_processed" {
  name           = "${var.project_name}-billing-processed"
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "\"billing\" \"process\""

  metric_transformation {
    name          = "BillingProcessed"
    namespace     = "LogUrbano/Backend"
    value         = "1"
    default_value = "0"
  }
}

# ---------- Dashboard ----------
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "ECS Backend CPU & Memory"
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.backend.name],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "RDS Connections & CPU"
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "SQS Billing Queue"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.billing.name],
            ["AWS/SQS", "NumberOfMessagesSent", "QueueName", aws_sqs_queue.billing.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.billing_dlq.name],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Billing Worker"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.billing_worker.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.billing_worker.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.billing_worker.function_name],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title   = "ALB Request Count & Latency"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title   = "RDS Storage & Memory"
          metrics = [
            ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title   = "RDS Disk I/O"
          metrics = [
            ["AWS/RDS", "ReadIOPS", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
            ["AWS/RDS", "WriteIOPS", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
            ["AWS/RDS", "DiskQueueDepth", "DBInstanceIdentifier", aws_db_instance.postgres.identifier],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Concurrency & Throttles"
          metrics = [
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", aws_lambda_function.billing_worker.function_name],
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.billing_worker.function_name],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 24
        width  = 12
        height = 6
        properties = {
          title   = "SQS Processing Health"
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.billing.name],
            ["AWS/SQS", "NumberOfMessagesReceived", "QueueName", aws_sqs_queue.billing.name],
            ["AWS/SQS", "NumberOfMessagesDeleted", "QueueName", aws_sqs_queue.billing.name],
          ]
          period = 300
          region = var.aws_region
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 24
        height = 6
        properties = {
          title   = "ALB HTTP Errors"
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.main.arn_suffix],
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
        }
      },
    ]
  })
}
