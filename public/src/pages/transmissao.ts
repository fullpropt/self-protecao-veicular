// @ts-nocheck
// Transmissao page logic migrated to module

let allContacts = [];
let filteredContacts = [];
let selectedContacts = new Set();
let templates = [];
let queueInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    loadTemplates();
    loadQueueStatus();
    
    document.getElementById('startTime').addEventListener('change', (e) => {
        document.getElementById('scheduledTimeGroup').style.display = 
            e.target.value === 'scheduled' ? 'block' : 'none';
    });

    // Atualizar fila a cada 5 segundos
    queueInterval = setInterval(loadQueueStatus, 5000);
});

async function loadContacts() {
    try {
        const response = await api.get('/api/leads');
        allContacts = response.leads || [];
        filteredContacts = [...allContacts];
        renderRecipients();
        document.getElementById('totalCount').textContent = allContacts.length;
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível carregar os contatos');
    }
}

async function loadTemplates() {
    try {
        const response = await api.get('/api/templates');
        templates = response.templates || [];
        const select = document.getElementById('templateSelect');
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    } catch (e) {}
}

function loadTemplate() {
    const id = document.getElementById('templateSelect').value;
    const template = templates.find(t => t.id == id);
    if (template) {
        document.getElementById('messageContent').value = template.content;
        updatePreview();
    }
}

function renderRecipients() {
    const list = document.getElementById('recipientList');
    
    if (filteredContacts.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon icon icon-empty icon-lg"></div><p>Nenhum contato encontrado</p></div>`;
        return;
    }

    list.innerHTML = filteredContacts.map(c => `
        <div class="recipient-item ${selectedContacts.has(c.id) ? 'selected' : ''}" onclick="toggleRecipient(${c.id})">
            <label class="checkbox-wrapper" onclick="event.stopPropagation()">
                <input type="checkbox" ${selectedContacts.has(c.id) ? 'checked' : ''} onchange="toggleRecipient(${c.id})">
                <span class="checkbox-custom"></span>
            </label>
            <div class="avatar avatar-sm" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
            <div class="recipient-info">
                <div class="recipient-name">${c.name || 'Sem nome'}</div>
                <div class="recipient-phone">${formatPhone(c.phone)}</div>
            </div>
            ${getStatusBadge(c.status)}
        </div>
    `).join('');
}

function toggleRecipient(id) {
    if (selectedContacts.has(id)) {
        selectedContacts.delete(id);
    } else {
        selectedContacts.add(id);
    }
    updateSelectedCount();
    renderRecipients();
}

function selectAll() {
    filteredContacts.forEach(c => selectedContacts.add(c.id));
    updateSelectedCount();
    renderRecipients();
}

function deselectAll() {
    selectedContacts.clear();
    updateSelectedCount();
    renderRecipients();
}

function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = selectedContacts.size;
}

function filterRecipients() {
    const search = document.getElementById('searchRecipients').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    filteredContacts = allContacts.filter(c => {
        const matchSearch = !search || 
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search));
        const matchStatus = !status || c.status == status;
        return matchSearch && matchStatus;
    });

    renderRecipients();
}

function updatePreview() {
    const content = document.getElementById('messageContent').value;
    const preview = document.getElementById('messagePreview');
    
    if (!content) {
        preview.textContent = 'A mensagem aparecerá aqui...';
        return;
    }

    // Simular com dados de exemplo
    let previewText = content
        .replace(/\{\{nome\}\}/g, 'João Silva')
        .replace(/\{\{veiculo\}\}/g, 'Honda Civic 2020')
        .replace(/\{\{placa\}\}/g, 'ABC1234');
    
    preview.textContent = previewText;
}

