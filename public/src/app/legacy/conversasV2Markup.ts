export const conversasV2Markup = `
<!-- Sidebar -->
    <nav class="sidebar">
        <div class="sidebar-logo">
            <img src="img/logo-self.png" alt="SELF" onerror="this.style.display='none'">
        </div>
        <ul class="sidebar-menu">
            <li><a href="app.html#/dashboard"><span class="icon icon-dashboard"></span> Dashboard</a></li>
            <li><a href="app.html#/funil"><span class="icon icon-funnel"></span> Funil de Vendas</a></li>
            <li><a href="app.html#/whatsapp"><span class="icon icon-whatsapp"></span> WhatsApp</a></li>
            <li><a href="app.html#/conversas-v2" class="active"><span class="icon icon-message"></span> Conversas</a></li>
            <li><a href="app.html#/flow-builder"><span class="icon icon-flows"></span> Fluxos</a></li>
            <li><a href="app.html#/configuracoes"><span class="icon icon-settings"></span> Configurações</a></li>
        </ul>
        <div class="sidebar-footer">
            <a href="app.html#/login" class="btn-logout">Sair</a>
        </div>
    </nav>
    
    <!-- Main Content -->
    <main class="main-content">
        <div class="header">
            <div class="header-title">
                <h1><span class="icon icon-message icon-sm"></span> Conversas</h1>
                <p>Gerencie suas conversas com leads</p>
            </div>
            <div class="header-actions">
                <div id="connectionStatus" class="connection-badge disconnected">
                    <span class="dot"></span>
                    <span class="text">Desconectado</span>
                </div>
            </div>
        </div>
        
        <div class="chat-container">
            <!-- Lista de Conversas -->
            <div class="conversations-list" id="conversationsList">
                <div class="conversations-header">
                    <h2><span class="icon icon-inbox icon-sm"></span> Inbox</h2>
                    <div class="conversations-tabs">
                        <button class="tab-btn active" data-filter="all">Todos</button>
                        <button class="tab-btn" data-filter="unread">Não lidos</button>
                        <button class="tab-btn" data-filter="bot">Bot Ativo</button>
                    </div>
                    <div class="search-box">
                        <span class="search-icon icon icon-search icon-sm"></span>
                        <input type="text" id="searchContacts" placeholder="Buscar conversa...">
                    </div>
                </div>
                <div class="contacts-list" id="contactsList">
                    <!-- Contatos serão carregados aqui -->
                </div>
            </div>
            
            <!-- Área de Chat -->
            <div class="chat-area" id="chatArea">
                <div class="empty-state" id="emptyState">
                    <div class="icon icon-empty icon-lg"></div>
                    <h3>Inicie uma conversa</h3>
                    <p>Selecione um contato na lista ao lado para começar a conversar</p>
                </div>
                
                <!-- Header do Chat (oculto inicialmente) -->
                <div class="chat-header" id="chatHeader" style="display: none;">
                    <div class="chat-header-avatar" id="chatAvatar">V</div>
                    <div class="chat-header-info">
                        <div class="chat-header-name" id="chatName">Nome do Contato</div>
                        <div class="chat-header-status" id="chatStatus">Online</div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="btn-icon" id="btnToggleBot" title="Ativar/Desativar Bot">
                            <span class="icon icon-automation icon-sm"></span>
                        </button>
                        <button class="btn-icon" id="btnViewLead" title="Ver Lead">
                            <span class="icon icon-user icon-sm"></span>
                        </button>
                        <button class="btn-icon" id="btnOpenWhatsApp" title="Abrir no WhatsApp">
                            <span class="icon icon-whatsapp icon-sm"></span>
                        </button>
                    </div>
                </div>
                
                <!-- Container de Mensagens (oculto inicialmente) -->
                <div class="messages-container" id="messagesContainer" style="display: none;">
                    <!-- Mensagens serão carregadas aqui -->
                </div>
                
                <!-- Área de Input (oculto inicialmente) -->
                <div class="chat-input-area" id="chatInputArea" style="display: none;">
                    <div class="quick-replies" id="quickReplies">
                        <button class="quick-reply-btn" data-message="Olá! Tudo bem?"><span class="icon icon-smile icon-sm"></span> Olá!</button>
                        <button class="quick-reply-btn" data-message="Vou verificar e te retorno em breve!"><span class="icon icon-info icon-sm"></span> Mais informações</button>
                        <button class="quick-reply-btn" data-message="Obrigado pelo contato!"><span class="icon icon-check icon-sm"></span> Agradecer</button>
                        <button class="quick-reply-btn" data-message="Vou retornar em breve!"><span class="icon icon-clock icon-sm"></span> Retorno</button>
                    </div>
                    <div class="chat-input-wrapper">
                        <div class="chat-input-actions">
                            <button id="btnEmoji" title="Emoji"><span class="icon icon-smile icon-sm"></span></button>
                            <button id="btnAttach" title="Anexar arquivo"><span class="icon icon-attachment icon-sm"></span></button>
                            <button id="btnAudio" title="Gravar áudio"><span class="icon icon-message icon-sm"></span></button>
                        </div>
                        <div class="chat-input-field">
                            <textarea id="messageInput" placeholder="Digite sua mensagem..." rows="1"></textarea>
                        </div>
                        <button class="send-btn" id="btnSend" disabled>
                            <span class="icon icon-send icon-sm"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </main>
    
    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>
    
    <!-- Modal de Anexo -->
    <div class="modal-overlay" id="attachModal">
        <div class="modal">
            <div class="modal-header">
                <h2><span class="icon icon-attachment icon-sm"></span> Enviar Arquivo</h2>
                <button class="modal-close" onclick="closeAttachModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Selecione o arquivo</label>
                    <input type="file" id="fileInput" class="form-input" accept="image/*,application/pdf,.doc,.docx">
                </div>
                <div class="form-group">
                    <label class="form-label">Legenda (opcional)</label>
                    <input type="text" id="fileCaption" class="form-input" placeholder="Digite uma legenda...">
                </div>
                <div id="filePreview" style="margin-top: 15px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeAttachModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="sendFile()">Enviar</button>
            </div>
        </div>
    </div>
    
    <!-- Hidden file input -->
    <input type="file" id="hiddenFileInput" style="display: none;" accept="image/*,application/pdf,.doc,.docx">
`;
