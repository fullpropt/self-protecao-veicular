// @ts-nocheck
// Contatos page logic migrated to module

let allContacts = [];
let filteredContacts = [];
let selectedContacts = [];
let currentPage = 1;
const perPage = 20;
let tags = [];

document.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    loadTags();
    loadTemplates();
});

async function loadContacts() {
    try {
        showLoading('Carregando contatos...');
        const response = await api.get('/api/leads');
        allContacts = response.leads || [];
        filteredContacts = [...allContacts];
        updateStats();
        renderContacts();
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar os contatos');
    }
}

async function loadTags() {
    try {
        const response = await api.get('/api/tags');
        tags = response.tags || [];
        const select = document.getElementById('filterTag');
        tags.forEach(tag => {
            select.innerHTML += `<option value="${tag.id}">${tag.name}</option>`;
        });
    } catch (e) {}
}

async function loadTemplates() {
    try {
        const response = await api.get('/api/templates');
        const templates = response.templates || [];
        const select = document.getElementById('bulkTemplate');
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}" data-content="${encodeURIComponent(t.content)}">${t.name}</option>`;
        });
    } catch (e) {}
}

function loadTemplate() {
    const select = document.getElementById('bulkTemplate');
    const option = select.options[select.selectedIndex];
    if (option.dataset.content) {
        document.getElementById('bulkMessage').value = decodeURIComponent(option.dataset.content);
    }
}

function updateStats() {
    document.getElementById('totalContacts').textContent = formatNumber(allContacts.length);
    document.getElementById('activeContacts').textContent = formatNumber(allContacts.filter(c => c.status !== 4).length);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('newContacts').textContent = formatNumber(
        allContacts.filter(c => new Date(c.created_at) > weekAgo).length
    );
    document.getElementById('withWhatsapp').textContent = formatNumber(
        allContacts.filter(c => c.phone).length
    );
}

