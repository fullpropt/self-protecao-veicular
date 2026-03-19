const express = require('express');

function createLeadReadRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const sanitizeSessionId = options.sanitizeSessionId;
    const getScopedUserId = options.getScopedUserId;
    const Lead = options.Lead;
    const canAccessLeadRecordInOwnerScope = options.canAccessLeadRecordInOwnerScope;

    router.get('/api/leads/summary', authenticate, async (req, res) => {
        try {
            const { assigned_to } = req.query;
            const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const requestedAssignedTo = assigned_to ? parseInt(assigned_to, 10) : undefined;
            const resolvedAssignedTo = scopedUserId || requestedAssignedTo;

            const summary = await Lead.summary({
                assigned_to: resolvedAssignedTo,
                owner_user_id: ownerScopeUserId || undefined,
                session_id: sessionId || undefined
            });

            return res.json({ success: true, ...summary });
        } catch (error) {
            console.error('Falha ao carregar resumo de leads:', error);
            return res.status(500).json({ success: false, error: 'Erro ao carregar resumo de leads' });
        }
    });

    router.get('/api/leads', authenticate, async (req, res) => {
        try {
            const { status, search, limit, offset, assigned_to } = req.query;
            const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const requestedAssignedTo = assigned_to ? parseInt(assigned_to, 10) : undefined;
            const resolvedAssignedTo = scopedUserId || requestedAssignedTo;

            const leads = await Lead.list({
                status: status ? parseInt(status) : undefined,
                search,
                assigned_to: resolvedAssignedTo,
                owner_user_id: ownerScopeUserId || undefined,
                session_id: sessionId || undefined,
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            });

            const total = await Lead.count({
                status: status ? parseInt(status) : undefined,
                assigned_to: resolvedAssignedTo,
                owner_user_id: ownerScopeUserId || undefined,
                session_id: sessionId || undefined
            });

            return res.json({ success: true, leads, total });
        } catch (error) {
            console.error('Falha ao listar leads:', error);
            return res.status(500).json({ success: false, error: 'Erro ao listar leads' });
        }
    });

    router.get('/api/leads/:id', authenticate, async (req, res) => {
        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
        }

        if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
            return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
        }

        return res.json({ success: true, lead });
    });

    return router;
}

module.exports = {
    createLeadReadRoutes
};
