import { useState } from 'react';
import Tabs from './components/Tabs';
import ClientsTab from './components/ClientsTab';
import ServicesTab from './components/ServicesTab';
import ReceiptBooksTab from './components/ReceiptBooksTab';
import BillingTab from './components/BillingTab';
import LoginScreen from './components/LoginScreen';
import './App.css';

const TAB_NAMES = ['Clientes', 'Servicios', 'Talonarios', 'Facturación'];

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState(0);

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="app">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Log Urbano - Sistema de Facturación</h1>
        <button onClick={handleLogout} className="btn-danger">
          Cerrar sesión
        </button>
      </header>
      <Tabs tabs={TAB_NAMES} active={activeTab} onChange={setActiveTab} />
      <main>
        {activeTab === 0 && <ClientsTab />}
        {activeTab === 1 && <ServicesTab />}
        {activeTab === 2 && <ReceiptBooksTab />}
        {activeTab === 3 && <BillingTab />}
      </main>
    </div>
  );
}