function renderContacts() {
    const tbody = document.getElementById('contactsTableBody');
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageContacts = filteredContacts.slice(start, end);

    if (pageContacts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty"><div class="table-empty-icon icon icon-empty icon-lg"></div><p>Nenhum contato encontrado</p></td></tr>`;
    } else {
        tbody.innerHTML = pageContacts.map(c => `
            <tr data-id="${c.id}">
                <td><label class="checkbox-wrapper"><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="updateSelection()"><span class="checkbox-custom"></span></label></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
                        <div>
                            <div style="font-weight: 600;">${c.name || 'Sem nome'}</div>
                            <div style="font-size: 12px; color: var(--gray-500);">${c.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td><a href="https://wa.me/55${c.phone}" target="_blank" style="color: var(--whatsapp);">${formatPhone(c.phone)}</a></td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${c.vehicle || '-'}</td>
                <td>${c.plate || '-'}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${c.tags || '-'}</td>
                <td>${c.last_message_at ? timeAgo(c.last_message_at) : '-'}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-whatsapp btn-icon" onclick="quickMessage(${c.id})" title="Mensagem"><span class="icon icon-message icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline btn-icon" onclick="editContact(${c.id})" title="Editar"><span class="icon icon-edit icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteContact(${c.id})" title="Excluir"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Paginação
    const total = filteredContacts.length;
    const totalPages = Math.ceil(total / perPage);
    document.getElementById('paginationInfo').textContent = `Mostrando ${start + 1}-${Math.min(end, total)} de ${total} contatos`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function changePage(delta) {
    currentPage += delta;
    renderContacts();
}

function filterContacts() {
    const search = document.getElementById('searchContacts').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    const tag = document.getElementById('filterTag').value;

    filteredContacts = allContacts.filter(c => {
        const matchSearch = !search || 
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search)) ||
            (c.vehicle && c.vehicle.toLowerCase().includes(search)) ||
            (c.plate && c.plate.toLowerCase().includes(search));
        const matchStatus = !status || c.status == status;
        const matchTag = !tag || (c.tags && c.tags.includes(tag));
        return matchSearch && matchStatus && matchTag;
    });

    currentPage = 1;
    renderContacts();
}

function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    document.querySelectorAll('.contact-checkbox').forEach(cb => cb.checked = checked);
    updateSelection();
}

function updateSelection() {
    selectedContacts = Array.from(document.querySelectorAll('.contact-checkbox:checked')).map(cb => parseInt(cb.value));
    document.getElementById('bulkActions').style.display = selectedContacts.length > 0 ? 'block' : 'none';
    document.getElementById('selectedCount').textContent = selectedContacts.length;
}

function clearSelection() {
    document.getElementById('selectAll').checked = false;
    document.querySelectorAll('.contact-checkbox').forEach(cb => cb.checked = false);
    updateSelection();
}

async function saveContact() {
    const data = {
        name: document.getElementById('contactName').value.trim(),
        phone: document.getElementById('contactPhone').value.replace(/\D/g, ''),
        vehicle: document.getElementById('contactVehicle').value.trim(),
        plate: document.getElementById('contactPlate').value.trim().toUpperCase(),
        email: document.getElementById('contactEmail').value.trim(),
        status: parseInt(document.getElementById('contactStatus').value),
        source: document.getElementById('contactSource').value
    };

    if (!data.name || !data.phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando...');
        await api.post('/api/leads', data);
        closeModal('addContactModal');
        document.getElementById('addContactForm').reset();
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato adicionado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message);
    }
}

function editContact(id) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    document.getElementById('editContactId').value = contact.id;
    document.getElementById('editContactName').value = contact.name || '';
    document.getElementById('editContactPhone').value = contact.phone || '';
    document.getElementById('editContactVehicle').value = contact.vehicle || '';
    document.getElementById('editContactPlate').value = contact.plate || '';
    document.getElementById('editContactEmail').value = contact.email || '';
    document.getElementById('editContactStatus').value = contact.status || 1;
    document.getElementById('editContactNotes').value = contact.notes || '';

    openModal('editContactModal');
}

async function updateContact() {
    const id = document.getElementById('editContactId').value;
    const data = {
        name: document.getElementById('editContactName').value.trim(),
        phone: document.getElementById('editContactPhone').value.replace(/\D/g, ''),
        vehicle: document.getElementById('editContactVehicle').value.trim(),
        plate: document.getElementById('editContactPlate').value.trim().toUpperCase(),
        email: document.getElementById('editContactEmail').value.trim(),
        status: parseInt(document.getElementById('editContactStatus').value)
    };

    try {
        showLoading('Salvando...');
        await api.put(`/api/leads/${id}`, data);
        closeModal('editContactModal');
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato atualizado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message);
    }
}

async function deleteContact(id) {
    if (!confirm('Excluir este contato?')) return;
    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato excluído!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message);
    }
}

function quickMessage(id) {
    const contact = allContacts.find(c => c.id === id);
    if (contact) {
        window.open(`https://wa.me/55${contact.phone}`, '_blank');
    }
}

function openWhatsApp() {
    const phone = document.getElementById('editContactPhone').value.replace(/\D/g, '');
    if (phone) {
        window.open(`https://wa.me/55${phone}`, '_blank');
    }
}

function bulkSendMessage() {
    document.getElementById('bulkRecipients').textContent = selectedContacts.length;
    openModal('bulkMessageModal');
}

async function sendBulkMessage() {
    const message = document.getElementById('bulkMessage').value.trim();
    const delay = parseInt(document.getElementById('bulkDelay').value);

    if (!message) {
        showToast('error', 'Erro', 'Digite uma mensagem');
        return;
    }

    if (APP.whatsappStatus !== 'connected') {
        showToast('error', 'Erro', 'WhatsApp não está conectado');
        return;
    }

    try {
        showLoading('Adicionando à fila...');
        
        const contacts = allContacts.filter(c => selectedContacts.includes(c.id));
        
        await api.post('/api/queue/bulk', {
            leadIds: selectedContacts,
            content: message,
            delay: delay
        });

        closeModal('bulkMessageModal');
        clearSelection();
        showToast('success', 'Sucesso', `${contacts.length} mensagens adicionadas à fila!`);
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message);
    }
}

