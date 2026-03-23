function createTemplateController(options = {}) {
    const Template = options.Template;
    const getScopedUserId = options.getScopedUserId;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const canAccessCreatedRecord = options.canAccessCreatedRecord;

    return {
        async listTemplates(req, res) {
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const templates = await Template.list({
                ...req.query,
                owner_user_id: ownerScopeUserId || undefined,
                created_by: scopedUserId || undefined
            });

            return res.json({ success: true, templates });
        },

        async createTemplate(req, res) {
            const payload = {
                ...req.body,
                created_by: req.user?.id
            };
            const result = await Template.create(payload);

            const template = await Template.findById(result.id);

            return res.json({ success: true, template });
        },

        async updateTemplate(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const existing = await Template.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: getScopedUserId(req) || undefined
            });
            if (!existing) {
                return res.status(404).json({ error: 'Template nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para editar este template' });
            }

            await Template.update(req.params.id, req.body);

            const template = await Template.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: getScopedUserId(req) || undefined
            });

            return res.json({ success: true, template });
        },

        async deleteTemplate(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const existing = await Template.findById(req.params.id, {
                owner_user_id: ownerScopeUserId || undefined,
                created_by: getScopedUserId(req) || undefined
            });
            if (!existing) {
                return res.status(404).json({ error: 'Template nao encontrado' });
            }
            if (!canAccessCreatedRecord(req, existing.created_by)) {
                return res.status(403).json({ error: 'Sem permissao para remover este template' });
            }

            await Template.delete(req.params.id);

            return res.json({ success: true });
        }
    };
}

module.exports = {
    createTemplateController
};
