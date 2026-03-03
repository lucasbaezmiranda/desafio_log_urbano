import { useEffect, useState } from 'react';
import { getServices, createService, updateServiceStatus, getClients } from '../api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  IN_TRANSIT: '#3b82f6',
  DELIVERED: '#22c55e',
  CANCELLED: '#ef4444',
};

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function ServicesTab() {
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    clientId: '',
    description: '',
    serviceDate: new Date().toISOString().split('T')[0],
    amount: '',
  });
  const [error, setError] = useState('');

  const load = () => {
    getServices().then(setServices).catch(() => {});
    getClients().then(setClients).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createService({ ...form, amount: Number(form.amount) });
      setForm({ clientId: '', description: '', serviceDate: new Date().toISOString().split('T')[0], amount: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateServiceStatus(id, status);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Servicios</h2>

      <form className="form-row" onSubmit={handleSubmit}>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          required
        >
          <option value="">Seleccionar cliente...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.id} - {c.businessName}</option>
          ))}
        </select>
        <input
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <input
          type="date"
          value={form.serviceDate}
          onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
          required
        />
        <input
          placeholder="Monto"
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
        <button type="submit">Crear</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Descripción</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td><code>{s.id}</code></td>
              <td>{s.client?.businessName || s.clientId}</td>
              <td>{s.description}</td>
              <td>{s.serviceDate}</td>
              <td>${Number(s.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              <td>
                <span className="badge" style={{ backgroundColor: STATUS_COLORS[s.status] }}>
                  {STATUS_LABELS[s.status]}
                </span>
              </td>
              <td>
                {NEXT_STATUSES[s.status]?.map((next) => (
                  <button
                    key={next}
                    className="btn-small"
                    onClick={() => handleStatus(s.id, next)}
                  >
                    → {STATUS_LABELS[next]}
                  </button>
                ))}
              </td>
            </tr>
          ))}
          {services.length === 0 && (
            <tr><td colSpan={7} className="empty">No hay servicios</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
