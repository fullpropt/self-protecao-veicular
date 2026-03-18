function createFlowModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const normalizeFlowSessionScope = options.normalizeFlowSessionScope;
    const resolvePersistedFlowBuilderMode = options.resolvePersistedFlowBuilderMode;
    const hydrateFlowRecord = options.hydrateFlowRecord;
    const normalizeFlowKeywordText = options.normalizeFlowKeywordText;
    const extractFlowKeywords = options.extractFlowKeywords;
    const includesFlowKeyword = options.includesFlowKeyword;
    const scoreFlowKeywordMatch = options.scoreFlowKeywordMatch;
    const compareFlowKeywordScoreDesc = options.compareFlowKeywordScoreDesc;

    const model = {
        async create(data) {
            const uuid = generateUUID();
            const sessionScope = normalizeFlowSessionScope(data.session_id ?? data.sessionId);
            const flowBuilderMode = resolvePersistedFlowBuilderMode(
                data.flow_builder_mode ?? data.flowBuilderMode,
                data.nodes
            );

            const result = await run(`
                INSERT INTO flows (uuid, name, description, trigger_type, trigger_value, nodes, edges, is_active, priority, flow_builder_mode, created_by, session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.name,
                data.description,
                data.trigger_type,
                data.trigger_value,
                JSON.stringify(data.nodes || []),
                JSON.stringify(data.edges || []),
                data.is_active !== undefined ? data.is_active : 1,
                data.priority || 0,
                flowBuilderMode,
                data.created_by,
                sessionScope
            ]);

            const deactivatedFlowIds = Number(data.is_active !== undefined ? data.is_active : 1) > 0 && flowBuilderMode === 'menu'
                ? await model.deactivateOtherActiveMenuFlows({
                    exclude_id: result.lastInsertRowid,
                    session_id: sessionScope,
                    owner_user_id: data.owner_user_id,
                    created_by: data.created_by
                })
                : [];

            return {
                id: result.lastInsertRowid,
                uuid,
                deactivated_flow_ids: deactivatedFlowIds
            };
        },

        async deactivateOtherActiveMenuFlows(options = {}) {
            const excludeId = parsePositiveInteger(options.exclude_id ?? options.excludeId);
            const scopedSessionId = normalizeFlowSessionScope(options.session_id ?? options.sessionId);
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [];
            let sql = 'SELECT * FROM flows WHERE is_active = 1';

            if (excludeId) {
                sql += ' AND id <> ?';
                params.push(excludeId);
            }

            if (scopedSessionId) {
                sql += ' AND session_id = ?';
                params.push(scopedSessionId);
            } else {
                sql += " AND (session_id IS NULL OR TRIM(session_id) = '')";
            }

            if (ownerUserId) {
                sql += `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                sql += ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            const rows = await query(sql, params);
            const deactivatedFlowIds = [];

            for (const row of rows) {
                const hydrated = hydrateFlowRecord(row);
                if (!hydrated || hydrated.flow_builder_mode !== 'menu') continue;

                await run('UPDATE flows SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hydrated.id]);
                deactivatedFlowIds.push(Number(hydrated.id));
            }

            return deactivatedFlowIds;
        },

        async findById(id, options = {}) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [id];
            let ownerFilter = '';
            if (ownerUserId) {
                ownerFilter = `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                ownerFilter = ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            const flow = await queryOne(`
                SELECT flows.*
                FROM flows
                WHERE flows.id = ?
                ${ownerFilter}
            `, params);
            return hydrateFlowRecord(flow);
        },

        async findByTrigger(triggerType, triggerValue = null, options = {}) {
            let sql = 'SELECT * FROM flows WHERE trigger_type = ? AND is_active = 1';
            const params = [triggerType];

            if (triggerValue) {
                sql += ' AND (trigger_value = ? OR trigger_value IS NULL)';
                params.push(triggerValue);
            }

            const scopedSessionId = normalizeFlowSessionScope(options.session_id || options.sessionId);
            if (scopedSessionId) {
                sql += " AND (flows.session_id IS NULL OR TRIM(flows.session_id) = '' OR flows.session_id = ?)";
                params.push(scopedSessionId);
            }

            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);

            if (ownerUserId) {
                sql += `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                sql += ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            sql += ' ORDER BY priority DESC LIMIT 1';

            const flow = await queryOne(sql, params);
            return hydrateFlowRecord(flow);
        },

        async findActiveKeywordFlows(options = {}) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [];
            let ownerFilter = '';
            const scopedSessionId = normalizeFlowSessionScope(options.session_id || options.sessionId);
            if (scopedSessionId) {
                params.push(scopedSessionId);
            }
            if (ownerUserId) {
                ownerFilter = `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                ownerFilter = ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            const rows = await query(`
                SELECT * FROM flows
                WHERE trigger_type = 'keyword' AND is_active = 1
                ${scopedSessionId ? "AND (flows.session_id IS NULL OR TRIM(flows.session_id) = '' OR flows.session_id = ?)" : ''}
                ${ownerFilter}
                ORDER BY priority DESC, id ASC
            `, params);

            return rows.map((flow) => hydrateFlowRecord(flow)).filter(Boolean);
        },

        async findKeywordMatches(messageText, options = {}) {
            const normalizedMessage = normalizeFlowKeywordText(messageText);
            if (!normalizedMessage) return [];

            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [];
            let ownerFilter = '';
            const scopedSessionId = normalizeFlowSessionScope(options.session_id || options.sessionId);
            if (scopedSessionId) {
                params.push(scopedSessionId);
            }
            if (ownerUserId) {
                ownerFilter = `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                ownerFilter = ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            const flows = await query(`
                SELECT * FROM flows
                WHERE trigger_type = 'keyword' AND is_active = 1
                ${scopedSessionId ? "AND (flows.session_id IS NULL OR TRIM(flows.session_id) = '' OR flows.session_id = ?)" : ''}
                ${ownerFilter}
                ORDER BY priority DESC, id ASC
            `, params);

            const matches = [];

            for (const rawFlow of flows) {
                const flow = hydrateFlowRecord(rawFlow);
                if (!flow) continue;

                const keywords = extractFlowKeywords(flow.trigger_value || '');
                if (keywords.length === 0) continue;

                const matchedKeywords = keywords.filter((keyword) => includesFlowKeyword(normalizedMessage, keyword));
                if (matchedKeywords.length === 0) continue;

                const score = scoreFlowKeywordMatch(matchedKeywords, flow.priority);
                matches.push({ flow, score, matchedKeywords });
            }

            matches.sort((a, b) => {
                const scoreCompare = compareFlowKeywordScoreDesc(a.score, b.score);
                if (scoreCompare !== 0) return scoreCompare;
                return Number(a.flow.id || 0) - Number(b.flow.id || 0);
            });

            return matches.map(({ flow, score, matchedKeywords }) => ({
                ...flow,
                _keywordMatch: {
                    ...score,
                    matchedKeywords
                }
            }));
        },

        async findByKeyword(messageText, options = {}) {
            const matches = await model.findKeywordMatches(messageText, options);
            if (matches.length === 0) return null;
            return matches[0];
        },

        async list(options = {}) {
            let sql = 'SELECT * FROM flows WHERE 1=1';
            const params = [];

            if (options.is_active !== undefined) {
                sql += ' AND is_active = ?';
                params.push(options.is_active);
            }

            const scopedSessionId = normalizeFlowSessionScope(options.session_id || options.sessionId);
            if (scopedSessionId) {
                sql += " AND (flows.session_id IS NULL OR TRIM(flows.session_id) = '' OR flows.session_id = ?)";
                params.push(scopedSessionId);
            }

            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);

            if (ownerUserId) {
                sql += `
                    AND (
                        flows.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = flows.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                sql += ' AND flows.created_by = ?';
                params.push(createdBy);
            }

            sql += ' ORDER BY priority DESC, name ASC';

            const rows = await query(sql, params);
            return rows.map((flow) => hydrateFlowRecord(flow)).filter(Boolean);
        },

        async update(id, data) {
            const fields = [];
            const values = [];
            const payload = {
                ...data
            };

            if (Object.prototype.hasOwnProperty.call(payload, 'flowBuilderMode')
                && !Object.prototype.hasOwnProperty.call(payload, 'flow_builder_mode')) {
                payload.flow_builder_mode = payload.flowBuilderMode;
            }

            if (Object.prototype.hasOwnProperty.call(payload, 'nodes')
                && !Object.prototype.hasOwnProperty.call(payload, 'flow_builder_mode')) {
                payload.flow_builder_mode = resolvePersistedFlowBuilderMode('', payload.nodes);
            }

            const allowedFields = ['name', 'description', 'trigger_type', 'trigger_value', 'nodes', 'edges', 'is_active', 'priority', 'session_id', 'flow_builder_mode'];

            for (const [key, value] of Object.entries(payload)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    if (key === 'session_id') {
                        values.push(normalizeFlowSessionScope(value));
                    } else if (key === 'flow_builder_mode') {
                        values.push(resolvePersistedFlowBuilderMode(value, payload.nodes));
                    } else {
                        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                    }
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const result = await run(`UPDATE flows SET ${fields.join(', ')} WHERE id = ?`, values);
            const finalFlow = await model.findById(id, {
                owner_user_id: data.owner_user_id,
                created_by: data.created_by
            });

            if (finalFlow && Number(finalFlow.is_active || 0) !== 1) {
                await run(`
                    UPDATE flow_executions
                    SET status = 'cancelled',
                        completed_at = CURRENT_TIMESTAMP,
                        error_message = CASE
                            WHEN error_message IS NULL OR TRIM(error_message) = ''
                                THEN 'Execucao cancelada automaticamente: fluxo desativado.'
                            ELSE error_message
                        END
                    WHERE flow_id = ? AND status = 'running'
                `, [id]);
            }

            const deactivatedFlowIds = finalFlow
                && Number(finalFlow.is_active) > 0
                && resolvePersistedFlowBuilderMode(finalFlow.flow_builder_mode, finalFlow.nodes) === 'menu'
                ? await model.deactivateOtherActiveMenuFlows({
                    exclude_id: id,
                    session_id: finalFlow.session_id,
                    owner_user_id: data.owner_user_id,
                    created_by: data.created_by || finalFlow.created_by
                })
                : [];

            return {
                result,
                deactivated_flow_ids: deactivatedFlowIds
            };
        },

        async delete(id) {
            await run(`
                UPDATE flow_executions
                SET status = 'cancelled',
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = CASE
                        WHEN error_message IS NULL OR TRIM(error_message) = ''
                            THEN 'Execucao cancelada automaticamente: fluxo removido.'
                        ELSE error_message
                    END
                WHERE flow_id = ? AND status = 'running'
            `, [id]);
            return await run('DELETE FROM flows WHERE id = ?', [id]);
        }
    };

    return model;
}

module.exports = {
    createFlowModel
};
