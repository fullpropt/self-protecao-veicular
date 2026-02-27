import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandLogoUrl, brandName } from '../lib/brand';

type DashboardGlobals = {
  initDashboard?: () => void;
  loadDashboardData?: () => void;
  loadCustomEvents?: (options?: { silent?: boolean }) => void;
  openModal?: (id: string) => void;
  closeModal?: (id: string) => void;
  openCustomEventModal?: (id?: number) => void;
  saveCustomEvent?: () => void;
  deleteCustomEvent?: (id: number) => void;
  exportLeads?: () => void;
  confirmReset?: () => void;
  filterLeads?: () => void;
  toggleSelectAll?: () => void;
  importLeads?: () => void;
  saveLead?: () => void;
  updateLead?: () => void;
  logout?: () => void;
};

function DashboardStyles() {
  return (
    <style>{`
        :root {
          --bg-0: #050f0b;
          --bg-1: rgba(10, 29, 23, 0.9);
          --bg-2: rgba(16, 44, 34, 0.78);
          --stroke-soft: rgba(223, 255, 239, 0.07);
          --text-1: #e8f6ee;
          --text-2: #9cb9ac;
          --accent: #22c77a;
        }

        .dashboard-react {
          --primary: var(--accent);
          --primary-rgb: 34, 199, 122;
          --surface: var(--bg-1);
          --surface-muted: var(--bg-2);
          --border-color: var(--stroke-soft);
          --dark: var(--text-1);
          --radius-panel: 22px;
          --radius-card: 18px;
          --space-gap: 20px;
        }

        .dashboard-react .main-content {
          color: var(--text-1);
          padding: 30px;
          background:
            radial-gradient(560px 240px at 8% 0%, rgba(34, 199, 122, 0.09), rgba(34, 199, 122, 0)),
            radial-gradient(520px 220px at 96% 0%, rgba(34, 199, 122, 0.07), rgba(34, 199, 122, 0)),
            linear-gradient(180deg, rgba(5, 16, 12, 0.92), rgba(3, 10, 8, 0.96));
        }

        .dashboard-react .sidebar {
          background: linear-gradient(180deg, rgba(18, 50, 39, 0.92), rgba(11, 32, 24, 0.95));
          border-right: none;
          box-shadow: inset -1px 0 0 var(--stroke-soft);
          backdrop-filter: blur(6px);
        }

        .dashboard-react .sidebar-header,
        .dashboard-react .sidebar-footer {
          border-color: transparent;
          box-shadow: none;
        }

        .dashboard-react .sidebar-footer {
          box-shadow: none;
        }

        .dashboard-react .sidebar-nav {
          padding: 16px 12px;
        }

        .dashboard-react .nav-section {
          margin-bottom: 22px;
        }

        .dashboard-react .nav-section-title {
          color: rgba(202, 230, 217, 0.62);
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }

        .dashboard-react .nav-item {
          margin-bottom: 6px;
        }

        .dashboard-react .nav-link {
          border-radius: 14px;
          padding: 11px 13px;
          background: rgba(255, 255, 255, 0.01);
          color: var(--text-2);
          transition: transform 160ms ease, background 160ms ease, color 160ms ease;
        }

        .dashboard-react .nav-link:hover {
          transform: translateX(2px);
          background: rgba(var(--primary-rgb), 0.14);
          color: var(--text-1);
        }

        .dashboard-react .nav-link.active {
          border: none;
          color: var(--text-1);
          background: linear-gradient(90deg, rgba(var(--primary-rgb), 0.28), rgba(var(--primary-rgb), 0.12));
          box-shadow: inset 0 0 0 1px rgba(150, 241, 199, 0.2);
        }

        .dashboard-react .btn-logout {
          background: rgba(248, 113, 113, 0.12);
        }

        .dashboard-react .btn-logout:hover {
          background: rgba(248, 113, 113, 0.2);
        }

        .dashboard-react .page-header {
          margin-bottom: 22px;
        }

        .dashboard-react .page-title h1 {
          color: var(--text-1);
          font-size: clamp(24px, 2.3vw, 30px);
          letter-spacing: -0.02em;
        }

        .dashboard-react .page-title p {
          color: var(--text-2);
          font-size: 13px;
        }

        .dashboard-react .dashboard-botconversa {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--space-gap);
          margin-bottom: 22px;
        }

        .dashboard-react .stats-period-card,
        .dashboard-react .stats-general-card,
        .dashboard-react .events-personalized-card,
        .dashboard-react .funnel-container {
          background: linear-gradient(170deg, rgba(11, 32, 25, 0.94), rgba(8, 22, 18, 0.92));
          border-radius: var(--radius-panel);
          border: none;
          box-shadow: inset 0 0 0 1px var(--stroke-soft), 0 8px 20px rgba(0, 0, 0, 0.14);
          padding: 22px;
        }

        .dashboard-react .stats-period-card h3,
        .dashboard-react .stats-general-card h3,
        .dashboard-react .events-personalized-card h3,
        .dashboard-react .funnel-title {
          margin: 0 0 16px;
          color: var(--text-1);
          font-size: 16px;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .dashboard-react .funnel-title {
          margin-bottom: 14px;
        }

        .dashboard-react .stats-period-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 16px;
        }

        .dashboard-react .stats-period-controls .form-input,
        .dashboard-react .stats-period-controls .form-select,
        .dashboard-react #customEventsPeriod.form-select {
          height: 38px;
          padding: 0 12px;
          border: none;
          border-radius: 12px;
          background: rgba(16, 44, 34, 0.72);
          color: var(--text-1);
        }

        .dashboard-react .stats-period-controls .form-input:focus,
        .dashboard-react .stats-period-controls .form-select:focus,
        .dashboard-react #customEventsPeriod.form-select:focus {
          box-shadow: 0 0 0 1px rgba(147, 239, 194, 0.3);
        }

        .dashboard-react .chart-type-toggle {
          display: flex;
          gap: 6px;
        }

        .dashboard-react .chart-type-toggle .chart-btn {
          min-height: 36px;
          padding: 8px 12px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          color: var(--text-2);
          background: rgba(16, 44, 34, 0.66);
          transition: background 160ms ease, color 160ms ease;
        }

        .dashboard-react .chart-type-toggle .chart-btn:hover {
          color: var(--text-1);
          background: rgba(var(--primary-rgb), 0.15);
        }

        .dashboard-react .chart-type-toggle .chart-btn.active {
          color: var(--text-1);
          background: rgba(var(--primary-rgb), 0.22);
        }

        .dashboard-react .stats-period-chart {
          margin-top: 4px;
          padding: 10px;
          border-radius: 14px;
          background: rgba(8, 24, 19, 0.44);
        }

        .dashboard-react .stats-general-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid rgba(223, 255, 239, 0.08);
        }

        .dashboard-react .stats-general-item:last-child {
          border-bottom: none;
        }

        .dashboard-react .stats-general-label {
          font-size: 12px;
          color: var(--text-2);
        }

        .dashboard-react .stats-general-value {
          font-weight: 750;
          font-size: 20px;
          color: var(--text-1);
        }

        .dashboard-react .events-header {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .dashboard-react .events-header h3 {
          margin: 0;
        }

        .dashboard-react .events-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
          flex-wrap: wrap;
        }

        .dashboard-react .events-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 12px;
          color: var(--text-2);
        }

        .dashboard-react .events-summary strong {
          color: var(--text-1);
        }

        .dashboard-react .events-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .dashboard-react .events-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: none;
          border-radius: 16px;
          background: linear-gradient(160deg, rgba(16, 44, 34, 0.82), rgba(13, 35, 28, 0.84));
          transition: transform 160ms ease, background 160ms ease;
        }

        .dashboard-react .events-row:hover {
          transform: translateY(-1px);
          background: linear-gradient(160deg, rgba(18, 48, 38, 0.84), rgba(14, 38, 30, 0.86));
        }

        .dashboard-react .events-row-main {
          min-width: 0;
        }

        .dashboard-react .events-row-name {
          font-weight: 700;
          color: var(--text-1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dashboard-react .events-row-key,
        .dashboard-react .events-row-last {
          font-size: 11px;
          color: var(--text-2);
        }

        .dashboard-react .events-row-count {
          font-size: 12px;
          color: rgba(210, 234, 223, 0.88);
          white-space: nowrap;
        }

        .dashboard-react .events-row-actions {
          display: inline-flex;
          gap: 6px;
        }

        .dashboard-react .events-loading,
        .dashboard-react .events-error {
          padding: 14px;
          text-align: center;
          border: none;
          border-radius: 14px;
          color: var(--text-2);
          background: rgba(16, 44, 34, 0.58);
        }

        .dashboard-react .events-empty {
          text-align: center;
          padding: 34px 20px;
          color: var(--text-2);
        }

        .dashboard-react .events-empty-emoji {
          width: 46px;
          height: 46px;
          display: block;
          margin: 0 auto 14px;
          opacity: 0.55;
          background-color: var(--text-2);
        }

        .dashboard-react .custom-event-status {
          font-size: 10px;
          border-radius: 999px;
          padding: 4px 8px;
          border: none;
          color: var(--text-2);
          background: rgba(8, 24, 19, 0.52);
          white-space: nowrap;
        }

        .dashboard-react .custom-event-status.active {
          color: #dffceb;
          background: rgba(var(--primary-rgb), 0.18);
        }

        .dashboard-react .custom-event-status.inactive {
          color: var(--text-2);
        }

        .dashboard-react .stats-grid {
          gap: 18px;
          margin-bottom: 22px;
        }

        .dashboard-react .stat-card,
        .dashboard-react .funnel-stage {
          background: linear-gradient(160deg, rgba(16, 44, 34, 0.82), rgba(13, 35, 28, 0.84));
          border: none;
          border-radius: var(--radius-card);
          transition: transform 180ms ease, background 180ms ease;
        }

        .dashboard-react .stat-card {
          padding: 18px;
        }

        .dashboard-react .stat-card:hover,
        .dashboard-react .funnel-stage:hover {
          transform: translateY(-2px);
          background: linear-gradient(160deg, rgba(18, 50, 39, 0.86), rgba(14, 40, 31, 0.88));
        }

        .dashboard-react .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
        }

        .dashboard-react .stat-content {
          display: grid;
          justify-items: end;
          gap: 4px;
          text-align: right;
        }

        .dashboard-react .stat-value {
          font-size: clamp(30px, 2.2vw, 36px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-1);
          line-height: 1;
        }

        .dashboard-react .stat-label {
          font-size: 12px;
          color: var(--text-2);
          margin-top: 0;
        }

        .dashboard-react .stat-change {
          margin-top: 2px;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 999px;
          border: none;
          box-shadow: inset 0 0 0 1px rgba(223, 255, 239, 0.12);
        }

        .dashboard-react .stat-change.positive {
          color: #cdf8df;
          background: rgba(34, 197, 94, 0.16);
        }

        .dashboard-react .stat-change.negative {
          color: #ffd7db;
          background: rgba(248, 113, 113, 0.16);
        }

        .dashboard-react .funnel-container {
          margin-bottom: 22px;
          padding: 22px;
        }

        .dashboard-react .funnel-stages {
          gap: 12px;
          padding-bottom: 6px;
        }

        .dashboard-react .funnel-stage {
          min-width: 142px;
          padding: 16px 14px;
        }

        .dashboard-react .funnel-value {
          color: #7df0b2;
          font-size: 30px;
          font-weight: 800;
        }

        .dashboard-react .funnel-label {
          color: var(--text-2);
          font-size: 11px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .dashboard-react .funnel-percent {
          color: rgba(208, 235, 222, 0.82);
          font-size: 11px;
          font-weight: 600;
        }

        .dashboard-react .funnel-arrow {
          color: rgba(156, 185, 172, 0.8);
        }

        .dashboard-react .table-container,
        .dashboard-react .card {
          border: none;
          box-shadow: inset 0 0 0 1px var(--stroke-soft), 0 8px 20px rgba(0, 0, 0, 0.14);
          border-radius: var(--radius-panel);
          background: linear-gradient(170deg, rgba(11, 32, 25, 0.94), rgba(8, 22, 18, 0.92));
        }

        .dashboard-react .table-header,
        .dashboard-react .card-header {
          border-color: rgba(223, 255, 239, 0.08);
          padding: 18px 20px;
        }

        .dashboard-react .table-title,
        .dashboard-react .card-title {
          color: var(--text-1);
          font-size: 15px;
        }

        .dashboard-react .info-icon {
          cursor: help;
          opacity: 0.7;
        }

        @media (max-width: 900px) {
          .dashboard-react .dashboard-botconversa {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-react .main-content {
            padding: 72px 14px 16px;
          }

          .dashboard-react .dashboard-botconversa {
            gap: 14px;
            margin-bottom: 16px;
          }

          .dashboard-react .stats-period-card,
          .dashboard-react .stats-general-card,
          .dashboard-react .events-personalized-card,
          .dashboard-react .funnel-container {
            padding: 14px;
            border-radius: 16px;
          }

          .dashboard-react .stats-period-card h3,
          .dashboard-react .stats-general-card h3,
          .dashboard-react .events-personalized-card h3 {
            margin-bottom: 12px;
            font-size: 15px;
          }

          .dashboard-react .stats-period-controls {
            gap: 8px;
          }

          .dashboard-react .stats-period-controls .form-input,
          .dashboard-react .stats-period-controls .form-select {
            width: 100%;
            min-width: 0;
          }

          .dashboard-react .chart-type-toggle {
            width: 100%;
          }

          .dashboard-react .chart-type-toggle .chart-btn {
            flex: 1 1 0;
          }

          .dashboard-react .stats-period-chart canvas {
            max-height: 150px !important;
          }

          .dashboard-react .events-header {
            gap: 8px;
            margin-bottom: 12px;
          }

          .dashboard-react .events-controls {
            width: 100%;
            margin-left: 0;
          }

          .dashboard-react .events-controls .form-select,
          .dashboard-react .events-controls .btn {
            width: 100%;
          }

          .dashboard-react .events-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .dashboard-react .events-row-count,
          .dashboard-react .events-row-last {
            white-space: normal;
          }

          .dashboard-react .events-row-actions {
            justify-content: flex-end;
          }
        }
      `}</style>
  );
}

