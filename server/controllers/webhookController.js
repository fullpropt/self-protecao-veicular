function createWebhookController(options = {}) {
    const Webhook = options.Webhook;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const getScopedUserId = options.getScopedUserId;
    const getRequesterUserId = options.getRequesterUserId;
    const getRequesterRole = options.getRequesterRole;
    const isUserAdminRole = options.isUserAdminRole;
    const IncomingWebhookCredential = options.IncomingWebhookCredential;
    const resolveIncomingWebhookOwnerUserId = options.resolveIncomingWebhookOwnerUserId;
    const normalizeIncomingWebhookSecret = options.normalizeIncomingWebhookSecret;
    const serializeIncomingWebhookCredentialForApi = options.serializeIncomingWebhookCredentialForApi;
    const resolveIncomingWebhookOwnerContext = options.resolveIncomingWebhookOwnerContext;
    const normalizeIncomingWebhookLeadPayload = options.normalizeIncomingWebhookLeadPayload;
    const Lead = options.Lead;

    return {
        async listWebhooks(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const scopedUserId = getScopedUserId(req);
            const webhooks = await Webhook.list({
                owner_user_id: ownerScopeUserId || undefined,
                created_by: scopedUserId || undefined
            });

            return res.json({ success: true, webhooks });
        },

        async createWebhook(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const scopedUserId = getScopedUserId(req);
            const requesterUserId = getRequesterUserId(req);
            const result = await Webhook.create({
                ...(req.body && typeof req.body === 'object' ? req.body : {}),
                created_by: requesterUserId || undefined
            });

            const webhook = await Webhook.findById(result.id, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: scopedUserId || undefined
            });

            return res.json({ success: true, webhook });
        },

        async updateWebhook(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const scopedUserId = getScopedUserId(req);
            const webhook = await Webhook.update(req.params.id, req.body, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: scopedUserId || undefined
            });

            if (!webhook) {
                return res.status(404).json({ error: 'Webhook nao encontrado' });
            }

            return res.json({ success: true, webhook });
        },

        async deleteWebhook(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const scopedUserId = getScopedUserId(req);
            const deleted = await Webhook.delete(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: scopedUserId || undefined
            });

            if (!deleted) {
                return res.status(404).json({ error: 'Webhook nao encontrado' });
            }

            return res.json({ success: true });
        },

        async getIncomingWebhookCredential(req, res) {
            try {
                const requesterRole = getRequesterRole(req);
                if (!isUserAdminRole(requesterRole)) {
                    return res.status(403).json({ error: 'Sem permissao para gerenciar webhook de entrada' });
                }

                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                if (!ownerScopeUserId) {
                    return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
                }

                const credential = await IncomingWebhookCredential.findByOwnerUserId(ownerScopeUserId);
                const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();
                const legacySecretConfigured = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET).length > 0;

                return res.json({
                    success: true,
                    credential: serializeIncomingWebhookCredentialForApi(credential),
                    legacy_fallback: {
                        configured: legacySecretConfigured && !!legacyOwnerUserId,
                        owner_user_id: legacyOwnerUserId || null,
                        active_for_owner: legacySecretConfigured
                            && !!legacyOwnerUserId
                            && legacyOwnerUserId === ownerScopeUserId
                    }
                });
            } catch (error) {
                console.error('[IncomingWebhook] Falha ao consultar credencial:', error);
                return res.status(500).json({ error: 'Falha ao consultar credencial do webhook de entrada' });
            }
        },

        async regenerateIncomingWebhookCredential(req, res) {
            try {
                const requesterRole = getRequesterRole(req);
                if (!isUserAdminRole(requesterRole)) {
                    return res.status(403).json({ error: 'Sem permissao para gerenciar webhook de entrada' });
                }

                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                if (!ownerScopeUserId) {
                    return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
                }

                const incomingBody = req.body && typeof req.body === 'object' ? req.body : {};
                const requestedSecret = normalizeIncomingWebhookSecret(incomingBody.secret);
                if (
                    requestedSecret
                    && !IncomingWebhookCredential.isValidSecret(requestedSecret)
                ) {
                    return res.status(400).json({
                        error: `Secret invalido (minimo ${IncomingWebhookCredential.MIN_SECRET_LENGTH} caracteres)`
                    });
                }

                const result = await IncomingWebhookCredential.upsertForOwner(ownerScopeUserId, {
                    secret: requestedSecret || undefined,
                    created_by: getRequesterUserId(req) || undefined
                });

                return res.json({
                    success: true,
                    secret: result.secret,
                    credential: serializeIncomingWebhookCredentialForApi(result.credential)
                });
            } catch (error) {
                console.error('[IncomingWebhook] Falha ao regenerar credencial:', error);
                return res.status(400).json({ error: error.message || 'Falha ao regenerar credencial do webhook de entrada' });
            }
        },

        async handleIncomingWebhook(req, res) {
            const payload = req.body && typeof req.body === 'object' ? req.body : {};
            const event = String(payload.event || '').trim().toLowerCase();
            const data = payload.data;
            const ownerContext = await resolveIncomingWebhookOwnerContext(req, payload);
            if (!ownerContext.ownerUserId) {
                if (ownerContext.source === 'lookup-error') {
                    return res.status(503).json({ error: 'Webhook incoming indisponivel' });
                }
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (event === 'lead.create' && data) {
                try {
                    const ownerUserId = ownerContext.ownerUserId;
                    const leadPayload = normalizeIncomingWebhookLeadPayload(data, ownerUserId);
                    if (!leadPayload.phone) {
                        return res.status(400).json({ error: 'Telefone obrigatorio para lead.create' });
                    }

                    const result = await Lead.create(leadPayload);
                    return res.json({ success: true, leadId: result.id });
                } catch (error) {
                    return res.status(Number(error?.statusCode || 400) || 400).json({
                        error: error.message,
                        ...(error?.code ? { code: error.code } : {})
                    });
                }
            }

            return res.json({ success: true, received: true });
        }
    };
}

module.exports = {
    createWebhookController
};
