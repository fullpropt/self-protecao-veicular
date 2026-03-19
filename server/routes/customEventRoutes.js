const express = require('express');

function parseBooleanInput(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function createCustomEventRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const CustomEvent = options.CustomEvent;
    const canAccessCreatedRecord = options.canAccessCreatedRecord;

    router.get('/api/custom-events', authenticate, async (req, res) => {
        try {
            const hasActiveFilter = Object.prototype.hasOwnProperty.call(req.query, 'active')
                || Object.prototype.hasOwnProperty.call(req.query, 'is_active');
            const activeRaw = req.query.active ?? req.query.is_active;
            const activeFilter = hasActiveFilter ? (parseBooleanInput(activeRaw, true) ? 1 : 0) : undefined;
            const search = String(req.query.search || '').trim();
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            const events = await CustomEvent.list({
                is_active: activeFilter,
                search,
                owner_user_id: ownerScopeUserId || undefined
            });

            return res.json({ success: true, events });
        } catch (error) {
            console.error('Falha ao listar eventos personalizados:', error);
            return res.status(500).json({ success: false, error: 'Erro ao carregar eventos personalizados' });
        }
    });

    router.post('/api/custom-events', authenticate, async (req, res) => {
        try {
            const name = String(req.body?.name || '').trim();
            if (!name) {
                return res.status(400).json({ success: false, error: 'Nome do evento e obrigatorio' });
            }
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            const created = await CustomEvent.create({
                name,
                description: req.body?.description,
                event_key: req.body?.event_key ?? req.body?.eventKey ?? req.body?.key,
                is_active: req.body?.is_active ?? req.body?.isActive ?? 1,
                created_by: req.user?.id || null
            });

            const event = await CustomEvent.findById(created.id, {
                owner_user_id: ownerScopeUserId || undefined
            });
            return res.status(201).json({ success: true, event });
        } catch (error) {
            const message = String(error?.message || '').trim();
            if (message.includes('Ja existe um evento com esta chave')) {
                return res.status(409).json({ success: false, error: message });
            }
            console.error('Falha ao criar evento personalizado:', error);
            return res.status(400).json({ success: false, error: message || 'Erro ao criar evento personalizado' });
        }
    });

    router.put('/api/custom-events/:id', authenticate, async (req, res) => {
        try {
            const eventId = parseInt(req.params.id, 10);
            if (!Number.isInteger(eventId) || eventId <= 0) {
                return res.status(400).json({ success: false, error: 'ID do evento invalido' });
            }
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            const existing = await CustomEvent.findById(eventId, {
                owner_user_id: ownerScopeUserId || undefined
            });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Evento nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ success: false, error: 'Sem permissao para editar este evento' });
            }

            const payload = {};
            if (Object.prototype.hasOwnProperty.call(req.body, 'name')) payload.name = req.body.name;
            if (Object.prototype.hasOwnProperty.call(req.body, 'description')) payload.description = req.body.description;
            if (
                Object.prototype.hasOwnProperty.call(req.body, 'event_key')
                || Object.prototype.hasOwnProperty.call(req.body, 'eventKey')
                || Object.prototype.hasOwnProperty.call(req.body, 'key')
            ) {
                payload.event_key = req.body.event_key ?? req.body.eventKey ?? req.body.key;
            }
            if (Object.prototype.hasOwnProperty.call(req.body, 'is_active') || Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
                payload.is_active = req.body.is_active ?? req.body.isActive;
            }

            await CustomEvent.update(eventId, payload);
            const event = await CustomEvent.findById(eventId, {
                owner_user_id: ownerScopeUserId || undefined
            });
            return res.json({ success: true, event });
        } catch (error) {
            const message = String(error?.message || '').trim();
            if (message.includes('Ja existe um evento com esta chave')) {
                return res.status(409).json({ success: false, error: message });
            }
            console.error('Falha ao atualizar evento personalizado:', error);
            return res.status(400).json({ success: false, error: message || 'Erro ao atualizar evento personalizado' });
        }
    });

    router.delete('/api/custom-events/:id', authenticate, async (req, res) => {
        try {
            const eventId = parseInt(req.params.id, 10);
            if (!Number.isInteger(eventId) || eventId <= 0) {
                return res.status(400).json({ success: false, error: 'ID do evento invalido' });
            }
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            const existing = await CustomEvent.findById(eventId, {
                owner_user_id: ownerScopeUserId || undefined
            });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Evento nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ success: false, error: 'Sem permissao para remover este evento' });
            }

            await CustomEvent.delete(eventId);
            return res.json({ success: true });
        } catch (error) {
            console.error('Falha ao remover evento personalizado:', error);
            return res.status(500).json({ success: false, error: 'Erro ao remover evento personalizado' });
        }
    });

    return router;
}

module.exports = {
    createCustomEventRoutes
};
