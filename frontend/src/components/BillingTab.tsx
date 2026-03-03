import { useEffect, useState } from 'react';
import {
  getBillingPending,
  getReceiptBooks,
  processBilling,
  getBatches,
  getBatch,
} from '../api';

export default function BillingTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    getBillingPending().then(setPending).catch(() => {});
    getReceiptBooks().then(setBooks).catch(() => {});
    getBatches().then(setBatches).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleProcess = async () => {
    setError('');
    setSuccess('');
    if (!selectedBook) {
      setError('Seleccioná un talonario');
      return;
    }
    try {
      const result = await processBilling(selectedBook);
      setSuccess(`Lote ${result.id} generado: ${result.invoiceCount} facturas por $${Number(result.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedBatch?.id === id) {
      setExpandedBatch(null);
      return;
    }
    const batch = await getBatch(id);
    setExpandedBatch(batch);
  };

  return (
    <div>
      <h2>Facturación</h2>

      <div className="section">
        <h3>Pendientes de facturar ({pending.length})</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Servicio</th>
              <th>Cliente</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((p) => (
              <tr key={p.id}>
                <td><code>{p.id}</code></td>
                <td>{p.service?.description || p.serviceId}</td>
                <td>{p.service?.client?.businessName || ''}</td>
                <td>${Number(p.service?.amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={4} className="empty">No hay pendientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3>Ejecutar facturación</h3>
        <div className="form-row">
          <select value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
            <option value="">Seleccionar talonario...</option>
            {books.filter((b) => b.isActive).map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} - PV {b.pointOfSale} - {b.description}
              </option>
            ))}
          </select>
          <button onClick={handleProcess} disabled={pending.length === 0}>
            Facturar lote
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </div>

      <div className="section">
        <h3>Lotes generados</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Talonario</th>
              <th>Facturas</th>
              <th>Monto Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <>
                <tr key={b.id} className="clickable" onClick={() => handleExpand(b.id)}>
                  <td><code>{b.id}</code></td>
                  <td>{b.issueDate}</td>
                  <td>PV {b.receiptBook?.pointOfSale}</td>
                  <td>{b.invoiceCount}</td>
                  <td>${Number(b.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td><span className="badge badge-green">{b.status}</span></td>
                  <td>{expandedBatch?.id === b.id ? '▲' : '▼'}</td>
                </tr>
                {expandedBatch?.id === b.id && expandedBatch.invoices?.map((inv: any) => (
                  <tr key={inv.id} className="row-detail">
                    <td></td>
                    <td><code>{inv.id}</code></td>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.client?.businessName || inv.clientId}</td>
                    <td>${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td colSpan={2}>{inv.cae || 'Sin CAE'}</td>
                  </tr>
                ))}
              </>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={7} className="empty">No hay lotes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