async function bulkDelete() {
    if (!confirm(`Excluir ${selectedContacts.length} contatos?`)) return;
    
    try {
        showLoading('Excluindo...');
        for (const id of selectedContacts) {
            await api.delete(`/api/leads/${id}`);
        }
        clearSelection();
        await loadContacts();
        showToast('success', 'Sucesso', 'Contatos excluídos!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message);
    }
}

function bulkChangeStatus() {
    const status = prompt('Novo status (1=Novo, 2=Em Andamento, 3=Concluído, 4=Perdido):');
    if (!status || ![1,2,3,4].includes(parseInt(status))) return;
    
    // Implementar mudança em lote
    showToast('info', 'Info', 'Função em desenvolvimento');
}

function bulkAddTag() {
    showToast('info', 'Info', 'Função em desenvolvimento');
}

async function importContacts() {
    const fileInput = document.getElementById('importFile');
    const textInput = document.getElementById('importText').value.trim();
    const status = parseInt(document.getElementById('importStatus').value);

    let data = [];
    if (fileInput.files.length > 0) {
        const text = await fileInput.files[0].text();
        data = parseCSV(text);
    } else if (textInput) {
        data = parseCSV(textInput);
    }

    if (data.length === 0) {
        showToast('error', 'Erro', 'Nenhum dado válido');
        return;
    }

    try {
        showLoading(`Importando ${data.length} contatos...`);
        let imported = 0;
        
        for (const row of data) {
            const phone = (row.telefone || row.phone || '').replace(/\D/g, '');
            if (!phone) continue;
            
            try {
                await api.post('/api/leads', {
                    name: row.nome || row.name || 'Sem nome',
                    phone,
                    vehicle: row.veiculo || row.vehicle || '',
                    plate: row.placa || row.plate || '',
                    email: row.email || '',
                    status
                });
                imported++;
            } catch (e) {}
        }

        closeModal('importModal');
        await loadContacts();
        showToast('success', 'Sucesso', `${imported} contatos importados!`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Falha na importação');
    }
}

function exportContacts() {
    const data = filteredContacts.map(c => ({
        nome: c.name,
        telefone: c.phone,
        veiculo: c.vehicle,
        placa: c.plate,
        email: c.email,
        status: getStatusLabel(c.status)
    }));
    exportToCSV(data, `contatos_${formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`);
    showToast('success', 'Sucesso', 'Contatos exportados!');
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function getStatusLabel(status) {
    return LEAD_STATUS[status]?.label || 'Desconhecido';
}

const windowAny = window as any;
windowAny.changePage = changePage;
windowAny.filterContacts = filterContacts;
windowAny.toggleSelectAll = toggleSelectAll;
windowAny.updateSelection = updateSelection;
windowAny.clearSelection = clearSelection;
windowAny.saveContact = saveContact;
windowAny.editContact = editContact;
windowAny.updateContact = updateContact;
windowAny.deleteContact = deleteContact;
windowAny.quickMessage = quickMessage;
windowAny.openWhatsApp = openWhatsApp;
windowAny.bulkSendMessage = bulkSendMessage;
windowAny.sendBulkMessage = sendBulkMessage;
windowAny.bulkDelete = bulkDelete;
windowAny.bulkChangeStatus = bulkChangeStatus;
windowAny.bulkAddTag = bulkAddTag;
windowAny.importContacts = importContacts;
windowAny.exportContacts = exportContacts;
windowAny.switchTab = switchTab;
windowAny.loadTemplate = loadTemplate;

export {};
