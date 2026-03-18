function createTagModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const parsePositiveInteger = options.parsePositiveInteger;
    const normalizeTagValue = options.normalizeTagValue;
    const normalizeTagKey = options.normalizeTagKey;
    const parseTagList = options.parseTagList;
    const uniqueTags = options.uniqueTags;

    const DEFAULT_TAG_COLOR = '#5a2a6b';
    let hasTagCreatedByColumnCache = null;

    async function tagsTableHasCreatedByColumn() {
        if (hasTagCreatedByColumnCache !== null) {
            return hasTagCreatedByColumnCache;
        }

        try {
            await queryOne('SELECT created_by FROM tags LIMIT 1');
            hasTagCreatedByColumnCache = true;
            return true;
        } catch (error) {
            const message = String(error?.message || '').toLowerCase();
            if (
                message.includes('no such column') ||
                message.includes('does not exist')
            ) {
                hasTagCreatedByColumnCache = false;
                return false;
            }
            throw error;
        }
    }

    function appendOwnerCreatedByFilters(filters, params, scopeOptions = {}, config = {}) {
        if (!Array.isArray(filters) || !Array.isArray(params)) {
            return { ownerUserId: null, createdBy: null };
        }

        const ownerUserId = parsePositiveInteger(scopeOptions?.owner_user_id, null);
        const createdBy = parsePositiveInteger(scopeOptions?.created_by, null);
        const tableAlias = normalizeTagValue(config?.tableAlias || '');
        const createdByColumn = normalizeTagValue(config?.createdByColumn || 'created_by') || 'created_by';
        const columnRef = tableAlias ? `${tableAlias}.${createdByColumn}` : createdByColumn;

        if (ownerUserId) {
            filters.push(`(
                ${columnRef} = ?
                OR EXISTS (
                    SELECT 1
                    FROM users owner_scope
                    WHERE owner_scope.id = ${columnRef}
                      AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                )
            )`);
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            filters.push(`${columnRef} = ?`);
            params.push(createdBy);
        }

        return { ownerUserId, createdBy };
    }

    function assertTagOwnerScopeReady(scopeOptions = {}, hasCreatedByColumn = false) {
        const ownerUserId = parsePositiveInteger(scopeOptions?.owner_user_id, null);
        if (ownerUserId && !hasCreatedByColumn) {
            const error = new Error('Schema de tags desatualizado: coluna tags.created_by ausente para escopo multi-tenant');
            error.code = 'TAGS_CREATED_BY_REQUIRED';
            throw error;
        }
    }

    async function ensureTagCreatedByColumnForScopedOps(scopeOptions = {}, hasCreatedByColumn = false) {
        if (hasCreatedByColumn) return true;

        const scopedOwnerUserId = parsePositiveInteger(scopeOptions?.owner_user_id ?? scopeOptions?.created_by, null);
        if (!scopedOwnerUserId) return hasCreatedByColumn;

        try {
            await run('ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)');
            hasTagCreatedByColumnCache = true;
            return true;
        } catch (_) {
            return hasCreatedByColumn;
        }
    }

    const model = {
        async list(scopeOptions = {}) {
            let hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            hasCreatedByColumn = await ensureTagCreatedByColumnForScopedOps(scopeOptions, hasCreatedByColumn);
            assertTagOwnerScopeReady(scopeOptions, hasCreatedByColumn);

            if (hasCreatedByColumn) {
                const filters = [];
                const params = [];
                appendOwnerCreatedByFilters(filters, params, scopeOptions, { tableAlias: 'tags' });

                const whereClause = filters.length > 0
                    ? `WHERE ${filters.join(' AND ')}`
                    : '';

                return await query(`
                    SELECT id, name, color, description, created_at, created_by
                    FROM tags
                    ${whereClause}
                    ORDER BY LOWER(name) ASC, id ASC
                `, params);
            }

            return await query(`
                SELECT id, name, color, description, created_at
                FROM tags
                ORDER BY LOWER(name) ASC, id ASC
            `);
        },

        async findById(id, scopeOptions = {}) {
            let hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            hasCreatedByColumn = await ensureTagCreatedByColumnForScopedOps(scopeOptions, hasCreatedByColumn);
            assertTagOwnerScopeReady(scopeOptions, hasCreatedByColumn);

            if (hasCreatedByColumn) {
                const filters = ['tags.id = ?'];
                const params = [id];
                appendOwnerCreatedByFilters(filters, params, scopeOptions, { tableAlias: 'tags' });

                return await queryOne(`
                    SELECT id, name, color, description, created_at, created_by
                    FROM tags
                    WHERE ${filters.join(' AND ')}
                `, params);
            }

            return await queryOne('SELECT id, name, color, description, created_at FROM tags WHERE id = ?', [id]);
        },

        async findByName(name, scopeOptions = {}) {
            let hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            hasCreatedByColumn = await ensureTagCreatedByColumnForScopedOps(scopeOptions, hasCreatedByColumn);
            const normalizedName = normalizeTagValue(name);
            if (!normalizedName) return null;
            assertTagOwnerScopeReady(scopeOptions, hasCreatedByColumn);

            if (hasCreatedByColumn) {
                const filters = ['LOWER(TRIM(tags.name)) = LOWER(TRIM(?))'];
                const params = [normalizedName];
                appendOwnerCreatedByFilters(filters, params, scopeOptions, { tableAlias: 'tags' });

                return await queryOne(`
                    SELECT id, name, color, description, created_at, created_by
                    FROM tags
                    WHERE ${filters.join(' AND ')}
                `, params);
            }

            return await queryOne(
                'SELECT id, name, color, description, created_at FROM tags WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
                [normalizedName]
            );
        },

        async create(data, scopeOptions = {}) {
            const tagName = normalizeTagValue(data.name);
            const tagColor = normalizeTagValue(data.color) || DEFAULT_TAG_COLOR;
            const tagDescription = normalizeTagValue(data.description);
            const createdBy = parsePositiveInteger(data?.created_by ?? scopeOptions?.created_by, null);
            let hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            hasCreatedByColumn = await ensureTagCreatedByColumnForScopedOps({
                ...scopeOptions,
                created_by: createdBy || scopeOptions?.created_by || null
            }, hasCreatedByColumn);
            assertTagOwnerScopeReady({
                ...scopeOptions,
                owner_user_id: scopeOptions?.owner_user_id || createdBy || null
            }, hasCreatedByColumn);

            let result;
            if (hasCreatedByColumn && createdBy) {
                result = await run(`
                    INSERT INTO tags (name, color, description, created_by)
                    VALUES (?, ?, ?, ?)
                `, [tagName, tagColor, tagDescription || null, createdBy]);
            } else {
                result = await run(`
                    INSERT INTO tags (name, color, description)
                    VALUES (?, ?, ?)
                `, [tagName, tagColor, tagDescription || null]);
            }

            return await model.findById(
                result.lastInsertRowid,
                hasCreatedByColumn ? scopeOptions : {}
            );
        },

        async update(id, data, scopeOptions = {}) {
            const existingTag = await model.findById(id, scopeOptions);
            if (!existingTag) return null;

            const fields = [];
            const values = [];
            const hasCreatedByColumn = await tagsTableHasCreatedByColumn();

            if (Object.prototype.hasOwnProperty.call(data, 'name')) {
                fields.push('name = ?');
                values.push(normalizeTagValue(data.name));
            }
            if (Object.prototype.hasOwnProperty.call(data, 'color')) {
                fields.push('color = ?');
                values.push(normalizeTagValue(data.color) || DEFAULT_TAG_COLOR);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'description')) {
                fields.push('description = ?');
                const description = normalizeTagValue(data.description);
                values.push(description || null);
            }

            if (fields.length === 0) return existingTag;

            values.push(id);
            await run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values);

            return await model.findById(id, hasCreatedByColumn ? scopeOptions : {});
        },

        async delete(id, scopeOptions = {}) {
            const existingTag = await model.findById(id, scopeOptions);
            if (!existingTag) return null;
            return await run('DELETE FROM tags WHERE id = ?', [id]);
        },

        async syncFromLeads(scopeOptions = {}) {
            const ownerUserId = parsePositiveInteger(scopeOptions.owner_user_id, null);
            const createdBy = parsePositiveInteger(scopeOptions.created_by, null);
            let hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            hasCreatedByColumn = await ensureTagCreatedByColumnForScopedOps({
                ...scopeOptions,
                created_by: createdBy || scopeOptions?.created_by || null
            }, hasCreatedByColumn);
            assertTagOwnerScopeReady({
                ...scopeOptions,
                owner_user_id: ownerUserId || createdBy || null
            }, hasCreatedByColumn);

            let rows;
            if (ownerUserId) {
                rows = await query(`
                    SELECT tags
                    FROM leads
                    WHERE owner_user_id = ?
                      AND tags IS NOT NULL
                      AND tags <> ''
                `, [ownerUserId]);
            } else {
                rows = await query("SELECT tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
            }
            if (!rows || rows.length === 0) return;

            const existingTags = await model.list(scopeOptions);
            const existingKeys = new Set(existingTags.map((tag) => normalizeTagKey(tag.name)));
            const discoveredTags = new Set();

            for (const row of rows) {
                for (const tag of parseTagList(row.tags)) {
                    discoveredTags.add(tag);
                }
            }

            for (const tagName of uniqueTags(Array.from(discoveredTags))) {
                const key = normalizeTagKey(tagName);
                if (existingKeys.has(key)) continue;

                try {
                    if (hasCreatedByColumn && (createdBy || ownerUserId)) {
                        await run(
                            `INSERT INTO tags (name, color, description, created_by)
                             VALUES (?, ?, ?, ?)`,
                            [tagName, DEFAULT_TAG_COLOR, null, createdBy || ownerUserId]
                        );
                    } else {
                        await run(
                            `INSERT INTO tags (name, color, description)
                             VALUES (?, ?, ?)`,
                            [tagName, DEFAULT_TAG_COLOR, null]
                        );
                    }
                } catch (error) {
                    const code = String(error?.code || '').trim();
                    const message = String(error?.message || '').toLowerCase();
                    const isUniqueViolation = code === '23505'
                        || message.includes('unique')
                        || message.includes('duplicate key');
                    if (!isUniqueViolation) {
                        throw error;
                    }
                }
                existingKeys.add(key);
            }
        },

        async repairLegacyOwnership(scopeOptions = {}) {
            const hasCreatedByColumn = await tagsTableHasCreatedByColumn();
            if (!hasCreatedByColumn) {
                return {
                    scanned: 0,
                    updated: 0,
                    inserted: 0,
                    removed: 0,
                    unresolved: 0,
                    skipped: 'missing_created_by_column'
                };
            }

            const maxRows = parsePositiveInteger(scopeOptions.maxRows, 10000) || 10000;
            const orphanTags = await query(`
                SELECT id, name, color, description
                FROM tags
                WHERE created_by IS NULL
                ORDER BY id ASC
                LIMIT ?
            `, [maxRows]);

            if (!orphanTags.length) {
                return {
                    scanned: 0,
                    updated: 0,
                    inserted: 0,
                    removed: 0,
                    unresolved: 0
                };
            }

            const usageByTagKey = new Map();
            const registerUsage = (tagName, ownerUserIdValue) => {
                const owner = parsePositiveInteger(ownerUserIdValue, null);
                if (!owner) return;
                const key = normalizeTagKey(tagName);
                if (!key) return;
                if (!usageByTagKey.has(key)) {
                    usageByTagKey.set(key, new Set());
                }
                usageByTagKey.get(key).add(owner);
            };

            const leadRows = await query(`
                SELECT owner_user_id, tags
                FROM leads
                WHERE owner_user_id IS NOT NULL
                  AND tags IS NOT NULL
                  AND tags <> ''
            `);
            for (const row of leadRows || []) {
                for (const tagName of parseTagList(row?.tags)) {
                    registerUsage(tagName, row?.owner_user_id);
                }
            }

            const campaignRows = await query(`
                SELECT
                    c.tag_filter,
                    c.created_by,
                    COALESCE(NULLIF(u.owner_user_id, 0), u.id) AS owner_scope_user_id
                FROM campaigns c
                LEFT JOIN users u ON u.id = c.created_by
                WHERE c.tag_filter IS NOT NULL
                  AND TRIM(c.tag_filter) <> ''
            `);
            for (const row of campaignRows || []) {
                const ownerUserIdFromCampaign = parsePositiveInteger(row?.owner_scope_user_id || row?.created_by, null);
                for (const tagName of parseTagList(row?.tag_filter)) {
                    registerUsage(tagName, ownerUserIdFromCampaign);
                }
            }

            const existingScopeCache = new Map();
            const hasScopedTag = async (tagName, ownerUserIdValue) => {
                const ownerUserId = parsePositiveInteger(ownerUserIdValue, null);
                if (!ownerUserId) return false;
                const cacheKey = `${normalizeTagKey(tagName)}:${ownerUserId}`;
                if (existingScopeCache.has(cacheKey)) {
                    return existingScopeCache.get(cacheKey);
                }

                const row = await queryOne(`
                    SELECT t.id
                    FROM tags t
                    LEFT JOIN users owner_scope ON owner_scope.id = t.created_by
                    WHERE LOWER(TRIM(t.name)) = LOWER(TRIM(?))
                      AND (
                          t.created_by = ?
                          OR owner_scope.owner_user_id = ?
                          OR owner_scope.id = ?
                      )
                    ORDER BY
                        CASE
                            WHEN t.created_by = ? THEN 0
                            WHEN owner_scope.owner_user_id = ? THEN 1
                            WHEN owner_scope.id = ? THEN 2
                            WHEN t.created_by IS NULL THEN 3
                            ELSE 4
                        END,
                        t.id ASC
                    LIMIT 1
                `, [tagName, ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId]);

                const exists = Boolean(row?.id);
                existingScopeCache.set(cacheKey, exists);
                return exists;
            };

            let updated = 0;
            let inserted = 0;
            let removed = 0;
            let unresolved = 0;

            for (const orphanTag of orphanTags) {
                const tagKey = normalizeTagKey(orphanTag?.name);
                const ownersSet = usageByTagKey.get(tagKey);
                const ownerCandidates = ownersSet
                    ? Array.from(ownersSet).map((value) => parsePositiveInteger(value, null)).filter(Boolean).sort((a, b) => a - b)
                    : [];

                if (!ownerCandidates.length) {
                    unresolved += 1;
                    continue;
                }

                let assignedBaseTag = false;
                for (const ownerUserId of ownerCandidates) {
                    const hasTagForOwner = await hasScopedTag(orphanTag.name, ownerUserId);
                    if (hasTagForOwner) continue;

                    if (!assignedBaseTag) {
                        await run(
                            'UPDATE tags SET created_by = ? WHERE id = ? AND created_by IS NULL',
                            [ownerUserId, orphanTag.id]
                        );
                        updated += 1;
                        assignedBaseTag = true;
                    } else {
                        try {
                            await run(
                                `INSERT INTO tags (name, color, description, created_by)
                                 VALUES (?, ?, ?, ?)`,
                                [
                                    normalizeTagValue(orphanTag.name),
                                    normalizeTagValue(orphanTag.color) || DEFAULT_TAG_COLOR,
                                    normalizeTagValue(orphanTag.description) || null,
                                    ownerUserId
                                ]
                            );
                            inserted += 1;
                        } catch (error) {
                            const code = String(error?.code || '').trim();
                            const message = String(error?.message || '').toLowerCase();
                            const isUniqueViolation = code === '23505'
                                || message.includes('unique')
                                || message.includes('duplicate key');
                            if (!isUniqueViolation) {
                                throw error;
                            }
                        }
                    }
                }

                if (!assignedBaseTag) {
                    await run('DELETE FROM tags WHERE id = ? AND created_by IS NULL', [orphanTag.id]);
                    removed += 1;
                }
            }

            return {
                scanned: orphanTags.length,
                updated,
                inserted,
                removed,
                unresolved
            };
        },

        async renameInLeads(previousName, nextName, scopeOptions = {}) {
            const previousKey = normalizeTagKey(previousName);
            const sanitizedNext = normalizeTagValue(nextName);
            if (!previousKey || !sanitizedNext) return 0;

            const ownerUserId = parsePositiveInteger(scopeOptions.owner_user_id, null);
            const leads = ownerUserId
                ? await query(`
                    SELECT id, tags
                    FROM leads
                    WHERE owner_user_id = ?
                      AND tags IS NOT NULL
                      AND tags <> ''
                `, [ownerUserId])
                : await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
            let updatedLeads = 0;

            for (const lead of leads) {
                const originalTags = parseTagList(lead.tags);
                if (originalTags.length === 0) continue;

                let changed = false;
                const replacedTags = [];
                const seen = new Set();

                for (const tag of originalTags) {
                    const key = normalizeTagKey(tag);
                    const value = key === previousKey ? sanitizedNext : tag;
                    if (key === previousKey) changed = true;

                    const valueKey = normalizeTagKey(value);
                    if (!valueKey || seen.has(valueKey)) continue;
                    seen.add(valueKey);
                    replacedTags.push(value);
                }

                if (!changed) continue;

                await run(
                    'UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [JSON.stringify(replacedTags), lead.id]
                );
                updatedLeads++;
            }

            return updatedLeads;
        },

        async removeFromLeads(tagName, scopeOptions = {}) {
            const normalized = normalizeTagKey(tagName);
            if (!normalized) return 0;

            const ownerUserId = parsePositiveInteger(scopeOptions.owner_user_id, null);
            const leads = ownerUserId
                ? await query(`
                    SELECT id, tags
                    FROM leads
                    WHERE owner_user_id = ?
                      AND tags IS NOT NULL
                      AND tags <> ''
                `, [ownerUserId])
                : await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
            let updatedLeads = 0;

            for (const lead of leads) {
                const originalTags = parseTagList(lead.tags);
                if (originalTags.length === 0) continue;

                const remainingTags = uniqueTags(
                    originalTags.filter((tag) => normalizeTagKey(tag) !== normalized)
                );

                if (remainingTags.length === originalTags.length) continue;

                await run(
                    'UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [JSON.stringify(remainingTags), lead.id]
                );
                updatedLeads++;
            }

            return updatedLeads;
        }
    };

    return model;
}

module.exports = {
    createTagModel
};