function DashboardHeader() {
  return (
    <div className="page-header">
      <div className="page-title">
        <h1>Painel de Controle</h1>
        <p>
          Bem-vindo, <span className="user-name">Usuário</span> |{' '}
          <span className="current-date"></span>
        </p>
      </div>
    </div>
  );
}

function StatsPeriod() {
  return (
    <div className="dashboard-botconversa">
      <div className="stats-period-card">
        <h3>Estatísticas por período</h3>
        <div className="stats-period-controls">
          <input type="date" className="form-input" id="statsStartDate" />
          <input type="date" className="form-input" id="statsEndDate" />
          <select className="form-select" id="statsMetric" style={{ width: 'auto' }}>
            <option value="novos_contatos">Novos Contatos</option>
            <option value="mensagens">Mensagens</option>
            <option value="interacoes">Interações</option>
          </select>
          <div className="chart-type-toggle">
            <button type="button" className="chart-btn active" data-chart-type="line" title="Gráfico de linhas">
              <span className="icon icon-chart-line icon-sm"></span>
            </button>
            <button type="button" className="chart-btn" data-chart-type="bar" title="Gráfico de barras">
              <span className="icon icon-chart-bar icon-sm"></span>
            </button>
          </div>
        </div>
        <div className="stats-period-chart" id="statsPeriodChart">
          <canvas id="statsChart" style={{ maxHeight: '200px' }}></canvas>
        </div>
      </div>
      <div className="stats-general-card">
        <h3>Estatísticas gerais</h3>
        <div className="stats-general-item">
          <span className="stats-general-label">Contatos que interagiram</span>
          <span className="stats-general-value" id="statsContacts">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Mensagem enviada pelo contato</span>
          <span className="stats-general-value" id="statsMessages">0</span>
        </div>
        <div className="stats-general-item">
          <span className="stats-general-label">Interações/Inscrito</span>
          <span className="stats-general-value" id="statsInteractionsPer">0</span>
        </div>
      </div>
    </div>
  );
}

