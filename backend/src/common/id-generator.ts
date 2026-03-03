import { DataSource } from 'typeorm';

/**
 * Generates custom IDs with format PREFIX-0000001 using PostgreSQL sequences.
 * Each entity has its own sequence for atomic, gap-free numbering.
 */
export async function generateCustomId(
  dataSource: DataSource,
  prefix: string,
  sequenceName: string,
): Promise<string> {
  const result = await dataSource.query(
    `SELECT nextval('${sequenceName}') AS val`,
  );
  const num = parseInt(result[0].val, 10);
  return `${prefix}-${num.toString().padStart(7, '0')}`;
}

export const ID_SEQUENCES = {
  CLIENT: 'seq_client',
  SERVICE: 'seq_service',
  BILLING_PENDING: 'seq_billing_pending',
  RECEIPT_BOOK: 'seq_receipt_book',
  INVOICE_BATCH: 'seq_invoice_batch',
  INVOICE: 'seq_invoice',
} as const;

export const ID_PREFIXES = {
  CLIENT: 'CLI',
  SERVICE: 'SRV',
  BILLING_PENDING: 'PEN',
  RECEIPT_BOOK: 'TAL',
  INVOICE_BATCH: 'LOT',
  INVOICE: 'FAC',
} as const;
