function createCustomEventModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const normalizeCustomEventName = options.normalizeCustomEventName;
    const normalizeCustomEventKey = options.normalizeCustomEventKey;
    const buildCustomEventKey = options.buildCustomEventKey;
    const normalizeBooleanFlag = options.normalizeBooleanFlag;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    const model = {
        async create(data) {
            const uuid = generateUUID();
            const name = normalizeCustomEventName(data?.name);
            if (!name) {
                throw new Error('Nome do evento e obrigatorio');
            }

            const eventKey = normalizeCustomEventKey(
                data?.event_key ?? data?.eventKey ?? data?.key ?? name
            ) || buildCustomEventKey(name);

            const description = String(data?.description || '').trim().slice(0, 400) || null;
            const isActive = normalizeBooleanFlag(data?.is_active ?? data?.isActive, 1);

            try {
                const result = await run(`
                    INSERT INTO custom_events (uuid, name, event_key, description, is_active, created_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    uuid,
                    name,
                    eventKey,
                    description,
                    isActive,
                    data?.created_by || null
                ]);

                return { id: result.lastInsertRowid, uuid };
            } catch (error) {
                const code = String(error?.code || '');
                const detail = String(error?.detail || error?.message || '').toLowerCase();
                if (code === '23505' && (detail.includes('event_key') || detail.includes('custom_events_event_key_key'))) {
                    throw new Error('Ja existe um evento com esta chave');
                }
                throw error;
            }
        },

        async findById(id, options = {}) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                return await queryOne(`
                    SELECT ce.*
                    FROM custom_events ce
                    WHERE ce.id = ?
                      AND EXISTS (
                          SELECT 1
                          FROM users owner_scope
                          WHERE owner_scope.id = ce.created_by
                            AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                      )
                `, [id, ownerUserId, ownerUserId]);
            }
            return await queryOne('SELECT * FROM custom_events WHERE id = ?', [id]);
        },

        async findByKey(eventKey, options = {}) {
            const normalizedKey = normalizeCustomEventKey(eventKey);
            if (!normalizedKey) return null;
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                return await queryOne(`
                    SELECT ce.*
                    FROM custom_events ce
                    WHERE ce.event_key = ?
                      AND EXISTS (
                          SELECT 1
                          FROM users owner_scope
                          WHERE owner_scope.id = ce.created_by
                            AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                      )
                `, [normalizedKey, ownerUserId, ownerUserId]);
            }
            return await queryOne('SELECT * FROM custom_events WHERE event_key = ?', [normalizedKey]);
        },

        async findByName(name, options = {}) {
            const normalizedName = normalizeCustomEventName(name);
            if (!normalizedName) return null;
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                return await queryOne(`
                    SELECT ce.*
                    FROM custom_events ce
                    WHERE LOWER(ce.name) = LOWER(?)
                      AND EXISTS (
                          SELECT 1
                          FROM users owner_scope
                          WHERE owner_scope.id = ce.created_by
                            AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                      )
                `, [normalizedName, ownerUserId, ownerUserId]);
            }
            return await queryOne('SELECT * FROM custom_events WHERE LOWER(name) = LOWER(?)', [normalizedName]);
        },

        async list(options = {}) {
            let sql = `
                SELECT
                    ce.id,
                    ce.uuid,
                    ce.name,
                    ce.event_key,
                    ce.description,
                    ce.is_active,
                    ce.created_by,
                    ce.created_at,
                    ce.updated_at,
                    COUNT(cel.id)::int AS total_triggers,
                    MAX(cel.occurred_at) AS last_triggered_at
                FROM custom_events ce
                LEFT JOIN custom_event_logs cel ON cel.event_id = ce.id
            `;
            const filters = [];
            const params = [];

            if (options.is_active !== undefined && options.is_active !== null && options.is_active !== '') {
                filters.push('ce.is_active = ?');
                params.push(normalizeBooleanFlag(options.is_active, 1));
            }

            if (options.created_by) {
                filters.push('ce.created_by = ?');
                params.push(options.created_by);
            }

            if (options.owner_user_id) {
                const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
                if (ownerUserId) {
                    filters.push(`
                        EXISTS (
                            SELECT 1
                            FROM users owner_scope
                            WHERE owner_scope.id = ce.created_by
                              AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                        )
                    `);
                    params.push(ownerUserId, ownerUserId);
                }
            }

            const search = normalizeCustomEventName(options.search || '');
            if (search) {
                filters.push('(LOWER(ce.name) LIKE LOWER(?) OR LOWER(ce.event_key) LIKE LOWER(?))');
                params.push(`%${search}%`, `%${normalizeCustomEventKey(search)}%`);
            }

            if (filters.length > 0) {
                sql += ` WHERE ${filters.join(' AND ')}`;
            }

            sql += `
                GROUP BY
                    ce.id, ce.uuid, ce.name, ce.event_key, ce.description, ce.is_active, ce.created_by, ce.created_at, ce.updated_at
                ORDER BY ce.name ASC
            `;

            return await query(sql, params);
        },

        async listWithPeriodTotals(startAt, endAt, options = {}) {
            let sql = `
                SELECT
                    ce.id,
                    ce.uuid,
                    ce.name,
                    ce.event_key,
                    ce.description,
                    ce.is_active,
                    ce.created_by,
                    ce.created_at,
                    ce.updated_at,
                    COUNT(cel.id)::int AS total_period,
                    MAX(cel.occurred_at) AS last_triggered_at
                FROM custom_events ce
                LEFT JOIN custom_event_logs cel
                    ON cel.event_id = ce.id
                   AND cel.occurred_at >= ?
                   AND cel.occurred_at < ?
            `;
            const params = [startAt, endAt];
            const filters = [];

            if (options.is_active !== undefined && options.is_active !== null && options.is_active !== '') {
                filters.push('ce.is_active = ?');
                params.push(normalizeBooleanFlag(options.is_active, 1));
            }

            if (options.created_by) {
                filters.push('ce.created_by = ?');
                params.push(options.created_by);
            }

            if (options.owner_user_id) {
                const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
                if (ownerUserId) {
                    filters.push(`
                        EXISTS (
                            SELECT 1
                            FROM users owner_scope
                            WHERE owner_scope.id = ce.created_by
                              AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                        )
                    `);
                    params.push(ownerUserId, ownerUserId);
                }
            }

            if (filters.length > 0) {
                sql += ` WHERE ${filters.join(' AND ')}`;
            }

            sql += `
                GROUP BY
                    ce.id, ce.uuid, ce.name, ce.event_key, ce.description, ce.is_active, ce.created_by, ce.created_at, ce.updated_at
                ORDER BY total_period DESC, ce.name ASC
            `;

            return await query(sql, params);
        },

        async update(id, data) {
            const current = await model.findById(id);
            if (!current) return null;

            const fields = [];
            const values = [];

            if (Object.prototype.hasOwnProperty.call(data, 'name')) {
                const name = normalizeCustomEventName(data.name);
                if (!name) {
                    throw new Error('Nome do evento e obrigatorio');
                }
                fields.push('name = ?');
                values.push(name);
            }

            if (
                Object.prototype.hasOwnProperty.call(data, 'event_key')
                || Object.prototype.hasOwnProperty.call(data, 'eventKey')
                || Object.prototype.hasOwnProperty.call(data, 'key')
            ) {
                const keySource = data.event_key ?? data.eventKey ?? data.key;
                const eventKey = normalizeCustomEventKey(keySource);
                if (!eventKey) {
                    throw new Error('Chave do evento invalida');
                }
                fields.push('event_key = ?');
                values.push(eventKey);
            }

            if (Object.prototype.hasOwnProperty.call(data, 'description')) {
                const description = String(data.description || '').trim().slice(0, 400) || null;
                fields.push('description = ?');
                values.push(description);
            }

            if (Object.prototype.hasOwnProperty.call(data, 'is_active') || Object.prototype.hasOwnProperty.call(data, 'isActive')) {
                const isActive = normalizeBooleanFlag(data.is_active ?? data.isActive, current.is_active ? 1 : 0);
                fields.push('is_active = ?');
                values.push(isActive);
            }

            if (fields.length === 0) return current;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            try {
                await run(`UPDATE custom_events SET ${fields.join(', ')} WHERE id = ?`, values);
                return await model.findById(id);
            } catch (error) {
                const code = String(error?.code || '');
                const detail = String(error?.detail || error?.message || '').toLowerCase();
                if (code === '23505' && (detail.includes('event_key') || detail.includes('custom_events_event_key_key'))) {
                    throw new Error('Ja existe um evento com esta chave');
                }
                throw error;
            }
        },

        async delete(id) {
            return await run('DELETE FROM custom_events WHERE id = ?', [id]);
        },

        async logOccurrence(data) {
            const eventId = Number(data?.event_id ?? data?.eventId);
            if (!Number.isFinite(eventId) || eventId <= 0) {
                throw new Error('event_id invalido');
            }

            const metadata = toJsonStringOrNull(data?.metadata);
            const flowId = Number(data?.flow_id ?? data?.flowId) || null;
            const leadId = Number(data?.lead_id ?? data?.leadId) || null;
            const conversationId = Number(data?.conversation_id ?? data?.conversationId) || null;
            const executionId = Number(data?.execution_id ?? data?.executionId) || null;
            const nodeIdRaw = data?.node_id ?? data?.nodeId ?? '';
            const nodeId = String(nodeIdRaw).trim() || null;

            if (data?.occurred_at || data?.occurredAt) {
                const occurredAt = data.occurred_at || data.occurredAt;
                return await run(`
                    INSERT INTO custom_event_logs (
                        event_id, flow_id, node_id, lead_id, conversation_id, execution_id, metadata, occurred_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [eventId, flowId, nodeId, leadId, conversationId, executionId, metadata, occurredAt]);
            }

            return await run(`
                INSERT INTO custom_event_logs (
                    event_id, flow_id, node_id, lead_id, conversation_id, execution_id, metadata
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [eventId, flowId, nodeId, leadId, conversationId, executionId, metadata]);
        }
    };

    return model;
}

module.exports = {
    createCustomEventModel
};
