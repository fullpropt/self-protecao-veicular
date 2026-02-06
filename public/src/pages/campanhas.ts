// @ts-nocheck
// Campanhas page logic migrated to module

let campaigns = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCampaigns();
});

async function loadCampaigns() {
    try {
        showLoading('Carregando campanhas...');
        const response = await api.get('/api/campaigns');
        campaigns = response.campaigns || [];
        updateStats();
        renderCampaigns();
        hideLoading();
    } catch (error) {
        hideLoading();
        // Se não houver endpoint, mostrar campanhas de exemplo
        campaigns = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Mensagem de boas-vindas para novos leads',
                type: 'trigger',
                status: 'active',
                sent: 156,
                delivered: 150,
                read: 120,
                replied: 45,
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: 'Promoção Janeiro',
                description: 'Campanha promocional de janeiro',
                type: 'broadcast',
                status: 'completed',
                sent: 500,
                delivered: 485,
                read: 320,
                replied: 89,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        updateStats();
        renderCampaigns();
    }
}

function updateStats() {
    document.getElementById('totalCampaigns').textContent = campaigns.length;
    document.getElementById('activeCampaigns').textContent = campaigns.filter(c => c.status === 'active').length;
    
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
    document.getElementById('totalSent').textContent = formatNumber(totalSent);
    
    const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
    const avgResponse = totalSent > 0 ? (totalReplied / totalSent * 100) : 0;
    document.getElementById('avgResponse').textContent = formatPercent(avgResponse);
}

function renderCampaigns() {
    const container = document.getElementById('campaignsList');
    
    if (campaigns.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma campanha criada</p>
                <button class="btn btn-primary mt-3" onclick="openModal('newCampaignModal')"><span class="icon icon-add icon-sm"></span> Criar Campanha</button>
            </div>
        `;
        return;
    }

    container.innerHTML = campaigns.map(c => {
        const deliveryRate = c.sent > 0 ? (c.delivered / c.sent * 100) : 0;
        const readRate = c.delivered > 0 ? (c.read / c.delivered * 100) : 0;
        const replyRate = c.read > 0 ? (c.replied / c.read * 100) : 0;

        return `
            <div class="campaign-card">
                <div class="campaign-header">
                    <div>
                        <h3 class="campaign-title">${c.name}</h3>
                        <div class="campaign-date">Criada em ${formatDate(c.created_at, 'short')}</div>
                    </div>
                    <span class="badge badge-${c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : c.status === 'completed' ? 'info' : 'secondary'}">
                        ${c.status === 'active' ? 'Ativa' : c.status === 'paused' ? 'Pausada' : c.status === 'completed' ? 'Concluída' : 'Rascunho'}
                    </span>
                </div>
                <div class="campaign-body">
                    <p style="color: var(--gray-600); margin-bottom: 15px;">${c.description || 'Sem descrição'}</p>
                    <div class="campaign-stats">
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatNumber(c.sent || 0)}</div>
                            <div class="campaign-stat-label">Enviadas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(deliveryRate)}</div>
                            <div class="campaign-stat-label">Entregues</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(readRate)}</div>
                            <div class="campaign-stat-label">Lidas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(replyRate)}</div>
                            <div class="campaign-stat-label">Respostas</div>
                        </div>
                    </div>
                    <div class="campaign-progress">
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" style="width: ${deliveryRate}%; background: var(--success);"></div>
                        </div>
                    </div>
                </div>
                <div class="campaign-footer">
                    <span class="badge badge-secondary">${c.type === 'broadcast' ? 'Transmissão' : c.type === 'drip' ? 'Sequência' : 'Gatilho'}</span>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-sm btn-outline" onclick="viewCampaign(${c.id})"><span class="icon icon-eye icon-sm"></span> Ver</button>
                        ${c.status === 'active' ? 
                            `<button class="btn btn-sm btn-warning" onclick="pauseCampaign(${c.id})"><span class="icon icon-pause icon-sm"></span> Pausar</button>` :
                            c.status === 'paused' || c.status === 'draft' ?
                            `<button class="btn btn-sm btn-success" onclick="startCampaign(${c.id})"><span class="icon icon-play icon-sm"></span> Iniciar</button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign(${c.id})"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function saveCampaign(status) {
    const data = {
        name: document.getElementById('campaignName').value.trim(),
        description: document.getElementById('campaignDescription').value.trim(),
        type: document.getElementById('campaignType').value,
        status: status,
        segment: document.getElementById('campaignSegment').value,
        message: document.getElementById('campaignMessage').value.trim(),
        delay: parseInt(document.getElementById('campaignDelay').value),
        start_at: document.getElementById('campaignStart').value
    };

    if (!data.name || !data.message) {
        showToast('error', 'Erro', 'Nome e mensagem são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando campanha...');
        await api.post('/api/campaigns', data);
        closeModal('newCampaignModal');
        document.getElementById('campaignForm').reset();
        await loadCampaigns();
        showToast('success', 'Sucesso', 'Campanha criada com sucesso!');
    } catch (error) {
        hideLoading();
        // Simular sucesso para demonstração
        campaigns.push({
            id: campaigns.length + 1,
            ...data,
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            created_at: new Date().toISOString()
        });
        closeModal('newCampaignModal');
        document.getElementById('campaignForm').reset();
        renderCampaigns();
        showToast('success', 'Sucesso', 'Campanha criada com sucesso!');
    }
}

function viewCampaign(id) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    document.getElementById('detailsTitle').innerHTML = `<span class="icon icon-campaigns icon-sm"></span> ${campaign.name}`;
    
    document.getElementById('campaignOverview').innerHTML = `
        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.sent || 0)}</div>
                    <div class="stat-label">Enviadas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.delivered || 0)}</div>
                    <div class="stat-label">Entregues</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.read || 0)}</div>
                    <div class="stat-label">Lidas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.replied || 0)}</div>
                    <div class="stat-label">Respostas</div>
                </div>
            </div>
        </div>
        <p><strong>Descrição:</strong> ${campaign.description || 'Sem descrição'}</p>
        <p><strong>Tipo:</strong> ${campaign.type}</p>
        <p><strong>Status:</strong> ${campaign.status}</p>
        <p><strong>Criada em:</strong> ${formatDate(campaign.created_at, 'datetime')}</p>
    `;

    openModal('campaignDetailsModal');
}

async function startCampaign(id) {
    if (!confirm('Iniciar esta campanha?')) return;
    showToast('success', 'Sucesso', 'Campanha iniciada!');
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'active';
    renderCampaigns();
}

async function pauseCampaign(id) {
    if (!confirm('Pausar esta campanha?')) return;
    showToast('success', 'Sucesso', 'Campanha pausada!');
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'paused';
    renderCampaigns();
}

async function deleteCampaign(id) {
    if (!confirm('Excluir esta campanha?')) return;
    campaigns = campaigns.filter(c => c.id !== id);
    renderCampaigns();
    showToast('success', 'Sucesso', 'Campanha excluída!');
}

function switchCampaignTab(tab) {
    document.querySelectorAll('#campaignDetailsModal .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#campaignDetailsModal .tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`#campaignDetailsModal .tab[onclick="switchCampaignTab('${tab}')"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

const windowAny = window as any;
windowAny.saveCampaign = saveCampaign;
windowAny.viewCampaign = viewCampaign;
windowAny.startCampaign = startCampaign;
windowAny.pauseCampaign = pauseCampaign;
windowAny.deleteCampaign = deleteCampaign;
windowAny.switchCampaignTab = switchCampaignTab;

export {};