function EventsCard() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="events-personalized-card" style={{ marginBottom: '24px' }}>
      <div className="events-header">
        <h3>
          Eventos personalizados{' '}
          <span
            className="info-icon"
            title="Crie eventos personalizados, integre-os em fluxos com o Bloco de Ação e rastreie suas estatísticas."
          >
            <span className="icon icon-info icon-sm"></span>
          </span>
        </h3>
        <div className="events-controls">
          <select className="form-select" id="customEventsPeriod" style={{ width: 'auto' }}>
            <option value="this_month">Este mês</option>
            <option value="week">Semana</option>
            <option value="year">Ano</option>
            <option value="last_30_days">Últimos 30 dias</option>
          </select>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => globals.openCustomEventModal?.()}>
            Criar
          </button>
        </div>
      </div>
      <div id="customEventsList">
        <div className="events-loading">Carregando eventos personalizados...</div>
      </div>
    </div>
  );
}

function StatsCards() {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon primary"><span className="icon icon-contacts"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="totalLeads">0</div>
          <div className="stat-label">Total de Leads</div>
          <div className="stat-change positive" id="leadsChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon success"><span className="icon icon-check"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="completedLeads">0</div>
          <div className="stat-label">Concluídos</div>
          <div className="stat-change positive" id="completedChange">+0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon warning"><span className="icon icon-clock"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="pendingLeads">0</div>
          <div className="stat-label">Em Andamento</div>
          <div className="stat-change negative" id="pendingChange">-0%</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon info"><span className="icon icon-chart-bar"></span></div>
        <div className="stat-content">
          <div className="stat-value" id="conversionRate">0.0%</div>
          <div className="stat-label">Conversão</div>
          <div className="stat-change positive" id="conversionChange">+0%</div>
        </div>
      </div>
    </div>
  );
}

