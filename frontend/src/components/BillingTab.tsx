import { useEffect, useState, useRef } from 'react';
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
  const [processing, setProcessing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    getBillingPending().then(setPending).catch(() => {});
    getReceiptBooks().then(setBooks).catch(() => {});
    getBatches().then(setBatches).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleProcess = async () => {
    setError('');
    setSuccess('');
    if (!selectedBook) {
      setError('Seleccioná un talonario');
      return;
    }
    try {
      setProcessing(true);
      const result = await processBilling(selectedBook);

      if (result.status === 'completed' && result.batch) {
        // Respuesta sincrónica (desarrollo local sin SQS)
        const batch = result.batch;
        setSuccess(`Lote ${batch.id} generado: ${batch.invoiceCount} facturas por $${Number(batch.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
        setProcessing(false);
        load();
      } else {
        // Respuesta async (SQS) → polling hasta que aparezca nuevo lote
        setSuccess('Procesando facturación... esperando resultado');
        const previousBatchCount = batches.length;
        pollingRef.current = setInterval(async () => {
          try {
            const updatedBatches = await getBatches();
            if (updatedBatches.length > previousBatchCount) {
              // Nuevo lote apareció
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              const newBatch = updatedBatches[updatedBatches.length - 1];
              setSuccess(`Lote ${newBatch.id} generado: ${newBatch.invoiceCount} facturas por $${Number(newBatch.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
              setProcessing(false);
              load();
            }
          } catch {
            // Ignorar errores de polling
          }
        }, 3000);

        // Timeout del polling a 60 segundos
        setTimeout(() => {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setProcessing(false);
            setSuccess('');
            setError('Timeout esperando el resultado. Revisá la pestaña de lotes.');
            load();
          }
        }, 60000);
      }
    } catch (err: any) {
      setProcessing(false);
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
          <button onClick={handleProcess} disabled={pending.length === 0 || processing}>
            {processing ? 'Procesando...' : 'Facturar lote'}
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
                  <>
                    <tr key={inv.id} className="row-detail">
                      <td></td>
                      <td><code>{inv.id}</code></td>
                      <td>{inv.invoiceNumber}</td>
                      <td>{inv.client?.businessName || inv.clientId}</td>
                      <td>${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td colSpan={2}>{inv.cae || 'Sin CAE'}</td>
                    </tr>
                    {inv.items?.map((item: any) => (
                      <tr key={item.id} className="row-detail" style={{ opacity: 0.7 }}>
                        <td></td>
                        <td></td>
                        <td style={{ paddingLeft: '2rem', fontSize: '0.85em' }}>↳ {item.service?.description || item.serviceId}</td>
                        <td style={{ fontSize: '0.85em' }}>{item.service?.client?.businessName || ''}</td>
                        <td style={{ fontSize: '0.85em' }}>${Number(item.service?.amount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td colSpan={2}></td>
                      </tr>
                    ))}
                  </>
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
