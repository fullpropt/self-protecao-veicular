export const dashboardShellMarkup = `
<style>

        .dashboard-botconversa { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px; }
        @media (max-width: 900px) { .dashboard-botconversa { grid-template-columns: 1fr; } }
        .stats-period-card, .stats-general-card, .events-personalized-card { background: white; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); padding: 24px; border: 1px solid var(--border-color); }
        .stats-period-card h3, .stats-general-card h3, .events-personalized-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
        .stats-period-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; }
        .stats-period-controls .form-input, .stats-period-controls .form-select { height: 38px; padding: 0 12px; }
        .chart-type-toggle { display: flex; gap: 4px; }
        .chart-type-toggle .chart-btn { padding: 8px 12px; border: 1px solid var(--border-color); background: white; border-radius: 8px; cursor: pointer; }
        .chart-type-toggle .chart-btn.active { background: rgba(var(--primary-rgb), 0.1); border-color: var(--primary); color: var(--primary); }
        .stats-general-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
        .stats-general-item:last-child { border-bottom: none; }
        .stats-general-label { font-size: 13px; color: var(--gray-600); }
        .stats-general-value { font-weight: 700; font-size: 18px; }
        .events-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .events-header h3 { margin: 0; }
        .info-icon { cursor: help; opacity: 0.7; }
        .events-empty { text-align: center; padding: 40px 20px; color: var(--gray-500); }
        .events-empty-emoji { width: 48px; height: 48px; display: block; margin-bottom: 16px; opacity: 0.6; background-color: var(--gray-400); }
    
</style>
<!-- Mobile Menu Toggle -->
    <button class="mobile-menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active')">
        ☰
    </button>
    <div class="sidebar-overlay"></div>

    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <a href="app.html#/dashboard" class="sidebar-logo">
                <img src="img/logo-self.png" alt="SELF">
                <span>SELF</span>
            </a>
        </div>
        
        <nav class="sidebar-nav">
            <div class="nav-section">
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="app.html#/dashboard" class="nav-link active">
                            <span class="icon icon-dashboard"></span>
                            Painel de Controle
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/contatos" class="nav-link">
                            <span class="icon icon-contacts"></span>
                            Contatos
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/campanhas" class="nav-link">
                            <span class="icon icon-campaigns"></span>
                            Campanhas
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/transmissao" class="nav-link">
                            <span class="icon icon-broadcast"></span>
                            Transmissão
                        </a>
                    </li>
                </ul>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Conversas</div>
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="app.html#/inbox" class="nav-link">
                            <span class="icon icon-inbox"></span>
                            Inbox
                            <span class="badge" style="display: none;">0</span>
                        </a>
                    </li>
                </ul>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Automação</div>
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="app.html#/automacao" class="nav-link">
                            <span class="icon icon-automation"></span>
                            Automação
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/fluxos" class="nav-link">
                            <span class="icon icon-flows"></span>
                            Fluxos de Conversa
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/funil" class="nav-link">
                            <span class="icon icon-funnel"></span>
                            Funil de Vendas
                        </a>
                    </li>
                </ul>
            </div>
            
            <div class="nav-section">
                <div class="nav-section-title">Sistema</div>
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="app.html#/whatsapp" class="nav-link">
                            <span class="icon icon-whatsapp"></span>
                            WhatsApp
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/configuracoes" class="nav-link">
                            <span class="icon icon-settings"></span>
                            Configurações
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="app.html#/configuracoes?panel=copys" class="nav-link">
                            <span class="icon icon-templates"></span>
                            Modelos
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
        
        <div class="sidebar-footer">
            <div class="whatsapp-status">
                <span class="status-indicator disconnected"></span>
                <span class="whatsapp-status-text">Desconectado</span>
            </div>
            <button class="btn-logout" onclick="logout()">Sair</button>
        </div>
    </aside>

    <!-- Main Content -->
`;

export const dashboardContentTopMarkup = `
<!-- Header -->
        
            <div class="page-actions">
                <button class="btn btn-outline" onclick="loadDashboardData()">
                    <span class="icon icon-refresh icon-sm"></span>
                    Atualizar
                </button>
                <button class="btn btn-outline" onclick="openModal('importModal')">
                    <span class="icon icon-import icon-sm"></span>
                    Importar
                </button>
                <button class="btn btn-success" onclick="exportLeads()">
                    <span class="icon icon-export icon-sm"></span>
                    Exportar
                </button>
                <button class="btn btn-whatsapp" onclick="window.location.href='app.html#/transmissao'">
                    <span class="icon icon-batch icon-sm"></span>
                    Lote
                </button>
                <button class="btn btn-outline-danger" onclick="confirmReset()">
                    <span class="icon icon-reset icon-sm"></span>
                    Reset
                </button>
            </div>
        </div>
`;

export const dashboardContentBottomMarkup = `

`;

export const dashboardAfterMarkup = `

`;
