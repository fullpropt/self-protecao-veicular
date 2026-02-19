import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Automacao from './pages/Automacao';
import Campanhas from './pages/Campanhas';
import Configuracoes from './pages/Configuracoes';
import Contatos from './pages/Contatos';
import Conversas from './pages/Conversas';
import ConversasV2 from './pages/ConversasV2';
import Dashboard from './pages/Dashboard';
import FlowBuilder from './pages/FlowBuilder';
import Fluxos from './pages/Fluxos';
import Funil from './pages/Funil';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Login from './pages/Login';
import Transmissao from './pages/Transmissao';
import Whatsapp from './pages/Whatsapp';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    (window as Window & { refreshWhatsAppStatus?: () => void }).refreshWhatsAppStatus?.();
  }, [location.pathname, location.search, location.hash]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/contatos" element={<Contatos />} />
      <Route path="/campanhas" element={<Campanhas />} />
      <Route path="/automacao" element={<Automacao />} />
      <Route path="/fluxos" element={<Fluxos />} />
      <Route path="/flow-builder" element={<FlowBuilder />} />
      <Route path="/funil" element={<Funil />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/conversas" element={<Conversas />} />
      <Route path="/conversas-v2" element={<ConversasV2 />} />
      <Route path="/transmissao" element={<Transmissao />} />
      <Route path="/whatsapp" element={<Whatsapp />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
    </Routes>
  );
}
