function createAutomationController(options = {}) {
    const Automation = options.Automation;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const canAccessCreatedRecord = options.canAccessCreatedRecord;
    const normalizeAutomationSessionScopeInput = options.normalizeAutomationSessionScopeInput;
    const normalizeAutomationTagFilterInput = options.normalizeAutomationTagFilterInput;
    const isSupportedAutomationTriggerType = options.isSupportedAutomationTriggerType;
    const enrichAutomationForResponse = options.enrichAutomationForResponse;

    return {
        async listAutomations(req, res) {
            const { is_active, trigger_type, limit, offset, search } = req.query;
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            const automations = await Automation.list({
                is_active: is_active !== undefined ? parseInt(is_active) : undefined,
                trigger_type,
                search,
                owner_user_id: ownerScopeUserId || undefined,
                limit: limit ? parseInt(limit) : 50,
                offset: offset ? parseInt(offset) : 0
            });

            return res.json({ success: true, automations: automations.map(enrichAutomationForResponse) });
        },

        async getAutomationById(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const automation = await Automation.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            if (!automation) {
                return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
            }

            if (!canAccessCreatedRecord(req, automation.created_by)) {
                return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
            }

            return res.json({ success: true, automation: enrichAutomationForResponse(automation) });
        },

        async createAutomation(req, res) {
            try {
                const payload = {
                    ...req.body,
                    created_by: req.user?.id
                };

                if (
                    Object.prototype.hasOwnProperty.call(payload, 'session_ids')
                    || Object.prototype.hasOwnProperty.call(payload, 'session_scope')
                ) {
                    payload.session_scope = normalizeAutomationSessionScopeInput(
                        Object.prototype.hasOwnProperty.call(payload, 'session_ids') ? payload.session_ids : payload.session_scope
                    );
                    delete payload.session_ids;
                }

                if (
                    Object.prototype.hasOwnProperty.call(payload, 'tag_filters')
                    || Object.prototype.hasOwnProperty.call(payload, 'tag_filter')
                ) {
                    payload.tag_filter = normalizeAutomationTagFilterInput(
                        Object.prototype.hasOwnProperty.call(payload, 'tag_filters') ? payload.tag_filters : payload.tag_filter
                    );
                    delete payload.tag_filters;
                }

                const triggerType = String(payload.trigger_type || '').trim().toLowerCase();
                if (!isSupportedAutomationTriggerType(triggerType)) {
                    return res.status(400).json({
                        error: 'Trigger de automacao invalido. Use new_lead, status_change, message_received, keyword, schedule ou inactivity.'
                    });
                }
                payload.trigger_type = triggerType;

                const result = await Automation.create(payload);
                const automation = await Automation.findById(result.id);

                return res.json({ success: true, automation: enrichAutomationForResponse(automation) });
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
        },

        async updateAutomation(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const automation = await Automation.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            if (!automation) {
                return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
            }

            if (!canAccessCreatedRecord(req, automation.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para editar esta automacao' });
            }

            const payload = {
                ...req.body
            };

            if (
                Object.prototype.hasOwnProperty.call(payload, 'session_ids')
                || Object.prototype.hasOwnProperty.call(payload, 'session_scope')
            ) {
                payload.session_scope = normalizeAutomationSessionScopeInput(
                    Object.prototype.hasOwnProperty.call(payload, 'session_ids') ? payload.session_ids : payload.session_scope
                );
                delete payload.session_ids;
            }

            if (
                Object.prototype.hasOwnProperty.call(payload, 'tag_filters')
                || Object.prototype.hasOwnProperty.call(payload, 'tag_filter')
            ) {
                payload.tag_filter = normalizeAutomationTagFilterInput(
                    Object.prototype.hasOwnProperty.call(payload, 'tag_filters') ? payload.tag_filters : payload.tag_filter
                );
                delete payload.tag_filters;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'trigger_type')) {
                const triggerType = String(payload.trigger_type || '').trim().toLowerCase();
                if (!isSupportedAutomationTriggerType(triggerType)) {
                    return res.status(400).json({
                        error: 'Trigger de automacao invalido. Use new_lead, status_change, message_received, keyword, schedule ou inactivity.'
                    });
                }
                payload.trigger_type = triggerType;
            }

            await Automation.update(req.params.id, payload);

            const updatedAutomation = await Automation.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            return res.json({ success: true, automation: enrichAutomationForResponse(updatedAutomation) });
        },

        async deleteAutomation(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const automation = await Automation.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            if (!automation) {
                return res.status(404).json({ error: 'Automacao nao encontrada' });
            }

            if (!canAccessCreatedRecord(req, automation.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para remover esta automacao' });
            }

            await Automation.delete(req.params.id);
            return res.json({ success: true });
        }
    };
}

module.exports = {
    createAutomationController
};
