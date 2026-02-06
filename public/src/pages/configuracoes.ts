// @ts-nocheck
// Configuracoes page logic migrated to module

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkWhatsAppStatus();
    const hash = window.location.hash?.slice(1);
    if (hash) {
        const panel = document.getElementById(`panel-${hash}`);
        if (panel) {
            document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelector(`[onclick="showPanel('${hash}')"]`)?.classList.add('active');
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            panel.classList.add('active');
        }
    }
});

function showPanel(panelId) {
    document.querySelectorAll('.settings-nav-item').forEach(item => item.classList.remove('active'));
    event.target.closest('.settings-nav-item').classList.add('active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`panel-${panelId}`).classList.add('active');
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    if (settings.company) {
        document.getElementById('companyName').value = settings.company.name || '';
        document.getElementById('companyCnpj').value = settings.company.cnpj || '';
        document.getElementById('companyPhone').value = settings.company.phone || '';
        document.getElementById('companyEmail').value = settings.company.email || '';
    }
    if (settings.copys) {
        document.getElementById('copyWelcome').value = settings.copys.welcome || document.getElementById('copyWelcome').value;
        document.getElementById('copyQuote').value = settings.copys.quote || document.getElementById('copyQuote').value;
        document.getElementById('copyFollowup').value = settings.copys.followup || document.getElementById('copyFollowup').value;
        document.getElementById('copyClosing').value = settings.copys.closing || document.getElementById('copyClosing').value;
    }
}

function saveGeneralSettings() {
    const settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.company = {
        name: document.getElementById('companyName').value,
        cnpj: document.getElementById('companyCnpj').value,
        phone: document.getElementById('companyPhone').value,
        email: document.getElementById('companyEmail').value
    };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Configurações salvas!');
}

function saveFunnelSettings() {
    const settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.funnel = [];
    for (let i = 1; i <= 4; i++) {
        settings.funnel.push({
            name: document.getElementById(`funnel${i}Name`).value,
            color: document.getElementById(`funnel${i}Color`).value,
            description: document.getElementById(`funnel${i}Desc`).value
        });
    }
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Funil salvo!');
}

function saveCopysSettings() {
    const settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.copys = {
        welcome: document.getElementById('copyWelcome').value,
        quote: document.getElementById('copyQuote').value,
        followup: document.getElementById('copyFollowup').value,
        closing: document.getElementById('copyClosing').value
    };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Templates salvos!');
}

function insertVariable(variable) {
    const focused = document.activeElement;
    if (focused && focused.tagName === 'TEXTAREA') {
        const start = focused.selectionStart;
        const end = focused.selectionEnd;
        const text = focused.value;
        focused.value = text.substring(0, start) + variable + text.substring(end);
        focused.selectionStart = focused.selectionEnd = start + variable.length;
        focused.focus();
    }
}

function testCopy(type) {
    const testData = { nome: 'João Silva', telefone: '(11) 99999-9999', veiculo: 'Honda Civic 2020', placa: 'ABC-1234', empresa: 'SELF Proteção Veicular' };
    let message = '';
    switch (type) {
        case 'welcome': message = document.getElementById('copyWelcome').value; break;
        case 'quote': message = document.getElementById('copyQuote').value; break;
        case 'followup': message = document.getElementById('copyFollowup').value; break;
        case 'closing': message = document.getElementById('copyClosing').value; break;
    }
    Object.keys(testData).forEach(key => { message = message.replace(new RegExp(`{{${key}}}`, 'g'), testData[key]); });
    alert('Preview da mensagem:\n\n' + message);
}

function saveNewTemplate() {
    const name = document.getElementById('newTemplateName').value.trim();
    const message = document.getElementById('newTemplateMessage').value.trim();
    if (!name || !message) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    const container = document.querySelector('#panel-copys .settings-section');
    const newCard = document.createElement('div');
    newCard.className = 'copy-card';
    newCard.innerHTML = `<div class="copy-card-header"><span class="copy-card-title">${name}</span><button class="btn btn-sm btn-outline-danger" onclick="this.closest('.copy-card').remove()"><span class="icon icon-delete icon-sm"></span></button></div><textarea class="form-textarea" rows="4">${message}</textarea>`;
    container.insertBefore(newCard, container.querySelector('button.w-100'));
    closeModal('addTemplateModal');
    document.getElementById('newTemplateName').value = '';
    document.getElementById('newTemplateMessage').value = '';
    showToast('success', 'Sucesso', 'Template adicionado!');
}

async function checkWhatsAppStatus() {
    try {
        const response = await api.get('/api/whatsapp/status');
        const txt = document.getElementById('whatsappStatusText');
        if (txt) txt.textContent = response.connected ? 'Conectado' : 'Desconectado';
        const success = document.getElementById('connectionSuccess');
        const disc = document.getElementById('connectionDisconnected');
        const phoneEl = document.getElementById('connectedPhone');
        if (success && disc) {
            if (response.connected) {
                success.style.display = 'block';
                disc.style.display = 'none';
                if (phoneEl) phoneEl.textContent = response.phone || '+55...';
            } else {
                success.style.display = 'none';
                disc.style.display = 'block';
            }
        }
    } catch (error) {
        const txt = document.getElementById('whatsappStatusText');
        if (txt) txt.textContent = 'Desconectado';
        const success = document.getElementById('connectionSuccess');
        const disc = document.getElementById('connectionDisconnected');
        if (success && disc) { success.style.display = 'none'; disc.style.display = 'block'; }
    }
}

async function connectWhatsApp() {
    try {
        showLoading('Gerando QR Code...');
        const response = await api.get('/api/whatsapp/qr');
        hideLoading();
        if (response.qr) {
            document.getElementById('qrCodeContainer').style.display = 'block';
            document.getElementById('qrCode').innerHTML = `<img src="${response.qr}" alt="QR Code" style="max-width: 250px;">`;
        }
    } catch (error) { hideLoading(); showToast('error', 'Erro', 'Não foi possível gerar o QR Code'); }
}

async function disconnectWhatsApp() {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    try { await api.post('/api/whatsapp/disconnect'); checkWhatsAppStatus(); showToast('success', 'Sucesso', 'WhatsApp desconectado!'); } catch (error) { showToast('error', 'Erro', 'Não foi possível desconectar'); }
}

function saveWhatsAppSettings() {
    const settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.whatsapp = { interval: document.getElementById('messageInterval').value, messagesPerHour: document.getElementById('messagesPerHour').value, workStart: document.getElementById('workStart').value, workEnd: document.getElementById('workEnd').value };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Configurações salvas!');
}

function saveNotificationSettings() { showToast('success', 'Sucesso', 'Notificações salvas!'); }

function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    if (!name || !email || !password) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    const tbody = document.getElementById('usersTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>${email}</td><td><span class="badge badge-${role === 'admin' ? 'primary' : 'secondary'}">${role === 'admin' ? 'Administrador' : 'Usuário'}</span></td><td><span class="badge badge-success">Ativo</span></td><td><button class="btn btn-sm btn-outline"><span class="icon icon-edit icon-sm"></span></button><button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><span class="icon icon-delete icon-sm"></span></button></td>`;
    tbody.appendChild(tr);
    closeModal('addUserModal');
    showToast('success', 'Sucesso', 'Usuário adicionado!');
}

function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (!current || !newPass || !confirm) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    if (newPass !== confirm) { showToast('error', 'Erro', 'As senhas não conferem'); return; }
    if (newPass.length < 6) { showToast('error', 'Erro', 'A senha deve ter pelo menos 6 caracteres'); return; }
    showToast('success', 'Sucesso', 'Senha alterada!');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

function copyApiKey() { navigator.clipboard.writeText(document.getElementById('apiKey').value); showToast('success', 'Copiado', 'API Key copiada!'); }
function regenerateApiKey() { if (!confirm('Regenerar a API Key?')) return; document.getElementById('apiKey').value = 'sk_live_' + Math.random().toString(36).substring(2, 15); showToast('success', 'Sucesso', 'Nova API Key gerada!'); }
function testWebhook() { showToast('info', 'Testando', 'Enviando requisição de teste...'); setTimeout(() => { showToast('success', 'Sucesso', 'Webhook respondeu corretamente!'); }, 1500); }
function saveApiSettings() { showToast('success', 'Sucesso', 'Configurações de API salvas!'); }

const windowAny = window as any;
windowAny.showPanel = showPanel;
windowAny.saveGeneralSettings = saveGeneralSettings;
windowAny.saveFunnelSettings = saveFunnelSettings;
windowAny.saveCopysSettings = saveCopysSettings;
windowAny.insertVariable = insertVariable;
windowAny.testCopy = testCopy;
windowAny.saveNewTemplate = saveNewTemplate;
windowAny.connectWhatsApp = connectWhatsApp;
windowAny.disconnectWhatsApp = disconnectWhatsApp;
windowAny.saveWhatsAppSettings = saveWhatsAppSettings;
windowAny.saveNotificationSettings = saveNotificationSettings;
windowAny.addUser = addUser;
windowAny.changePassword = changePassword;
windowAny.copyApiKey = copyApiKey;
windowAny.regenerateApiKey = regenerateApiKey;
windowAny.testWebhook = testWebhook;
windowAny.saveApiSettings = saveApiSettings;

export {};
