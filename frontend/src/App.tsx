import { useState } from 'react';
import Tabs from './components/Tabs';
import ClientsTab from './components/ClientsTab';
import ServicesTab from './components/ServicesTab';
import ReceiptBooksTab from './components/ReceiptBooksTab';
import BillingTab from './components/BillingTab';
import './App.css';

const TAB_NAMES = ['Clientes', 'Servicios', 'Talonarios', 'Facturación'];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="app">
      <header>
        <h1>Log Urbano - Sistema de Facturación</h1>
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
