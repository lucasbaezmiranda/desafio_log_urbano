variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "desafio-log-urbano"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "logurbano"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "logurbano"
}

variable "backend_port" {
  description = "Backend container port"
  type        = number
  default     = 3000
}

variable "frontend_port" {
  description = "Frontend container port"
  type        = number
  default     = 80
}

variable "notification_email" {
  description = "Email for SNS billing notifications"
  type        = string
  default     = ""
}
