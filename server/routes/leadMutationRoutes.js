const express = require('express');

function createLeadMutationRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const Lead = options.Lead;
    const canAccessLeadRecordInOwnerScope = options.canAccessLeadRecordInOwnerScope;
    const normalizeAutomationStatus = options.normalizeAutomationStatus;
    const normalizeLeadStatus = options.normalizeLeadStatus;
    const LEAD_STATUS_VALUES = options.LEAD_STATUS_VALUES;
    const sanitizeAutoName = options.sanitizeAutoName;
    const lockLeadNameAsManual = options.lockLeadNameAsManual;
    const mergeLeadCustomFields = options.mergeLeadCustomFields;
    const webhookService = options.webhookService;
    const sanitizeSessionId = options.sanitizeSessionId;
    const Conversation = options.Conversation;
    const scheduleAutomations = options.scheduleAutomations;
    const AUTOMATION_EVENT_TYPES = options.AUTOMATION_EVENT_TYPES;
    const DEFAULT_AUTOMATION_SESSION_ID = options.DEFAULT_AUTOMATION_SESSION_ID;

    router.put('/api/leads/:id', authenticate, async (req, res) => {
        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
        }

        if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
            return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
        }

        const oldStatus = normalizeAutomationStatus(lead.status);
        const updateData = { ...req.body };

        if (Object.prototype.hasOwnProperty.call(updateData, 'status')) {
            const normalizedStatus = normalizeLeadStatus(updateData.status, null);
            if (normalizedStatus === null) {
                return res.status(400).json({
                    error: `Status invalido. Use ${LEAD_STATUS_VALUES.join(', ')}.`
                });
            }
            updateData.status = normalizedStatus;
        }

        if (Object.prototype.hasOwnProperty.call(updateData, 'name')) {
            const manualName = sanitizeAutoName(updateData.name);
            if (manualName) {
                updateData.name = manualName;
                updateData.custom_fields = lockLeadNameAsManual(
                    mergeLeadCustomFields(lead.custom_fields, updateData.custom_fields),
                    manualName
                );
            } else {
                delete updateData.name;
            }
        }

        await Lead.update(req.params.id, updateData);

        const updatedLead = await Lead.findById(req.params.id);

        webhookService.trigger('lead.updated', { lead: updatedLead }, {
            ownerUserId: Number(updatedLead?.owner_user_id || 0) || undefined
        });

        const hasStatusInPayload = Object.prototype.hasOwnProperty.call(updateData, 'status');
        const newStatus = hasStatusInPayload
            ? normalizeAutomationStatus(updateData.status)
            : oldStatus;
        const statusChanged = oldStatus !== null && newStatus !== null && oldStatus !== newStatus;

        if (statusChanged) {
            webhookService.trigger('lead.status_changed', {
                lead: updatedLead,
                oldStatus,
                newStatus
            }, {
                ownerUserId: Number(updatedLead?.owner_user_id || 0) || undefined
            });

            const statusSessionId = sanitizeSessionId(
                req.body?.session_id || req.body?.sessionId || req.query?.session_id || req.query?.sessionId
            );
            const statusConversation = await Conversation.findByLeadId(updatedLead.id, statusSessionId || null);
            await scheduleAutomations({
                event: AUTOMATION_EVENT_TYPES.STATUS_CHANGE,
                sessionId: statusConversation?.session_id || statusSessionId || DEFAULT_AUTOMATION_SESSION_ID,
                lead: updatedLead,
                conversation: statusConversation || null,
                oldStatus,
                newStatus,
                text: ''
            });
        }

        return res.json({ success: true, lead: updatedLead });
    });

    router.delete('/api/leads/:id', authenticate, async (req, res) => {
        try {
            const leadId = parseInt(req.params.id, 10);
            if (!Number.isInteger(leadId) || leadId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de lead invalido'
                });
            }

            const lead = await Lead.findById(leadId);
            if (!lead) {
                return res.status(404).json({
                    success: false,
                    error: 'Lead nao encontrado'
                });
            }

            if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
                return res.status(404).json({
                    success: false,
                    error: 'Lead nao encontrado'
                });
            }

            await Lead.delete(leadId);

            return res.json({ success: true });
        } catch (error) {
            console.error('Falha ao excluir lead:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Erro ao excluir lead'
            });
        }
    });

    return router;
}

module.exports = {
    createLeadMutationRoutes
};
