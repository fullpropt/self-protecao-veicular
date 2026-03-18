import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';
type ContatosGlobals = {
  initContacts?: () => void;
  loadContacts?: (options?: { forceRefresh?: boolean; silent?: boolean; bypassMinRevalidate?: boolean }) => void;
  openImportContactsModal?: () => void;
  changeContactsSessionFilter?: (sessionId: string) => void;
  exportContacts?: () => void;
  openModal?: (id: string) => void;
  openAddContactModal?: () => void;
  closeModal?: (id: string) => void;
  saveContact?: () => void;
  updateContact?: () => void;
  openWhatsApp?: () => void;
  importContacts?: () => void;
  bulkSendMessage?: () => void;
  bulkChangeStatus?: () => void;
  bulkAddTag?: () => void;
  bulkRemoveTag?: () => void;
  submitBulkChangeStatus?: () => void;
  submitBulkAddTag?: () => void;
  submitBulkRemoveTag?: () => void;
  bulkDelete?: () => void;
  clearSelection?: () => void;
  filterContacts?: () => void;
  toggleSelectAll?: () => void;
  changePage?: (delta: number) => void;
  sendBulkMessage?: () => void;
  loadTemplate?: () => void;
  switchTab?: (tab: string) => void;
  logout?: () => void;
};

