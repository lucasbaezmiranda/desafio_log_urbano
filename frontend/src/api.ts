const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Clients
export const getClients = () => request<any[]>('/clients');
export const createClient = (dto: any) =>
  request<any>('/clients', { method: 'POST', body: JSON.stringify(dto) });
export const deleteClient = (id: string) =>
  request<void>(`/clients/${id}`, { method: 'DELETE' });

// Services
export const getServices = () => request<any[]>('/services');
export const createService = (dto: any) =>
  request<any>('/services', { method: 'POST', body: JSON.stringify(dto) });
export const updateServiceStatus = (id: string, status: string) =>
  request<any>(`/services/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// Receipt Books
export const getReceiptBooks = () => request<any[]>('/receipt-books');
export const createReceiptBook = (dto: any) =>
  request<any>('/receipt-books', { method: 'POST', body: JSON.stringify(dto) });

// Billing
export const getBillingPending = () => request<any[]>('/billing/pending');
export const processBilling = (receiptBookId: string) =>
  request<any>('/billing/process', {
    method: 'POST',
    body: JSON.stringify({ receiptBookId }),
  });
export const getBatches = () => request<any[]>('/billing/batches');
export const getBatch = (id: string) => request<any>(`/billing/batches/${id}`);
