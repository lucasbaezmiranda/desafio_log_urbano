import { useEffect, useState } from 'react';
import { getClients, createClient, deleteClient } from '../api';

const TAX_CONDITIONS = [
  'RESPONSABLE_INSCRIPTO',
  'MONOTRIBUTO',
  'EXENTO',
  'CONSUMIDOR_FINAL',
];

const TAX_LABELS: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Resp. Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
};

export default function ClientsTab() {
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    businessName: '',
    taxId: '',
    taxCondition: TAX_CONDITIONS[0],
    email: '',
  });
  const [error, setError] = useState('');

  const load = () => getClients().then(setClients).catch(() => {});

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createClient(form);
      setForm({ businessName: '', taxId: '', taxCondition: TAX_CONDITIONS[0], email: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Clientes</h2>

      <form className="form-row" onSubmit={handleSubmit}>
        <input
          placeholder="Razón Social"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          required
        />
        <input
          placeholder="CUIT (30-12345678-9)"
          value={form.taxId}
          onChange={(e) => setForm({ ...form, taxId: e.target.value })}
          required
        />
        <select
          value={form.taxCondition}
          onChange={(e) => setForm({ ...form, taxCondition: e.target.value })}
        >
          {TAX_CONDITIONS.map((tc) => (
            <option key={tc} value={tc}>{TAX_LABELS[tc]}</option>
          ))}
        </select>
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <button type="submit">Crear</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Razón Social</th>
            <th>CUIT</th>
            <th>Condición Fiscal</th>
            <th>Email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td><code>{c.id}</code></td>
              <td>{c.businessName}</td>
              <td>{c.taxId}</td>
              <td>{TAX_LABELS[c.taxCondition] || c.taxCondition}</td>
              <td>{c.email}</td>
              <td><button className="btn-danger" onClick={() => handleDelete(c.id)}>✕</button></td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan={6} className="empty">No hay clientes</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
