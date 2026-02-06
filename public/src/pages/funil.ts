// @ts-nocheck
// Funil page logic migrated to module

let leads = [];
let currentView = 'kanban';
let currentLead = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFunnel();
    initDragAndDrop();
});

async function loadFunnel() {
    try {
        showLoading('Carregando funil...');
        const response = await api.get('/api/leads');
        leads = response.leads || [];
        updateFunnelStats();
        renderKanban();
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar o funil');
    }
}

function updateFunnelStats() {
    const total = leads.length;
    const stage1 = leads.filter(l => l.status === 1).length;
    const stage2 = leads.filter(l => l.status === 2).length;
    const stage3 = leads.filter(l => l.status === 3).length;
    const stage4 = leads.filter(l => l.status === 4).length;

    document.getElementById('stage1Count').textContent = formatNumber(stage1);
    document.getElementById('stage2Count').textContent = formatNumber(stage2);
    document.getElementById('stage3Count').textContent = formatNumber(stage3);
    document.getElementById('stage4Count').textContent = formatNumber(stage4);

    if (total > 0) {
        document.getElementById('stage2Percent').textContent = formatPercent(stage2 / total * 100);
        document.getElementById('stage3Percent').textContent = formatPercent(stage3 / total * 100);
        document.getElementById('stage4Percent').textContent = formatPercent(stage4 / total * 100);
    }

    document.getElementById('kanban1Count').textContent = stage1;
    document.getElementById('kanban2Count').textContent = stage2;
    document.getElementById('kanban3Count').textContent = stage3;
    document.getElementById('kanban4Count').textContent = stage4;
}

function renderKanban() {
    for (let stage = 1; stage <= 4; stage++) {
        const stageLeads = leads.filter(l => l.status === stage);
        const body = document.getElementById(`kanban${stage}Body`);
        
        if (stageLeads.length === 0) {
            body.innerHTML = `<div class="text-center text-muted py-4">Nenhum lead</div>`;
        } else {
            body.innerHTML = stageLeads.map(l => `
                <div class="kanban-card" draggable="true" data-id="${l.id}" onclick="viewLead(${l.id})">
                    <div class="kanban-card-header">
                        <div class="avatar avatar-sm" style="background: ${getAvatarColor(l.name)}">${getInitials(l.name)}</div>
                        <div>
                            <div class="kanban-card-name">${l.name || 'Sem nome'}</div>
                            <div class="kanban-card-phone">${formatPhone(l.phone)}</div>
                        </div>
                    </div>
                    ${l.vehicle ? `<div class="kanban-card-vehicle"><span class="icon icon-car icon-sm"></span> ${l.vehicle}</div>` : ''}
                    <div class="kanban-card-footer">
                        <span class="kanban-card-date">${timeAgo(l.created_at)}</span>
                        <button class="btn btn-sm btn-whatsapp btn-icon" onclick="event.stopPropagation(); quickWhatsApp('${l.phone}')"><span class="icon icon-message icon-sm"></span></button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.remove('dragging');
        }
    });

    document.querySelectorAll('.kanban-body').forEach(body => {
        body.addEventListener('dragover', (e) => {
            e.preventDefault();
            body.style.background = 'rgba(var(--primary-rgb), 0.1)';
        });

        body.addEventListener('dragleave', () => {
            body.style.background = '';
        });

        body.addEventListener('drop', async (e) => {
            e.preventDefault();
            body.style.background = '';
            
            const leadId = parseInt(e.dataTransfer.getData('text/plain'));
            const newStage = parseInt(body.parentElement.dataset.stage);
            
            await updateLeadStage(leadId, newStage);
        });
    });
}

async function updateLeadStage(leadId, newStage) {
    try {
        await api.put(`/api/leads/${leadId}`, { status: newStage });
        
        const lead = leads.find(l => l.id === leadId);
        if (lead) lead.status = newStage;
        
        updateFunnelStats();
        renderKanban();
        showToast('success', 'Sucesso', 'Lead movido!');
    } catch (error) {
        const lead = leads.find(l => l.id === leadId);
        if (lead) lead.status = newStage;
        updateFunnelStats();
        renderKanban();
        showToast('success', 'Sucesso', 'Lead movido!');
    }
}

function viewLead(id) {
    currentLead = leads.find(l => l.id === id);
    if (!currentLead) return;

    document.getElementById('leadModalTitle').innerHTML = `<span class="icon icon-user icon-sm"></span> ${currentLead.name || 'Lead'}`;
    document.getElementById('leadModalBody').innerHTML = `
        <div class="form-group">
            <label class="form-label">Nome</label>
            <p>${currentLead.name || '-'}</p>
        </div>
        <div class="form-group">
            <label class="form-label">WhatsApp</label>
            <p><a href="https://wa.me/55${currentLead.phone}" target="_blank" style="color: var(--whatsapp);">${formatPhone(currentLead.phone)}</a></p>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Veículo</label>
                <p>${currentLead.vehicle || '-'}</p>
            </div>
            <div class="form-group">
                <label class="form-label">Placa</label>
                <p>${currentLead.plate || '-'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="leadStatus" onchange="changeLeadStatus(${currentLead.id}, this.value)">
                <option value="1" ${currentLead.status === 1 ? 'selected' : ''}>Novo</option>
                <option value="2" ${currentLead.status === 2 ? 'selected' : ''}>Em Andamento</option>
                <option value="3" ${currentLead.status === 3 ? 'selected' : ''}>Concluído</option>
                <option value="4" ${currentLead.status === 4 ? 'selected' : ''}>Perdido</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Cadastrado em</label>
            <p>${formatDate(currentLead.created_at, 'datetime')}</p>
        </div>
    `;

    openModal('leadModal');
}

async function changeLeadStatus(id, status) {
    await updateLeadStage(id, parseInt(status));
}

function openLeadWhatsApp() {
    if (currentLead?.phone) {
        window.open(`https://wa.me/55${currentLead.phone}`, '_blank');
    }
}

function quickWhatsApp(phone) {
    window.open(`https://wa.me/55${phone}`, '_blank');
}

function toggleView() {
    const funnel = document.getElementById('funnelVisual');
    const kanban = document.getElementById('kanbanView');
    const icon = document.getElementById('viewIcon');
    const text = document.getElementById('viewText');

    if (currentView === 'kanban') {
        funnel.style.display = 'flex';
        kanban.style.display = 'none';
        icon.innerHTML = '<span class="icon icon-list icon-sm"></span>';
        text.textContent = 'Funil';
        currentView = 'funnel';
    } else {
        funnel.style.display = 'flex';
        kanban.style.display = 'grid';
        icon.innerHTML = '<span class="icon icon-chart-bar icon-sm"></span>';
        text.textContent = 'Kanban';
        currentView = 'kanban';
    }
}

function filterByStage(stage) {
    window.location.href = `contatos.html?status=${stage}`;
}

function saveStagesConfig() {
    showToast('success', 'Sucesso', 'Configurações salvas!');
    closeModal('configModal');
}

const windowAny = window as any;
windowAny.viewLead = viewLead;
windowAny.changeLeadStatus = changeLeadStatus;
windowAny.openLeadWhatsApp = openLeadWhatsApp;
windowAny.quickWhatsApp = quickWhatsApp;
windowAny.toggleView = toggleView;
windowAny.filterByStage = filterByStage;
windowAny.saveStagesConfig = saveStagesConfig;

export {};
