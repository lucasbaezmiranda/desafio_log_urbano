import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION_OVERRIDE || process.env.AWS_REGION });
const BACKEND_URL = process.env.BACKEND_URL;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

export async function handler(event) {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { receiptBookId } = message;

    console.log(`Processing billing for receiptBookId: ${receiptBookId}`);

    try {
      const response = await fetch(`${BACKEND_URL}/api/billing/process-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptBookId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Backend returned ${response.status}: ${error}`);
      }

      const batch = await response.json();
      console.log(`Batch created: ${batch.id}, invoices: ${batch.invoiceCount}, total: ${batch.totalAmount}`);

      // Notificar vía SNS
      if (SNS_TOPIC_ARN) {
        await snsClient.send(new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: `Lote de facturación ${batch.id} procesado`,
          Message: [
            `Lote: ${batch.id}`,
            `Facturas generadas: ${batch.invoiceCount}`,
            `Monto total: $${Number(batch.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            `Fecha: ${batch.issueDate}`,
          ].join('\n'),
        }));
        console.log('SNS notification sent');
      }
    } catch (error) {
      console.error(`Error processing billing: ${error.message}`);
      throw error; // Re-throw para que SQS haga retry / DLQ
    }
  }
}