export default function Contatos() {
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await import('../../core/app');
        const mod = await import('../../pages/contatos');

        if (cancelled) return;

        const win = window as Window & ContatosGlobals;
        if (typeof win.initContacts === 'function') {
          win.initContacts();
          return;
        }
        if (typeof (mod as { initContacts?: () => void }).initContacts === 'function') {
          (mod as { initContacts?: () => void }).initContacts?.();
          return;
        }
        throw new Error('initContacts não está disponível');
      } catch (error) {
        if (cancelled) return;
        console.error('Falha ao iniciar Contatos:', error);
        setBootError(error instanceof Error ? error.message : 'Falha ao iniciar Contatos');
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & ContatosGlobals;

  return (
    <div className="contatos-react">
      <style>{`
        .contatos-react .page-title h1 {
          color: #f5fbf8;
          letter-spacing: -0.03em;
        }
        .contatos-react .page-title p {
          color: rgba(214, 228, 239, 0.68);
        }
        .contatos-react .page-actions .btn {
          min-height: 40px;
        }
        .contatos-react .stats-grid .stat-card {
          position: relative;
          overflow: hidden;
          border-color: rgba(var(--primary-rgb), 0.16);
          background: transparent !important;
          box-shadow:
            0 0 0 1px rgba(var(--primary-rgb), 0.08),
            0 0 16px rgba(var(--primary-rgb), 0.08);
        }
        .contatos-react .stats-grid .stat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.72) 0%, rgba(var(--primary-rgb), 0.24) 38%, rgba(255, 255, 255, 0.18) 100%);
          opacity: 0.72;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .contatos-react .stats-grid .stat-card:hover {
          box-shadow:
            0 0 0 1px rgba(var(--primary-rgb), 0.12),
            0 0 18px rgba(var(--primary-rgb), 0.12);
        }
        .contatos-react .stats-grid .stat-icon {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 15px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(255, 255, 255, 0.03);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 12px 24px rgba(1, 3, 7, 0.22);
          color: rgba(235, 241, 245, 0.9);
        }
        .contatos-react .stats-grid .stat-icon::after {
          content: '';
          position: absolute;
          top: 8px;
          right: 8px;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(var(--primary-rgb), 0.42);
          box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.16);
        }
        .contatos-react .stats-grid .stat-icon .icon {
          width: 20px;
          height: 20px;
        }
        .contatos-react .stats-grid .stat-icon.primary,
        .contatos-react .stats-grid .stat-icon.success,
        .contatos-react .stats-grid .stat-icon.warning,
        .contatos-react .stats-grid .stat-icon.info {
          background: rgba(255, 255, 255, 0.03);
          color: rgba(235, 241, 245, 0.9);
        }
        .contatos-react .stats-grid .stat-icon.primary::after,
        .contatos-react .stats-grid .stat-icon.success::after {
          background: rgba(var(--primary-rgb), 0.42);
        }
        .contatos-react .stats-grid .stat-icon.warning::after {
          background: rgba(226, 232, 240, 0.3);
        }
        .contatos-react .stats-grid .stat-icon.info::after {
          background: rgba(129, 140, 248, 0.24);
        }
        .contatos-react .stats-grid .stat-content,
        .contatos-react .stats-grid .stat-icon {
          position: relative;
          z-index: 1;
        }
        .contatos-react .stats-grid .stat-value {
          color: #f3fbff;
          letter-spacing: -0.03em;
        }
        .contatos-react .stats-grid .stat-label {
          color: rgba(214, 228, 239, 0.62);
        }
        .contatos-react #bulkActions,
        .contatos-react .table-container {
          position: relative;
          overflow: hidden;
          border-color: rgba(var(--primary-rgb), 0.18);
          background: linear-gradient(180deg, rgba(18, 36, 58, 0.98) 0%, rgba(14, 29, 47, 0.98) 100%);
          box-shadow:
            0 22px 48px rgba(2, 8, 20, 0.24),
            inset 0 1px 0 rgba(var(--primary-rgb), 0.12),
            0 0 18px rgba(var(--primary-rgb), 0.06);
        }
        .contatos-react #bulkActions::before,
        .contatos-react .table-container::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.05), transparent 22%);
          pointer-events: none;
        }
        .contatos-react .table-header,
        .contatos-react #bulkActions .card-body,
        .contatos-react .table-wrapper,
        .contatos-react .card-footer {
          position: relative;
          z-index: 1;
        }
        .contatos-react .table-header {
          border-bottom-color: rgba(var(--primary-rgb), 0.18);
        }
        .contatos-react .table-title {
          color: #f5fbf8;
        }
        .contatos-react .contacts-table-filters .search-box input,
        .contatos-react .contacts-table-filters .form-select,
        .contatos-react .contact-tag-filter-toggle {
          border-color: rgba(var(--primary-rgb), 0.14);
          background: rgba(16, 31, 51, 0.92);
          color: #e6f1f8;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }
        .contatos-react .contacts-table-filters .search-box input::placeholder {
          color: rgba(214, 228, 239, 0.42);
        }
        .contatos-react .contacts-table-filters .search-icon,
        .contatos-react .contact-tag-filter-toggle::after {
          color: rgba(214, 228, 239, 0.42);
        }
        .contatos-react th {
          background: rgba(7, 17, 29, 0.88);
          color: rgba(214, 228, 239, 0.56);
          border-bottom-color: rgba(var(--primary-rgb), 0.14);
        }
        .contatos-react td {
          color: rgba(231, 243, 249, 0.9);
          border-bottom-color: rgba(148, 163, 184, 0.12);
        }
        .contatos-react tr:hover td {
          background: rgba(var(--primary-rgb), 0.08);
        }
        .contatos-react .contacts-main-name {
          color: #f5fbf8;
        }
        .contatos-react .contacts-main-email,
        .contatos-react .table-empty,
        .contatos-react #paginationInfo,
        .contatos-react #bulkActions span {
          color: rgba(214, 228, 239, 0.64);
        }
        .contatos-react td[data-label="Status"] .badge {
          min-height: 28px;
          padding: 5px 12px;
          border: 1px solid transparent;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 8px 18px rgba(3, 10, 23, 0.14);
        }
        .contatos-react td[data-label="Status"] .badge-info {
          background: rgba(59, 130, 246, 0.14);
          border-color: rgba(96, 165, 250, 0.14);
          color: #60a5fa;
        }
        .contatos-react td[data-label="Status"] .badge-warning {
          background: rgba(245, 158, 11, 0.16);
          border-color: rgba(251, 191, 36, 0.14);
          color: #f59e0b;
        }
        .contatos-react td[data-label="Status"] .badge-success {
          background: rgba(34, 197, 94, 0.14);
          border-color: rgba(74, 222, 128, 0.14);
          color: #00e889;
        }
        .contatos-react td[data-label="Status"] .badge-danger {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(248, 113, 113, 0.14);
          color: #f87171;
        }
        .contatos-react #selectedCount {
          color: #f5fbf8;
        }
        .contatos-react .card-footer {
          border-top-color: rgba(var(--primary-rgb), 0.14);
          background: rgba(8, 19, 33, 0.62);
        }
        .contatos-react #bulkActions .card-body {
          gap: 10px !important;
        }
        @media (max-width: 640px) {
          .contatos-react .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .contatos-react .stats-grid .stat-card {
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 8px;
            min-width: 0;
            padding: 12px;
            border-radius: 12px;
          }
          .contatos-react .stats-grid .stat-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
          }
          .contatos-react .stats-grid .stat-icon .icon {
            width: 16px;
            height: 16px;
          }
          .contatos-react .stats-grid .stat-content {
            width: 100%;
            min-width: 0;
            text-align: left;
          }
          .contatos-react .stats-grid .stat-value { font-size: 20px; }
          .contatos-react .stats-grid .stat-label { font-size: 11px; line-height: 1.2; }
        }

        .contatos-react .bulk-tag-selected-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
          min-height: 36px;
          align-items: center;
        }

        .contatos-react .contact-tag-filter {
          position: relative;
        }
        .contatos-react .contact-tag-filter-toggle {
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          background: var(--surface);
          color: var(--dark);
          min-height: 42px;
          padding: 10px 38px 10px 12px;
          text-align: left;
          font-size: 14px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .contatos-react .contact-tag-filter-toggle::after {
          content: '▾';
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--gray-500);
          font-size: 12px;
        }
        .contatos-react .contact-tag-filter-menu[hidden] {
          display: none;
        }
        .contatos-react .contact-tag-filter-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          z-index: 60;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface);
          box-shadow: var(--shadow-lg);
          padding: 10px;
        }
        .contatos-react .contact-tag-filter-list {
          display: grid;
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .contatos-react .contact-tag-filter-option {
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 10px;
          margin: 0;
          background: var(--surface-alt, rgba(var(--primary-rgb), 0.05));
        }
        .contatos-react .contact-tag-filter-option-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .contatos-react .contact-tag-filter-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .contatos-react .edit-contact-tags-input-wrap {
          position: relative;
        }
        .contatos-react .edit-contact-tags-input-wrap .form-input {
          padding-right: 40px;
        }
        .contatos-react .edit-contact-tags-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: var(--gray-500);
          width: 12px;
          height: 12px;
          padding: 0;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        .contatos-react .edit-contact-tags-toggle:hover {
          color: var(--gray-500);
        }
        .contatos-react .edit-contact-tags-toggle.is-open {
          transform: translateY(-50%) rotate(180deg);
        }
        .contatos-react .edit-contact-tags-suggestions[hidden] {
          display: none;
        }
        .contatos-react .edit-contact-tags-suggestions {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 80;
          border: 1px solid var(--border-color);
          border-radius: 0 0 var(--border-radius) var(--border-radius);
          background: var(--surface);
          max-height: 220px;
          overflow-y: auto;
          box-shadow: var(--shadow-lg);
        }
        .contatos-react .edit-contact-tags-option {
          width: 100%;
          border: 0;
          border-bottom: 1px solid rgba(var(--primary-rgb), 0.12);
          background: transparent;
          color: var(--dark);
          padding: 10px 14px;
          text-align: left;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.2;
        }
        .contatos-react .edit-contact-tags-option:last-child {
          border-bottom: 0;
        }
        .contatos-react .edit-contact-tags-option:hover {
          background: rgba(var(--primary-rgb), 0.12);
        }
        .contatos-react .edit-contact-tags-option.is-selected {
          background: rgba(var(--primary-rgb), 0.32);
          color: #ffffff;
        }
        .contatos-react .edit-contact-tags-empty {
          padding: 10px 14px;
          color: var(--gray-500);
          font-size: 13px;
        }
      `}</style>
      <button
        className="mobile-menu-toggle"
        onClick={() => {
          document.querySelector('.sidebar')?.classList.toggle('open');
          document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        }}
      >
        {'\u2630'}
      </button>
      <div className="sidebar-overlay"></div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>
        <nav className="sidebar-nav">
                            <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link active"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>Inbox
                  <span className="badge" style={{ display: 'none' }}>0</span>
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Automação</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/automacao" className="nav-link">
                  <span className="icon icon-automation"></span>Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>Configurações
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="whatsapp-status">
            <span className="status-indicator disconnected"></span>
            <span className="whatsapp-status-text">Desconectado</span>
          </div>
          <button className="btn-logout" onClick={() => globals.logout?.()}>Sair</button>
        </div>
      </aside>

      <main className="main-content">
        {bootError && (
          <div className="card mb-4" style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}>
            <div className="card-body">
              Não foi possível inicializar os contatos. Abra o console para ver o erro.
            </div>
          </div>
        )}
        <div className="page-header">
          <div className="page-title">
            <h1><span className="icon icon-contacts icon-sm"></span> Contatos</h1>
            <p>Gerencie todos os seus leads e contatos</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline btn-refresh-outline" onClick={() => globals.loadContacts?.({ forceRefresh: true })}>
              <span className="icon icon-refresh icon-sm"></span> Atualizar
            </button>
            <button
              className="btn btn-outline btn-import-contacts"
              onClick={() => globals.openImportContactsModal?.() ?? globals.openModal?.('importModal')}
            >
              <span className="icon icon-import icon-sm"></span> Importar
            </button>
            <button className="btn btn-success btn-export-contacts" onClick={() => globals.exportContacts?.()}>
              <span className="icon icon-export icon-sm"></span> Exportar
            </button>
            <button className="btn btn-primary" onClick={() => globals.openAddContactModal?.() || globals.openModal?.('addContactModal')}>
              <span className="icon icon-add icon-sm"></span> Novo Contato
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary"><span className="icon icon-contacts"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="totalContacts">0</div>
              <div className="stat-label">Total de Contatos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success"><span className="icon icon-check"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="activeContacts">0</div>
              <div className="stat-label">Ativos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning"><span className="icon icon-spark"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="newContacts">0</div>
              <div className="stat-label">Novos (7 dias)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon info"><span className="icon icon-whatsapp"></span></div>
            <div className="stat-content">
              <div className="stat-value" id="withWhatsapp">0</div>
              <div className="stat-label">Com WhatsApp</div>
            </div>
          </div>
        </div>

        <div className="card mb-4" id="bulkActions" style={{ display: 'none' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span><strong id="selectedCount">0</strong> contatos selecionados</span>
            <button className="btn btn-sm btn-whatsapp" onClick={() => globals.bulkSendMessage?.()}>
              <span className="icon icon-whatsapp icon-sm"></span> Enviar Mensagem
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.bulkChangeStatus?.()}>
              <span className="icon icon-refresh icon-sm"></span> Alterar Status
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.bulkAddTag?.()}>
              <span className="icon icon-tag icon-sm"></span> Adicionar Tag
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.bulkRemoveTag?.()}>
              <span className="icon icon-delete icon-sm"></span> Remover Tag
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => globals.bulkDelete?.()}>
              <span className="icon icon-delete icon-sm"></span> Excluir
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => globals.clearSelection?.()}>
              <span className="icon icon-close icon-sm"></span> Limpar Seleção
            </button>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <div className="table-title"><span className="icon icon-contacts icon-sm"></span> Lista de Contatos</div>
            <div className="table-filters contacts-table-filters">
              <div className="search-box contacts-search-box">
                <span className="search-icon icon icon-search icon-sm"></span>
                <input type="text" id="searchContacts" placeholder="Buscar..." onKeyUp={() => globals.filterContacts?.()} />
              </div>
              <select className="form-select contacts-filter-select" id="filterStatus" onChange={() => globals.filterContacts?.()}>
                <option value="">Todos os Status</option>
                <option value="1">Novo</option>
                <option value="2">Em Andamento</option>
                <option value="3">Concluído</option>
                <option value="4">Perdido</option>
              </select>
              <select className="form-select contacts-filter-select" id="filterTag" onChange={() => globals.filterContacts?.()}>
                <option value="">Todas as Tags</option>
              </select>
              <select
                className="form-select contacts-filter-select"
                id="filterSession"
                onChange={(event) => globals.changeContactsSessionFilter?.(event.currentTarget.value)}
              >
                <option value="">Todas as contas</option>
              </select>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr id="contactsTableHeadRow">
                  <th>
                    <label className="checkbox-wrapper">
                      <input type="checkbox" id="selectAll" onChange={() => globals.toggleSelectAll?.()} />
                      <span className="checkbox-custom"></span>
                    </label>
                  </th>
                  <th>Contato</th>
                  <th>WhatsApp</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Última Interação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="contactsTableBody">
                <tr>
                  <td colSpan={7} className="table-empty">
                    <div className="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Carregando contatos...</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span id="paginationInfo">Mostrando 0 de 0 contatos</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button type="button" className="btn btn-sm btn-outline" id="prevPage" disabled>
                {'\u2190'} Anterior
              </button>
              <button type="button" className="btn btn-sm btn-outline" id="nextPage" disabled>
                {'Pr\u00F3ximo \u2192'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="modal-overlay" id="addContactModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Novo Contato</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('addContactModal')}>×</button>
          </div>
          <div className="modal-body">
            <form id="addContactForm">
              <div className="form-group">
                <label className="form-label required">Nome Completo</label>
                <input type="text" className="form-input" id="contactName" required placeholder="Digite o nome" />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="contactPhone" required placeholder="27999999999" />
                <p className="form-help">Apenas números com DDD</p>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="contactEmail" placeholder="email@exemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div className="contact-tag-filter">
                  <button
                    type="button"
                    className="contact-tag-filter-toggle"
                    id="contactTagsToggle"
                    aria-haspopup="true"
                    aria-expanded="false"
                  >
                    Selecione as tags
                  </button>
                  <div className="contact-tag-filter-menu" id="contactTagsMenu" hidden>
                    <div className="contact-tag-filter-list" id="contactTagsOptions">
                      <p style={{ color: 'var(--gray-500)', fontSize: '12px', margin: 0 }}>Carregando tags...</p>
                    </div>
                  </div>
                </div>
                <input type="hidden" id="contactTags" />
                <p className="form-help">Selecione uma ou mais tags na lista.</p>
              </div>
              <div className="form-row" id="contactCustomFields"></div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" id="contactStatus">
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                    <option value="4">Perdido</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Origem</label>
                  <select className="form-select" id="contactSource">
                    <option value="manual">Manual</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="site">Site</option>
                    <option value="indicacao">Indicação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-textarea" id="contactNotes" rows={3} placeholder="Anotações sobre o contato..."></textarea>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('addContactModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.saveContact?.()}>Salvar Contato</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editContactModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Contato</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('editContactModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="tabs">
              <button className="tab active" data-tab="info" onClick={() => globals.switchTab?.('info')}>
                <span className="icon icon-info icon-sm"></span> Informações
              </button>
              <button className="tab" data-tab="history" onClick={() => globals.switchTab?.('history')}>
                <span className="icon icon-clock icon-sm"></span> Histórico
              </button>
              <button className="tab" data-tab="messages" onClick={() => globals.switchTab?.('messages')}>
                <span className="icon icon-message icon-sm"></span> Mensagens
              </button>
            </div>

            <div className="tab-content active" id="tab-info" data-tab-content="info">
              <form id="editContactForm">
                <input type="hidden" id="editContactId" />
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Nome</label>
                    <input type="text" className="form-input" id="editContactName" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">WhatsApp</label>
                    <input type="tel" className="form-input" id="editContactPhone" required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" id="editContactEmail" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" id="editContactStatus">
                      <option value="1">Novo</option>
                      <option value="2">Em Andamento</option>
                      <option value="3">Concluído</option>
                      <option value="4">Perdido</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div className="edit-contact-tags-input-wrap" id="editContactTagsTrigger">
                    <input
                      type="text"
                      className="form-input"
                      id="editContactTags"
                      placeholder="Ex.: VIP, Renovacao"
                    />
                    <button
                      type="button"
                      className="edit-contact-tags-toggle"
                      id="editContactTagsToggle"
                      aria-label="Mostrar tags"
                      aria-expanded="false"
                    >
                      ▾
                    </button>
                    <div
                      id="editContactTagsSuggestions"
                      className="edit-contact-tags-suggestions"
                      hidden
                    ></div>
                  </div>
                  <p className="form-help">Use as etiquetas cadastradas abaixo ou separe multiplas tags por virgula.</p>
                </div>
                <div className="form-row" id="editContactCustomFields"></div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-textarea" id="editContactNotes" rows={3}></textarea>
                </div>
              </form>
            </div>

            <div className="tab-content" id="tab-history" data-tab-content="history">
              <div id="contactHistory" className="empty-state">
                <div className="empty-state-icon icon icon-clock icon-lg"></div>
                <p>Nenhum histórico disponível</p>
              </div>
            </div>

            <div className="tab-content" id="tab-messages" data-tab-content="messages">
              <div id="contactMessages" className="empty-state">
                <div className="empty-state-icon icon icon-message icon-lg"></div>
                <p>Nenhuma mensagem trocada</p>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('editContactModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.updateContact?.()}>Salvar Alterações</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="importModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-import icon-sm"></span> Importar Contatos</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('importModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Arquivo CSV</label>
              <input type="file" className="form-input" id="importFile" accept=".csv,.txt" />
              <p className="form-help">Colunas: nome, telefone, email. Campos dinâmicos: use o nome da variável ou o rótulo da coluna.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Ou cole os dados</label>
              <textarea
                className="form-textarea"
                id="importText"
                rows={8}
                placeholder={`nome,telefone,email
João Silva,27999999999,joao@email.com`}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Status inicial</label>
              <select className="form-select" id="importStatus">
                <option value="1">Novo</option>
                <option value="2">Em Andamento</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tag para importação (opcional)</label>
              <select className="form-select" id="importTag" defaultValue="">
                <option value="">Sem etiqueta</option>
              </select>
              <p className="form-help">Aplicada em todos os contatos importados.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Coluna de tags do CSV (opcional)</label>
              <select className="form-select" id="importTagColumn" defaultValue="__auto__">
                <option value="__auto__">Detectar automaticamente (tag/tags/etiqueta)</option>
                <option value="">Não usar coluna de tags</option>
              </select>
              <p className="form-help">Mescla com a tag global. Célula pode ter várias tags separadas por vírgula, ponto e vírgula ou barra vertical.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('importModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.importContacts?.()}>Importar</button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="bulkMessageModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-whatsapp icon-sm"></span> Enviar Mensagem em Lote</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('bulkMessageModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Destinatários</label>
              <p className="text-muted"><span id="bulkRecipients">0</span> contatos selecionados</p>
            </div>
            <div className="form-group">
              <label className="form-label">Template</label>
              <select className="form-select" id="bulkTemplate" onChange={() => globals.loadTemplate?.()}>
                <option value="">Selecione um template...</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label required">Mensagem</label>
              <textarea
                className="form-textarea"
                id="bulkMessage"
                rows={5}
                placeholder={`Digite a mensagem...
Use {{nome}} para personalizar`}
              ></textarea>
              <p className="form-help">{'Variáveis: {{nome}}, {{telefone}}, {{email}} e campos personalizados'}</p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Intervalo entre mensagens</label>
                <select className="form-select" id="bulkDelay" defaultValue="5000">
                  <option value="3000">3 segundos</option>
                  <option value="5000">5 segundos</option>
                  <option value="10000">10 segundos</option>
                  <option value="30000">30 segundos</option>
                  <option value="60000">1 minuto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Início</label>
                <select className="form-select" id="bulkStart">
                  <option value="now">Imediatamente</option>
                  <option value="scheduled">Agendar</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('bulkMessageModal')}>Cancelar</button>
            <button className="btn btn-whatsapp" onClick={() => globals.sendBulkMessage?.()}>
              <span className="icon icon-whatsapp icon-sm"></span> Enviar para Todos
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="bulkStatusModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-refresh icon-sm"></span> Alterar Status em Lote</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('bulkStatusModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Destinatários</label>
              <p className="text-muted"><span id="bulkStatusRecipients">0</span> contatos selecionados</p>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="bulkStatusValue">Novo status</label>
              <select className="form-select" id="bulkStatusValue" defaultValue="1">
                <option value="1">Novo</option>
                <option value="2">Em Andamento</option>
                <option value="3">Concluído</option>
                <option value="4">Perdido</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('bulkStatusModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.submitBulkChangeStatus?.()}>
              <span className="icon icon-refresh icon-sm"></span> Aplicar Status
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="bulkTagModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-tag icon-sm"></span> Adicionar Tag em Lote</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('bulkTagModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Destinatários</label>
              <p className="text-muted"><span id="bulkTagRecipients">0</span> contatos selecionados</p>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="bulkTagInput">Tags para adicionar</label>
              <input
                type="text"
                className="form-input"
                id="bulkTagInput"
                list="bulkTagOptions"
                placeholder="Ex.: Lead, Campanha Março"
              />
              <datalist id="bulkTagOptions"></datalist>
              <p className="form-help">Separe múltiplas tags por vírgula.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('bulkTagModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.submitBulkAddTag?.()}>
              <span className="icon icon-tag icon-sm"></span> Adicionar Tags
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="bulkRemoveTagModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-delete icon-sm"></span> Remover Tag em Lote</h3>
            <button className="modal-close" onClick={() => globals.closeModal?.('bulkRemoveTagModal')}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Destinatários</label>
              <p className="text-muted"><span id="bulkRemoveTagRecipients">0</span> contatos selecionados</p>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="bulkRemoveTagSelect">Tags para remover</label>
              <select className="form-select" id="bulkRemoveTagSelect" defaultValue="">
                <option value="">Selecione uma tag...</option>
              </select>
              <div id="bulkRemoveTagSelectedChips" className="bulk-tag-selected-chips">
                <span className="text-muted">Nenhuma tag selecionada.</span>
              </div>
              <p className="form-help">Selecione uma ou mais tags na lista acima.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => globals.closeModal?.('bulkRemoveTagModal')}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => globals.submitBulkRemoveTag?.()}>
              <span className="icon icon-delete icon-sm"></span> Remover Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