function Funnel() {
  return (
    <div className="funnel-container">
      <div className="funnel-title"><span className="icon icon-funnel icon-sm"></span> Funil de Conversão</div>
      <div className="funnel-stages" id="funnelStages">
        <div className="funnel-stage" data-stage="1">
          <div className="funnel-value" id="funnel1">0</div>
          <div className="funnel-label">Etapa 1</div>
          <div className="funnel-percent">100%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="2">
          <div className="funnel-value" id="funnel2">0</div>
          <div className="funnel-label">Etapa 2</div>
          <div className="funnel-percent" id="funnel2Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="3">
          <div className="funnel-value" id="funnel3">0</div>
          <div className="funnel-label">Etapa 3</div>
          <div className="funnel-percent" id="funnel3Percent">0%</div>
        </div>
        <div className="funnel-arrow">&rarr;</div>
        <div className="funnel-stage" data-stage="4">
          <div className="funnel-value" id="funnel4">0</div>
          <div className="funnel-label">Concluído</div>
          <div className="funnel-percent" id="funnel4Percent">0%</div>
        </div>
      </div>
    </div>
  );
}

function LeadsTable() {
  const globals = window as Window & DashboardGlobals;

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="table-title"><span className="icon icon-contacts icon-sm"></span> Leads Recentes</div>
        <div className="table-filters contacts-table-filters">
          <div className="search-box contacts-search-box">
            <span className="search-icon icon icon-search icon-sm"></span>
            <input
              type="text"
              id="searchLeads"
              placeholder="Buscar..."
              onKeyUp={() => globals.filterLeads?.()}
            />
          </div>
          <select
            className="form-select contacts-filter-select"
            id="filterStatus"
            onChange={() => globals.filterLeads?.()}
          >
            <option value="">Todos os Status</option>
            <option value="1">Novo</option>
            <option value="2">Em Andamento</option>
            <option value="3">Concluído</option>
            <option value="4">Perdido</option>
          </select>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
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
          <tbody id="leadsTableBody">
            <tr>
              <td colSpan={7} className="table-empty">
                <div className="table-empty-icon icon icon-empty icon-lg"></div>
                <p>Carregando leads...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadModals() {
  const globals = window as Window & DashboardGlobals;

  return (
    <>
      <div className="modal-overlay" id="importModal">
        <div className="modal modal-lg">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-import icon-sm"></span> Importar Leads</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('importModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Arquivo CSV</label>
              <input type="file" className="form-input" id="importFile" accept=".csv,.txt" />
              <p className="form-help">
                Formato esperado: nome, telefone, veículo, placa (separados por vírgula)
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Ou cole os dados aqui</label>
              <textarea
                className="form-textarea"
                id="importText"
                rows={10}
                placeholder={`nome,telefone,veiculo,placa\nJoão Silva,27999999999,Honda Civic 2020,ABC1234\nMaria Santos,27988888888,Toyota Corolla 2021,XYZ5678`}
              ></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Tag para importação (opcional)</label>
              <input
                type="text"
                className="form-input"
                id="importTag"
                placeholder="Ex: Prioridade, Premium, Indicação"
              />
              <p className="form-help">Aplicada em todos os leads importados.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('importModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.importLeads?.()}>
              Importar
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="addLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-add icon-sm"></span> Adicionar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('addLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="addLeadForm">
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="leadName" required placeholder="Nome completo" />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="leadPhone" required placeholder="27999999999" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="leadVehicle" placeholder="Ex: Honda Civic 2020" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="leadPlate" placeholder="ABC1234" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="leadEmail" placeholder="email@exemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Status Inicial</label>
                <select className="form-select" id="leadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('addLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveLead?.()}>
              Salvar Lead
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="editLeadModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title"><span className="icon icon-edit icon-sm"></span> Editar Lead</h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('editLeadModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="editLeadForm">
              <input type="hidden" id="editLeadId" />
              <div className="form-group">
                <label className="form-label required">Nome</label>
                <input type="text" className="form-input" id="editLeadName" required />
              </div>
              <div className="form-group">
                <label className="form-label required">WhatsApp</label>
                <input type="tel" className="form-input" id="editLeadPhone" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Veículo</label>
                  <input type="text" className="form-input" id="editLeadVehicle" />
                </div>
                <div className="form-group">
                  <label className="form-label">Placa</label>
                  <input type="text" className="form-input" id="editLeadPlate" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" id="editLeadEmail" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" id="editLeadStatus">
                  <option value="1">Novo</option>
                  <option value="2">Em Andamento</option>
                  <option value="3">Concluído</option>
                  <option value="4">Perdido</option>
                </select>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('editLeadModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.updateLead?.()}>
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="customEventModal">
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title" id="customEventModalTitle">
              <span className="icon icon-add icon-sm"></span> Novo Evento
            </h3>
            <button
              type="button"
              className="modal-close"
              onClick={() => globals.closeModal?.('customEventModal')}
            >
              {'\u00D7'}
            </button>
          </div>
          <div className="modal-body">
            <form id="customEventForm">
              <input type="hidden" id="customEventId" />
              <div className="form-group">
                <label className="form-label required">Nome do evento</label>
                <input type="text" className="form-input" id="customEventName" placeholder="Ex.: Conversa Qualificada" />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <textarea
                  className="form-textarea"
                  id="customEventDescription"
                  rows={3}
                  placeholder="Explique quando este evento deve ser disparado"
                ></textarea>
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper" style={{ gap: '8px' }}>
                  <input type="checkbox" id="customEventActive" defaultChecked />
                  <span className="checkbox-custom"></span>
                  Evento ativo
                </label>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => globals.closeModal?.('customEventModal')}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => globals.saveCustomEvent?.()}>
              Salvar Evento
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FloatingAddLeadButton() {
  const globals = window as Window & DashboardGlobals;

  return (
    <button
      type="button"
      className="btn btn-whatsapp btn-icon"
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        boxShadow: 'var(--shadow-lg)'
      }}
      onClick={() => globals.openModal?.('addLeadModal')}
      title="Adicionar Lead"
    >
      <span className="icon icon-add icon-lg"></span>
    </button>
  );
}

export default function Dashboard() {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      await import('../../core/app');
      const mod = await import('../../pages/dashboard');

      if (cancelled) return;

      const win = window as Window & DashboardGlobals;
      if (typeof win.initDashboard === 'function') {
        win.initDashboard();
      } else if (typeof (mod as { initDashboard?: () => void }).initDashboard === 'function') {
        (mod as { initDashboard?: () => void }).initDashboard?.();
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const globals = window as Window & DashboardGlobals;
  const toggleSidebar = () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  };

  return (
    <div className="dashboard-react">
      <DashboardStyles />
      <button className="mobile-menu-toggle" type="button" onClick={toggleSidebar}>
        {'\u2630'}
      </button>
      <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-logo"><img src={brandLogoUrl} alt={brandName} className="brand-logo" /><span className="brand-text">{brandName}</span></Link>
        </div>

        <nav className="sidebar-nav">
                            <div className="nav-section">
                      <ul className="nav-menu">
                          <li className="nav-item"><Link to="/dashboard" className="nav-link active"><span className="icon icon-dashboard"></span>Painel de Controle</Link></li>
                          <li className="nav-item"><Link to="/contatos" className="nav-link"><span className="icon icon-contacts"></span>Contatos</Link></li>
                          <li className="nav-item"><Link to="/campanhas" className="nav-link"><span className="icon icon-campaigns"></span>Campanhas</Link></li>
                      </ul>
                  </div>

                  <div className="nav-section">
                      <div className="nav-section-title">Conversas</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/inbox" className="nav-link">
                  <span className="icon icon-inbox"></span>
                  Inbox
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
                  <span className="icon icon-automation"></span>
                  Automação
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/fluxos" className="nav-link">
                  <span className="icon icon-flows"></span>
                  Fluxos de Conversa
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/funil" className="nav-link">
                  <span className="icon icon-funnel"></span>
                  Funil de Vendas
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            <div className="nav-section-title">Sistema</div>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/whatsapp" className="nav-link">
                  <span className="icon icon-whatsapp"></span>
                  WhatsApp
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/configuracoes" className="nav-link">
                  <span className="icon icon-settings"></span>
                  Configurações
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
          <button className="btn-logout" type="button" onClick={() => globals.logout?.()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main-content">
        <DashboardHeader />
        <StatsPeriod />
        <EventsCard />
        <StatsCards />
        <Funnel />
      </main>
      <LeadModals />
      <FloatingAddLeadButton />
    </div>
  );
}