async function startBroadcast() {
    const message = document.getElementById('messageContent').value.trim();
    const delay = parseInt(document.getElementById('messageDelay').value);
    const startTime = document.getElementById('startTime').value;

    if (selectedContacts.size === 0) {
        showToast('error', 'Erro', 'Selecione pelo menos um contato');
        return;
    }

    if (!message) {
        showToast('error', 'Erro', 'Digite uma mensagem');
        return;
    }

    if (APP.whatsappStatus !== 'connected') {
        showToast('warning', 'Aviso', 'WhatsApp não está conectado. As mensagens serão enviadas quando conectar.');
    }

    const btn = document.getElementById('startBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="icon icon-clock icon-sm"></span> Processando...';

    try {
        const leadIds = Array.from(selectedContacts);
        
        // Randomizar se necessário
        if (document.getElementById('randomizeOrder').checked) {
            leadIds.sort(() => Math.random() - 0.5);
        }

        const response = await api.post('/api/queue/bulk', {
            leadIds,
            content: message,
            delay
        });

        showToast('success', 'Sucesso', `${leadIds.length} mensagens adicionadas à fila!`);
        
        // Mostrar progresso
        document.getElementById('queueProgress').style.display = 'block';
        loadQueueStatus();
        
        // Limpar seleção
        deselectAll();
        
    } catch (error) {
        showToast('error', 'Erro', error.message || 'Falha ao iniciar transmissão');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="icon icon-play icon-sm"></span> Iniciar Transmissão';
    }
}

async function loadQueueStatus() {
    try {
        const response = await api.get('/api/queue/status');
        const queue = response.queue || [];
        
        const pending = queue.filter(q => q.status === 'pending').length;
        const processing = queue.filter(q => q.status === 'processing').length;
        const sent = queue.filter(q => q.status === 'sent').length;
        const failed = queue.filter(q => q.status === 'failed').length;
        const total = queue.length;

        // Atualizar progresso
        if (total > 0) {
            document.getElementById('queueProgress').style.display = 'block';
            const progress = ((sent + failed) / total) * 100;
            document.getElementById('progressBar').style.width = `${progress}%`;
            document.getElementById('sentCount').textContent = sent;
            document.getElementById('pendingCount').textContent = pending + processing;
            document.getElementById('failedCount').textContent = failed;
            
            // Calcular ETA
            const delay = parseInt(document.getElementById('messageDelay').value) || 5000;
            const remaining = pending + processing;
            const etaSeconds = Math.ceil((remaining * delay) / 1000);
            const etaMinutes = Math.floor(etaSeconds / 60);
            const etaSecs = etaSeconds % 60;
            document.getElementById('etaTime').textContent = `${etaMinutes}:${etaSecs.toString().padStart(2, '0')}`;
        } else {
            document.getElementById('queueProgress').style.display = 'none';
        }

        // Renderizar lista
        renderQueueList(queue);
        
    } catch (error) {
        console.error('Erro ao carregar fila:', error);
    }
}

function renderQueueList(queue) {
    const list = document.getElementById('queueList');
    
    if (queue.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon icon icon-empty icon-lg"></div><p>Nenhuma mensagem na fila</p></div>`;
        return;
    }

    list.innerHTML = queue.slice(0, 50).map(q => `
        <div class="queue-item">
            <div class="queue-status ${q.status}"></div>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${q.lead_name || 'Contato'}</div>
                <div style="font-size: 12px; color: var(--gray-500);">${formatPhone(q.lead_phone || '')}</div>
            </div>
            <div style="text-align: right;">
                <span class="badge badge-${q.status === 'sent' ? 'success' : q.status === 'failed' ? 'danger' : q.status === 'processing' ? 'info' : 'warning'}">
                    ${q.status === 'sent' ? 'Enviada' : q.status === 'failed' ? 'Falha' : q.status === 'processing' ? 'Enviando' : 'Aguardando'}
                </span>
                <div style="font-size: 11px; color: var(--gray-400); margin-top: 4px;">
                    ${q.processed_at ? timeAgo(q.processed_at) : ''}
                </div>
            </div>
            ${q.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger btn-icon" onclick="cancelQueueItem(${q.id})" title="Cancelar"><span class="icon icon-close icon-sm"></span></button>` : ''}
        </div>
    `).join('');
}

async function cancelQueueItem(id) {
    try {
        await api.delete(`/api/queue/${id}`);
        loadQueueStatus();
        showToast('success', 'Sucesso', 'Mensagem cancelada');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível cancelar');
    }
}

async function clearQueue() {
    if (!confirm('Limpar todas as mensagens pendentes da fila?')) return;
    
    try {
        await api.delete('/api/queue');
        loadQueueStatus();
        showToast('success', 'Sucesso', 'Fila limpa');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível limpar a fila');
    }
}

function pauseQueue() {
    showToast('info', 'Info', 'Função de pausa em desenvolvimento');
}

// Limpar intervalo ao sair da página
window.addEventListener('beforeunload', () => {
    if (queueInterval) clearInterval(queueInterval);
});

const windowAny = window as any;
windowAny.loadTemplate = loadTemplate;
windowAny.toggleRecipient = toggleRecipient;
windowAny.selectAll = selectAll;
windowAny.deselectAll = deselectAll;
windowAny.filterRecipients = filterRecipients;
windowAny.updatePreview = updatePreview;
windowAny.startBroadcast = startBroadcast;
windowAny.loadQueueStatus = loadQueueStatus;
windowAny.cancelQueueItem = cancelQueueItem;
windowAny.clearQueue = clearQueue;
windowAny.pauseQueue = pauseQueue;

export {};
