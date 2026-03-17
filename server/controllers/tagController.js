function createTagController(options = {}) {
    const Tag = options.Tag;
    const query = options.query;
    const run = options.run;
    const normalizeOwnerUserId = options.normalizeOwnerUserId;
    const normalizeCampaignTag = options.normalizeCampaignTag;
    const normalizeCampaignTagLabel = options.normalizeCampaignTagLabel;
    const parseCampaignTagFilters = options.parseCampaignTagFilters;
    const normalizeCampaignTagFilterInput = options.normalizeCampaignTagFilterInput;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const getRequesterUserId = options.getRequesterUserId;
    const normalizeTagNameInput = options.normalizeTagNameInput;
    const normalizeTagColorInput = options.normalizeTagColorInput;
    const normalizeTagDescriptionInput = options.normalizeTagDescriptionInput;

    async function listCampaignsWithTagFilterInScope(ownerScopeUserId = null) {
        const normalizedOwnerScopeUserId = normalizeOwnerUserId(ownerScopeUserId);
        const params = [];
        let sql = `
        SELECT c.id, c.tag_filter
        FROM campaigns c
        WHERE c.tag_filter IS NOT NULL
          AND TRIM(c.tag_filter) <> ''
    `;

        if (normalizedOwnerScopeUserId) {
            sql += `
          AND (
              c.created_by = ?
              OR EXISTS (
                  SELECT 1
                  FROM users owner_scope
                  WHERE owner_scope.id = c.created_by
                    AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
              )
          )
        `;
            params.push(normalizedOwnerScopeUserId, normalizedOwnerScopeUserId, normalizedOwnerScopeUserId);
        }

        return await query(sql, params);
    }

    async function rewriteCampaignTagFiltersByTagName(currentTagName, nextTagName = null, ownerScopeUserId = null) {
        const currentTagKey = normalizeCampaignTag(currentTagName);
        if (!currentTagKey) return;

        const normalizedNextTagName = normalizeCampaignTagLabel(nextTagName);
        const campaigns = await listCampaignsWithTagFilterInScope(ownerScopeUserId);

        for (const campaign of campaigns || []) {
            const existingFilters = parseCampaignTagFilters(campaign?.tag_filter);
            if (!existingFilters.length) continue;

            let hasChanges = false;
            const seen = new Set();
            const nextFilters = [];

            for (const tagName of existingFilters) {
                const tagKey = normalizeCampaignTag(tagName);
                if (!tagKey) continue;

                if (tagKey === currentTagKey) {
                    hasChanges = true;
                    if (normalizedNextTagName) {
                        const normalizedNextTagKey = normalizeCampaignTag(normalizedNextTagName);
                        if (normalizedNextTagKey && !seen.has(normalizedNextTagKey)) {
                            seen.add(normalizedNextTagKey);
                            nextFilters.push(normalizedNextTagName);
                        }
                    }
                    continue;
                }

                if (seen.has(tagKey)) continue;
                seen.add(tagKey);
                nextFilters.push(tagName);
            }

            if (!hasChanges) continue;

            await run(
                `UPDATE campaigns
             SET tag_filter = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
                [normalizeCampaignTagFilterInput(nextFilters), campaign.id]
            );
        }
    }

    return {
        async listTags(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const tagScope = {
                    owner_user_id: ownerScopeUserId || undefined
                };

                try {
                    await Tag.syncFromLeads(tagScope);
                } catch (syncError) {
                    console.warn('Falha ao sincronizar tags a partir dos leads:', syncError);
                }
                const tags = await Tag.list(tagScope);
                return res.json({ success: true, tags });
            } catch (error) {
                console.error('Falha ao listar tags:', error);
                return res.status(500).json({ success: false, error: 'Erro ao carregar tags' });
            }
        },

        async createTag(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const requesterUserId = getRequesterUserId(req);
                const tagScope = {
                    owner_user_id: ownerScopeUserId || undefined
                };
                const name = normalizeTagNameInput(req.body?.name);
                const color = normalizeTagColorInput(req.body?.color);
                const description = normalizeTagDescriptionInput(req.body?.description);

                if (!name) {
                    return res.status(400).json({ success: false, error: 'Nome da tag Ã© obrigatÃ³rio' });
                }

                const existing = await Tag.findByName(name, tagScope);
                if (existing) {
                    return res.status(409).json({ success: false, error: 'JÃ¡ existe uma tag com este nome' });
                }

                const tag = await Tag.create(
                    { name, color, description, created_by: requesterUserId || undefined },
                    { ...tagScope, created_by: requesterUserId || undefined }
                );
                return res.status(201).json({ success: true, tag });
            } catch (error) {
                console.error('Falha ao criar tag:', error);
                return res.status(500).json({ success: false, error: 'Erro ao criar tag' });
            }
        },

        async updateTag(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const tagScope = {
                    owner_user_id: ownerScopeUserId || undefined
                };
                const tagId = parseInt(req.params.id, 10);
                if (!Number.isInteger(tagId) || tagId <= 0) {
                    return res.status(400).json({ success: false, error: 'ID de tag invÃ¡lido' });
                }

                const currentTag = await Tag.findById(tagId, tagScope);
                if (!currentTag) {
                    return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
                }

                const payload = {};
                if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
                    const nextName = normalizeTagNameInput(req.body.name);
                    if (!nextName) {
                        return res.status(400).json({ success: false, error: 'Nome da tag Ã© obrigatÃ³rio' });
                    }

                    const duplicate = await Tag.findByName(nextName, tagScope);
                    if (duplicate && Number(duplicate.id) !== tagId) {
                        return res.status(409).json({ success: false, error: 'JÃ¡ existe uma tag com este nome' });
                    }
                    payload.name = nextName;
                }
                if (Object.prototype.hasOwnProperty.call(req.body, 'color')) {
                    payload.color = normalizeTagColorInput(req.body.color);
                }
                if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
                    payload.description = normalizeTagDescriptionInput(req.body.description);
                }

                const updatedTag = await Tag.update(tagId, payload, tagScope);
                if (!updatedTag) {
                    return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
                }

                if (
                    payload.name
                    && normalizeTagNameInput(currentTag.name).toLowerCase() !== normalizeTagNameInput(updatedTag.name).toLowerCase()
                ) {
                    await Tag.renameInLeads(currentTag.name, updatedTag.name, tagScope);
                    await rewriteCampaignTagFiltersByTagName(currentTag.name, updatedTag.name, ownerScopeUserId || null);
                }

                return res.json({ success: true, tag: updatedTag });
            } catch (error) {
                console.error('Falha ao atualizar tag:', error);
                return res.status(500).json({ success: false, error: 'Erro ao atualizar tag' });
            }
        },

        async deleteTag(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const tagScope = {
                    owner_user_id: ownerScopeUserId || undefined
                };
                const tagId = parseInt(req.params.id, 10);
                if (!Number.isInteger(tagId) || tagId <= 0) {
                    return res.status(400).json({ success: false, error: 'ID de tag invÃ¡lido' });
                }

                const currentTag = await Tag.findById(tagId, tagScope);
                if (!currentTag) {
                    return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
                }

                const deleted = await Tag.delete(tagId, tagScope);
                if (!deleted) {
                    return res.status(404).json({ success: false, error: 'Tag nao encontrada' });
                }

                await Tag.removeFromLeads(currentTag.name, tagScope);
                await rewriteCampaignTagFiltersByTagName(currentTag.name, null, ownerScopeUserId || null);

                return res.json({ success: true });
            } catch (error) {
                console.error('Falha ao remover tag:', error);
                return res.status(500).json({ success: false, error: 'Erro ao remover tag' });
            }
        }
    };
}

module.exports = {
    createTagController
};
