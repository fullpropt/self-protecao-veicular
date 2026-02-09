export const transmissaoMarkup = `
<style>

        .broadcast-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
        }
        @media (max-width: 1024px) {
            .broadcast-container { grid-template-columns: 1fr; }
        }
        .recipient-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
        }
        .recipient-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            transition: background 0.2s;
        }
        .recipient-item:hover { background: var(--gray-50); }
        .recipient-item:last-child { border-bottom: none; }
        .recipient-item.selected { background: rgba(var(--primary-rgb), 0.1); }
        .recipient-info { flex: 1; }
        .recipient-name { font-weight: 600; font-size: 14px; }
        .recipient-phone { font-size: 12px; color: var(--gray-500); }
        .message-preview {
            background: var(--whatsapp-light);
            border-radius: 12px;
            padding: 15px;
            margin-top: 15px;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .queue-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .queue-item:last-child { border-bottom: none; }
        .queue-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        .queue-status.pending { background: var(--warning); }
        .queue-status.processing { background: var(--info); animation: pulse 1s infinite; }
        .queue-status.sent { background: var(--success); }
        .queue-status.failed { background: var(--danger); }
        .progress-container {
            background: white;
            border-radius: var(--border-radius-lg);
            padding: 20px;
            box-shadow: var(--shadow-md);
            margin-bottom: 25px;
        }
        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .progress-stats {
            display: flex;
            gap: 30px;
            margin-top: 15px;
        }
        .progress-stat {
            text-align: center;
        }
        .progress-stat-value {
            font-size: 24px;
            font-weight: 700;
        }
        .progress-stat-label {
            font-size: 12px;
            color: var(--gray-500);
        }
    
</style>
<button class="mobile-menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open'); document.querySelector('.sidebar-overlay').classList.toggle('active')">☰</button>
    <div class="sidebar-overlay"></div>

    <aside class="sidebar">
        <div class="sidebar-header">
            <a href="app.html#/dashboard" class="sidebar-logo">
                <img src="img/logo-self.png" alt="SELF"><span>SELF</span>
            </a>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-section">
                <ul class="nav-menu">
                    <li class="nav-item"><a href="app.html#/dashboard" class="nav-link"><span class="icon icon-dashboard"></span>Painel de Controle</a></li>
                    <li class="nav-item"><a href="app.html#/contatos" class="nav-link"><span class="icon icon-contacts"></span>Contatos</a></li>
                    <li class="nav-item"><a href="app.html#/campanhas" class="nav-link"><span class="icon icon-campaigns"></span>Campanhas</a></li>
                    <li class="nav-item"><a href="app.html#/transmissao" class="nav-link active"><span class="icon icon-broadcast"></span>Transmissão</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Conversas</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="app.html#/inbox" class="nav-link"><span class="icon icon-inbox"></span>Inbox<span class="badge" style="display:none;">0</span></a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Automação</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="app.html#/automacao" class="nav-link"><span class="icon icon-automation"></span>Automação</a></li>
                    <li class="nav-item"><a href="app.html#/fluxos" class="nav-link"><span class="icon icon-flows"></span>Fluxos de Conversa</a></li>
                    <li class="nav-item"><a href="app.html#/funil" class="nav-link"><span class="icon icon-funnel"></span>Funil de Vendas</a></li>
                </ul>
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Sistema</div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="app.html#/whatsapp" class="nav-link"><span class="icon icon-whatsapp"></span>WhatsApp</a></li>
                    <li class="nav-item"><a href="app.html#/configuracoes" class="nav-link"><span class="icon icon-settings"></span>Configurações</a></li>
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
                <h1><span class="icon icon-broadcast icon-sm"></span> Transmissão em Lote</h1>
                <p>Envie mensagens para múltiplos contatos com automação de tempo</p>
            </div>
            <div class="page-actions">
                <button class="btn btn-outline" onclick="loadQueueStatus()"><span class="icon icon-refresh icon-sm"></span> Atualizar Fila</button>
                <button class="btn btn-danger" onclick="clearQueue()"><span class="icon icon-delete icon-sm"></span> Limpar Fila</button>
            </div>
        </div>

        <!-- Status da Fila -->
        <div class="progress-container" id="queueProgress" style="display: none;">
            <div class="progress-header">
                <div>
                    <h3 style="margin: 0;"><span class="icon icon-export icon-sm"></span> Envio em Andamento</h3>
                    <p style="color: var(--gray-500); margin: 5px 0 0;">Aguarde enquanto as mensagens são enviadas</p>
                </div>
                <button class="btn btn-sm btn-danger" onclick="pauseQueue()"><span class="icon icon-pause icon-sm"></span> Pausar</button>
            </div>
            <div class="progress" style="height: 12px;">
                <div class="progress-bar" id="progressBar" style="width: 0%;"></div>
            </div>
            <div class="progress-stats">
                <div class="progress-stat">
                    <div class="progress-stat-value text-success" id="sentCount">0</div>
                    <div class="progress-stat-label">Enviadas</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-stat-value text-warning" id="pendingCount">0</div>
                    <div class="progress-stat-label">Pendentes</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-stat-value text-danger" id="failedCount">0</div>
                    <div class="progress-stat-label">Falhas</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-stat-value" id="etaTime">--:--</div>
                    <div class="progress-stat-label">Tempo Restante</div>
                </div>
            </div>
        </div>

        <!-- Formulário de Transmissão -->
        <div class="broadcast-container">
            <!-- Coluna Esquerda: Destinatários -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title"><span class="icon icon-contacts icon-sm"></span> Destinatários</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-sm btn-outline" onclick="selectAll()">Selecionar Todos</button>
                        <button class="btn btn-sm btn-outline" onclick="deselectAll()">Limpar</button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <div class="search-box" style="max-width: 100%;">
                            <span class="search-icon icon icon-search icon-sm"></span>
                            <input type="text" id="searchRecipients" placeholder="Buscar contatos..." onkeyup="filterRecipients()">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <select class="form-select" id="filterStatus" onchange="filterRecipients()">
                                <option value="">Todos os Status</option>
                                <option value="1">Novo</option>
                                <option value="2">Em Andamento</option>
                                <option value="3">Concluído</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <select class="form-select" id="filterTag" onchange="filterRecipients()">
                                <option value="">Todas as Tags</option>
                            </select>
                        </div>
                    </div>
                    <div class="recipient-list" id="recipientList">
                        <div class="empty-state">
                            <div class="empty-state-icon icon icon-empty icon-lg"></div>
                            <p>Carregando contatos...</p>
                        </div>
                    </div>
                    <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <span class="text-muted"><strong id="selectedCount">0</strong> selecionados</span>
                        <span class="text-muted"><strong id="totalCount">0</strong> total</span>
                    </div>
                </div>
            </div>

            <!-- Coluna Direita: Mensagem -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title"><span class="icon icon-message icon-sm"></span> Mensagem</div>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Template</label>
                        <select class="form-select" id="templateSelect" onchange="loadTemplate()">
                            <option value="">Selecione um template...</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label required">Mensagem</label>
                        <textarea class="form-textarea" id="messageContent" rows="6" placeholder="Digite sua mensagem aqui...

Use variáveis para personalizar:
{{nome}} - Nome do contato
{{veiculo}} - Veículo
{{placa}} - Placa" onkeyup="updatePreview()"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Pré-visualização</label>
                        <div class="message-preview" id="messagePreview">
                            A mensagem aparecerá aqui...
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Intervalo entre mensagens</label>
                            <select class="form-select" id="messageDelay">
                                <option value="2000">2 segundos</option>
                                <option value="3000">3 segundos</option>
                                <option value="5000" selected>5 segundos</option>
                                <option value="10000">10 segundos</option>
                                <option value="15000">15 segundos</option>
                                <option value="30000">30 segundos</option>
                                <option value="60000">1 minuto</option>
                                <option value="120000">2 minutos</option>
                                <option value="300000">5 minutos</option>
                            </select>
                            <p class="form-help">Tempo de espera entre cada envio</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Início do envio</label>
                            <select class="form-select" id="startTime">
                                <option value="now">Imediatamente</option>
                                <option value="scheduled">Agendar horário</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" id="scheduledTimeGroup" style="display: none;">
                        <label class="form-label">Data e Hora</label>
                        <input type="datetime-local" class="form-input" id="scheduledDateTime">
                    </div>

                    <div class="form-group">
                        <label class="checkbox-wrapper">
                            <input type="checkbox" id="randomizeOrder">
                            <span class="checkbox-custom"></span>
                            <span>Randomizar ordem de envio</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="checkbox-wrapper">
                            <input type="checkbox" id="skipSent">
                            <span class="checkbox-custom"></span>
                            <span>Pular contatos já contatados hoje</span>
                        </label>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-whatsapp w-100" onclick="startBroadcast()" id="startBtn">
                        <span class="icon icon-play icon-sm"></span> Iniciar Transmissão
                    </button>
                </div>
            </div>
        </div>

        <!-- Histórico de Transmissões -->
        <div class="card mt-4">
            <div class="card-header">
                <div class="card-title"><span class="icon icon-message icon-sm"></span> Fila de Mensagens</div>
                <button class="btn btn-sm btn-outline" onclick="loadQueueStatus()"><span class="icon icon-refresh icon-sm"></span> Atualizar</button>
            </div>
            <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                <div id="queueList">
                    <div class="empty-state">
                        <div class="empty-state-icon icon icon-empty icon-lg"></div>
                        <p>Nenhuma mensagem na fila</p>
                    </div>
                </div>
            </div>
        </div>
    </main>
`;
