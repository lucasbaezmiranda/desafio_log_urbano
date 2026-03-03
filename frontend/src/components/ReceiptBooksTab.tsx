import { useEffect, useState } from 'react';
import { getReceiptBooks, createReceiptBook } from '../api';

export default function ReceiptBooksTab() {
  const [books, setBooks] = useState<any[]>([]);
  const [form, setForm] = useState({ pointOfSale: '', description: '' });
  const [error, setError] = useState('');

  const load = () => getReceiptBooks().then(setBooks).catch(() => {});

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createReceiptBook({ pointOfSale: Number(form.pointOfSale), description: form.description });
      setForm({ pointOfSale: '', description: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Talonarios</h2>

      <form className="form-row" onSubmit={handleSubmit}>
        <input
          placeholder="Punto de Venta"
          type="number"
          min="1"
          value={form.pointOfSale}
          onChange={(e) => setForm({ ...form, pointOfSale: e.target.value })}
          required
        />
        <input
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <button type="submit">Crear</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Punto de Venta</th>
            <th>Descripción</th>
            <th>Próximo Número</th>
            <th>Activo</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.id}>
              <td><code>{b.id}</code></td>
              <td>{b.pointOfSale}</td>
              <td>{b.description}</td>
              <td>{b.nextNumber}</td>
              <td>{b.isActive ? '✓' : '✗'}</td>
            </tr>
          ))}
          {books.length === 0 && (
            <tr><td colSpan={5} className="empty">No hay talonarios</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
