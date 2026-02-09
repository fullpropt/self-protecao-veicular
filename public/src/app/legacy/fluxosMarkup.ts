export const fluxosMarkup = `
<style>

        .flows-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        .flow-card {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-md);
            overflow: hidden;
            transition: all 0.2s;
        }
        .flow-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .flow-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .flow-title { font-size: 18px; font-weight: 700; margin: 0 0 5px; }
        .flow-description { font-size: 13px; color: var(--gray-500); }
        .flow-body { padding: 20px; }
        .flow-steps {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .flow-step {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            font-size: 13px;
        }
        .flow-step-number {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }
        .flow-step-connector {
            width: 2px;
            height: 15px;
            background: var(--gray-300);
            margin-left: 11px;
        }
        .flow-footer {
            padding: 15px 20px;
            background: var(--gray-50);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .flow-stats {
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: var(--gray-500);
        }
        .flow-stat strong { color: var(--gray-700); }
        .flow-editor {
            background: white;
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-lg);
            min-height: 500px;
        }
        .flow-editor-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .flow-editor-body {
            padding: 20px;
        }
        .step-item {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            align-items: flex-start;
        }
        .step-item-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            flex-shrink: 0;
        }
        .step-item-content {
            flex: 1;
            background: var(--gray-50);
            border-radius: var(--border-radius);
            padding: 15px;
        }
        .step-item-actions {
            display: flex;
            gap: 5px;
        }
    
</style>
<button class="mobile-menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active')">☰</button>
    <div class="sidebar-overlay"></div>

    <aside class="sidebar">
        <div class="sidebar-header">
            <a href="dashboard.html" class="sidebar-logo">
                <img src="img/logo-self.png" alt="SELF"><span>SELF</span>
            </a>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-section">
                <ul class="nav-menu">
                    <li class="nav-item"><a href="dashboard.html" class="nav-link"><span class="icon icon-dashboard"></span>Painel de Controle</a></li>
                    <li class="nav-item"><a href="contatos.html" class="nav-link"><span class="icon icon-contacts"></span>Contatos</a></li>
                    <li class="nav-item"><a href="campanhas.html" class="nav-link"><span class="icon icon-campaigns"></span>Campanhas</a></li>
                    <li class="nav-item"><a href="transmissao.html" class="nav-link"><span class="icon icon-broadcast"></span>Transmissão</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Conversas</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="inbox.html" class="nav-link"><span class="icon icon-inbox"></span>Inbox</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Automação</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="automacao.html" class="nav-link"><span class="icon icon-automation"></span>Automação</a></li>
                    <li class="nav-item"><a href="fluxos.html" class="nav-link active"><span class="icon icon-flows"></span>Fluxos de Conversa</a></li>
                    <li class="nav-item"><a href="funil.html" class="nav-link"><span class="icon icon-funnel"></span>Funil de Vendas</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Sistema</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="whatsapp.html" class="nav-link"><span class="icon icon-whatsapp"></span>WhatsApp</a></li>
                    <li class="nav-item"><a href="configuracoes.html" class="nav-link"><span class="icon icon-settings"></span>Configurações</a></li>
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

    <main class="main-content">
        <div class="page-header">
            <div class="page-title">
                <h1><span class="icon icon-flows icon-sm"></span> Fluxos de Conversa</h1>
                <p>Crie sequências de mensagens automáticas</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="loadFlows()"><span class="icon icon-refresh icon-sm"></span> Atualizar</button>
                <button class="btn btn-primary" onclick="openModal('newFlowModal')"><span class="icon icon-add icon-sm"></span> Novo Fluxo</button>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon primary"><span class="icon icon-flows"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="totalFlows">0</div>
                    <div class="stat-label">Total de Fluxos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><span class="icon icon-check"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="activeFlows">0</div>
                    <div class="stat-label">Ativos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info"><span class="icon icon-contacts"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="inFlows">0</div>
                    <div class="stat-label">Leads em Fluxos</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><span class="icon icon-export"></span></div>
                <div class="stat-content">
                    <div class="stat-value" id="sentMessages">0</div>
                    <div class="stat-label">Mensagens Enviadas</div>
                </div>
            </div>
        </div>

        <!-- Lista de Fluxos -->
        <div class="flows-grid" id="flowsList">
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Carregando fluxos...</p>
            </div>
        </div>
    </main>

    <!-- Modal: Novo Fluxo -->
    <div class="modal-overlay" id="newFlowModal">
        <div class="modal modal-lg">
            <div class="modal-header">
                <h3 class="modal-title"><span class="icon icon-add icon-sm"></span> Novo Fluxo de Conversa</h3>
                <button class="modal-close" onclick="closeModal('newFlowModal')">×</button>
            </div>
            <div class="modal-body">
                <form id="flowForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label required">Nome do Fluxo</label>
                            <input type="text" class="form-input" id="flowName" required placeholder="Ex: Sequência de Boas-vindas">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gatilho</label>
                            <select class="form-select" id="flowTrigger">
                                <option value="manual">Manual</option>
                                <option value="new_lead">Novo Lead</option>
                                <option value="keyword">Palavra-chave</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Descrição</label>
                        <textarea class="form-textarea" id="flowDescription" rows="2" placeholder="Descreva o objetivo deste fluxo"></textarea>
                    </div>

                    <hr style="margin: 20px 0;">
                    
                    <h4 style="margin-bottom: 15px;"><span class="icon icon-list icon-sm"></span> Etapas do Fluxo</h4>
                    
                    <div id="flowSteps">
                        <div class="step-item" data-step="1">
                            <div class="step-item-number">1</div>
                            <div class="step-item-content">
                                <div class="form-group" style="margin-bottom: 10px;">
                                    <label class="form-label">Mensagem</label>
                                    <textarea class="form-textarea step-message" rows="3" placeholder="Olá {{nome}}! Seja bem-vindo..."></textarea>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label">Aguardar</label>
                                        <select class="form-select step-delay">
                                            <option value="0">Imediatamente</option>
                                            <option value="60">1 minuto</option>
                                            <option value="300">5 minutos</option>
                                            <option value="3600">1 hora</option>
                                            <option value="86400">24 horas</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Condição</label>
                                        <select class="form-select step-condition">
                                            <option value="always">Sempre enviar</option>
                                            <option value="no_reply">Se não responder</option>
                                            <option value="replied">Se responder</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="step-item-actions">
                                <button type="button" class="btn btn-sm btn-outline-danger btn-icon" onclick="removeStep(1)" title="Remover"><span class="icon icon-delete icon-sm"></span></button>
                            </div>
                        </div>
                    </div>
                    
                    <button type="button" class="btn btn-outline w-100 mt-3" onclick="addStep()">
                        <span class="icon icon-add icon-sm"></span> Adicionar Etapa
                    </button>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('newFlowModal')">Cancelar</button>
                <button class="btn btn-primary" onclick="saveFlow()"><span class="icon icon-save icon-sm"></span> Salvar Fluxo</button>
            </div>
        </div>
    </div>

    <!-- Modal: Editor de Fluxo -->
    <div class="modal-overlay" id="flowEditorModal">
        <div class="modal modal-xl">
            <div class="modal-header">
                <h3 class="modal-title" id="editorTitle"><span class="icon icon-edit icon-sm"></span> Editor de Fluxo</h3>
                <button class="modal-close" onclick="closeModal('flowEditorModal')">×</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <div id="flowEditorContent"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('flowEditorModal')">Cancelar</button>
                <button class="btn btn-primary" onclick="saveFlowChanges()"><span class="icon icon-save icon-sm"></span> Salvar Alterações</button>
            </div>
        </div>
    </div>
`;
