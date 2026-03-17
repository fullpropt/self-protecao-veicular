function createWebhookController(options = {}) {
    const Webhook = options.Webhook;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const getScopedUserId = options.getScopedUserId;
    const getRequesterUserId = options.getRequesterUserId;

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
        }
    };
}

module.exports = {
    createWebhookController
};
