function createFlowController(options = {}) {
    const Flow = options.Flow;
    const Settings = options.Settings;
    const aiFlowDraftService = options.aiFlowDraftService;
    const openAiFlowDraftService = options.openAiFlowDraftService;
    const buildScopedSettingsKey = options.buildScopedSettingsKey;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const sanitizeSessionId = options.sanitizeSessionId;
    const canAccessSessionRecordInOwnerScope = options.canAccessSessionRecordInOwnerScope;
    const canAccessCreatedRecord = options.canAccessCreatedRecord;

    async function resolveFlowSessionScopePayload(req, ownerScopeUserId = null) {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const hasSessionField = Object.prototype.hasOwnProperty.call(body, 'session_id')
            || Object.prototype.hasOwnProperty.call(body, 'sessionId');

        if (!hasSessionField) {
            return { provided: false, sessionId: null };
        }

        const rawSessionId = body.session_id ?? body.sessionId;
        const normalizedSessionId = sanitizeSessionId(rawSessionId);
        if (!normalizedSessionId) {
            return { provided: true, sessionId: null };
        }

        const canAccessSession = await canAccessSessionRecordInOwnerScope(req, normalizedSessionId, ownerScopeUserId);
        if (!canAccessSession) {
            return {
                provided: true,
                sessionId: null,
                error: 'Conta WhatsApp nao encontrada ou sem permissao'
            };
        }

        return { provided: true, sessionId: normalizedSessionId };
    }

    return {
        async generateAiFlowDraft(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const prompt = String(req.body?.prompt || '').trim();
                const preset = String(req.body?.preset || '').trim();

                if (!prompt) {
                    return res.status(400).json({ success: false, error: 'Prompt e obrigatorio' });
                }

                if (prompt.length > 5000) {
                    return res.status(400).json({ success: false, error: 'Prompt muito longo (maximo 5000 caracteres)' });
                }

                const aiSettingsKey = buildScopedSettingsKey('ai_assistant', ownerScopeUserId);
                const aiSettings = await Settings.get(aiSettingsKey);
                const normalizedAiConfig = aiFlowDraftService.normalizeAiConfig(aiSettings || {});
                const aiConfigHasEnabledFlag = Boolean(
                    aiSettings
                    && typeof aiSettings === 'object'
                    && !Array.isArray(aiSettings)
                    && Object.prototype.hasOwnProperty.call(aiSettings, 'enabled')
                );

                if (aiConfigHasEnabledFlag && !normalizedAiConfig.enabled) {
                    return res.status(403).json({
                        success: false,
                        error: 'Ative a Inteligencia Artificial em Configuracoes para gerar fluxos.'
                    });
                }

                const generated = await openAiFlowDraftService.generateFlowDraft({
                    prompt,
                    preset: preset || null,
                    businessContext: normalizedAiConfig
                });

                return res.json({
                    success: true,
                    provider: generated.provider || 'openai',
                    intent: generated.intent || null,
                    context: generated.context || {},
                    draft: generated.draft || null
                });
            } catch (error) {
                console.error('Falha ao gerar rascunho de fluxo por IA:', error);
                const statusCode = Number(error?.statusCode) || 500;
                return res.status(statusCode).json({
                    success: false,
                    error: error?.publicMessage || error?.message || 'Erro ao gerar fluxo com IA'
                });
            }
        },

        async listFlows(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const requestedSessionId = sanitizeSessionId(req.query?.session_id || req.query?.sessionId);
            if (requestedSessionId) {
                const canAccessSession = await canAccessSessionRecordInOwnerScope(req, requestedSessionId, ownerScopeUserId);
                if (!canAccessSession) {
                    return res.status(403).json({ error: 'Sem permissao para acessar esta conta WhatsApp' });
                }
            }

            const flows = await Flow.list({
                ...req.query,
                session_id: requestedSessionId || undefined,
                owner_user_id: ownerScopeUserId || undefined
            });

            return res.json({ success: true, flows });
        },

        async getFlowById(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const flow = await Flow.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            if (!flow) {
                return res.status(404).json({ error: 'Fluxo nÃ£o encontrado' });
            }

            if (!canAccessCreatedRecord(req, flow.created_by)) {
                return res.status(404).json({ error: 'Fluxo nÃ£o encontrado' });
            }

            return res.json({ success: true, flow });
        },

        async createFlow(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const flowSessionScope = await resolveFlowSessionScopePayload(req, ownerScopeUserId);
            if (flowSessionScope.error) {
                return res.status(403).json({ error: flowSessionScope.error });
            }
            const payload = {
                ...req.body,
                created_by: req.user?.id,
                owner_user_id: ownerScopeUserId || undefined,
                session_id: flowSessionScope.provided ? flowSessionScope.sessionId : null
            };
            delete payload.sessionId;
            const triggerType = String(payload?.trigger_type || '').trim().toLowerCase();
            if (triggerType === 'webhook') {
                return res.status(400).json({
                    error: 'Trigger webhook ainda nao esta disponivel por HTTP. Use new_contact, keyword ou manual.'
                });
            }
            const result = await Flow.create(payload);

            const flow = await Flow.findById(result.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            return res.json({
                success: true,
                flow,
                meta: {
                    deactivated_flow_ids: Array.isArray(result?.deactivated_flow_ids) ? result.deactivated_flow_ids : []
                }
            });
        },

        async updateFlow(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const existing = await Flow.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });
            if (!existing) {
                return res.status(404).json({ error: 'Fluxo nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para editar este fluxo' });
            }

            const flowSessionScope = await resolveFlowSessionScopePayload(req, ownerScopeUserId);
            if (flowSessionScope.error) {
                return res.status(403).json({ error: flowSessionScope.error });
            }
            const payload = {
                ...req.body
            };
            payload.owner_user_id = ownerScopeUserId || undefined;
            if (flowSessionScope.provided) {
                payload.session_id = flowSessionScope.sessionId;
            }
            delete payload.sessionId;
            if (Object.prototype.hasOwnProperty.call(payload, 'trigger_type')) {
                const triggerType = String(payload?.trigger_type || '').trim().toLowerCase();
                if (triggerType === 'webhook') {
                    return res.status(400).json({
                        error: 'Trigger webhook ainda nao esta disponivel por HTTP. Use new_contact, keyword ou manual.'
                    });
                }
            }

            const updateResult = await Flow.update(req.params.id, payload);

            const flow = await Flow.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });

            return res.json({
                success: true,
                flow,
                meta: {
                    deactivated_flow_ids: Array.isArray(updateResult?.deactivated_flow_ids) ? updateResult.deactivated_flow_ids : []
                }
            });
        },

        async deleteFlow(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const existing = await Flow.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined
            });
            if (!existing) {
                return res.status(404).json({ error: 'Fluxo nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para remover este fluxo' });
            }

            await Flow.delete(req.params.id);

            return res.json({ success: true });
        }
    };
}

module.exports = {
    createFlowController
};
