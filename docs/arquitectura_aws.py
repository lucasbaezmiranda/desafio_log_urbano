"""
Genera el diagrama de arquitectura AWS del proyecto Log Urbano.
Ejecutar: python3 docs/arquitectura_aws.py
Genera: docs/arquitectura_aws.png
"""
from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Lambda, Fargate
from diagrams.aws.database import RDS
from diagrams.aws.network import ALB, Route53
from diagrams.aws.integration import SQS, SNS
from diagrams.aws.management import Cloudwatch
from diagrams.aws.devtools import Codebuild
from diagrams.aws.compute import ECR
from diagrams.onprem.client import Users
from diagrams.onprem.iac import Terraform
from diagrams.onprem.monitoring import Grafana

graph_attr = {
    "fontsize": "14",
    "bgcolor": "white",
    "pad": "0.5",
    "splines": "spline",
}

with Diagram(
    "Log Urbano - Arquitectura AWS",
    filename="docs/arquitectura_aws",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
):
    users = Users("Usuario")
    terraform = Terraform("Terraform\n(infra/)")

    with Cluster("AWS Cloud (us-east-1)"):

        alb = ALB("ALB\n(HTTP :80)")

        with Cluster("ECS Fargate Cluster"):
            frontend = ECS("Frontend\n(Nginx/React)")
            backend = ECS("Backend\n(NestJS)")

        with Cluster("Container Registry"):
            ecr_back = ECR("ECR Backend")
            ecr_front = ECR("ECR Frontend")

        with Cluster("Base de Datos"):
            rds = RDS("RDS PostgreSQL 16\n(db.t3.micro)")

        with Cluster("Mensajería Async"):
            sqs = SQS("SQS\nBilling Queue")
            dlq = SQS("DLQ\n(3 reintentos)")
            sns = SNS("SNS\nNotificaciones")

        worker = Lambda("Lambda Worker\n(billing)")

        with Cluster("Observabilidad"):
            cw = Cloudwatch("CloudWatch\nLogs + Alarmas\n+ Dashboard")
            grafana = Grafana("Grafana\n(dashboards)")

    # Flujo principal
    users >> Edge(label="HTTP") >> alb
    alb >> Edge(label="/*") >> frontend
    alb >> Edge(label="/api/*") >> backend

    # Backend connections
    backend >> Edge(label="SQL/SSL") >> rds
    backend >> Edge(label="SendMessage") >> sqs
    backend >> Edge(label="Publish", style="dashed") >> sns

    # SQS -> Lambda -> Backend
    sqs >> Edge(label="trigger") >> worker
    worker >> Edge(label="POST /api/billing/\nprocess-sync") >> alb
    worker >> Edge(label="notify", style="dashed") >> sns
    sqs >> Edge(label="maxReceive=3", style="dotted", color="red") >> dlq

    # ECR pulls
    ecr_back >> Edge(style="dotted", label="image pull") >> backend
    ecr_front >> Edge(style="dotted", label="image pull") >> frontend

    # Observability
    backend >> Edge(style="dashed", color="gray") >> cw
    frontend >> Edge(style="dashed", color="gray") >> cw
    worker >> Edge(style="dashed", color="gray") >> cw
    dlq >> Edge(label="alarm", color="red", style="dashed") >> cw
    cw >> Edge(style="dashed", color="gray") >> grafana

    # Terraform
    terraform >> Edge(style="dotted", color="green", label="manages") >> alb
