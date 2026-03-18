function parsePositiveIntegerFallback(value, fallback = null) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function createConversationModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = typeof options.parsePositiveInteger === 'function'
        ? options.parsePositiveInteger
        : parsePositiveIntegerFallback;
    const resolveLeadById = typeof options.resolveLeadById === 'function'
        ? options.resolveLeadById
        : async () => null;

    const model = {
        async create(data) {
            const uuid = generateUUID();

            const result = await run(`
                INSERT INTO conversations (uuid, lead_id, session_id, status, assigned_to, is_bot_active, current_flow_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.lead_id,
                data.session_id,
                data.status || 'open',
                data.assigned_to,
                data.is_bot_active !== undefined ? data.is_bot_active : 1,
                data.current_flow_id,
                JSON.stringify(data.metadata || {})
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id) {
            return await queryOne('SELECT * FROM conversations WHERE id = ?', [id]);
        },

        async findByLeadId(leadId, sessionId = null) {
            const normalizedSessionId = String(sessionId || '').trim();
            if (normalizedSessionId) {
                return await queryOne(
                    'SELECT * FROM conversations WHERE lead_id = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 1',
                    [leadId, normalizedSessionId]
                );
            }
            return await queryOne('SELECT * FROM conversations WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1', [leadId]);
        },

        async findOrCreate(data) {
            const normalizedSessionId = String(data.session_id || '').trim();
            let conversation = await model.findByLeadId(data.lead_id, normalizedSessionId || null);

            if (conversation) {
                return { conversation, created: false };
            }

            let assignedTo = Number(data?.assigned_to);
            if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
                const lead = await resolveLeadById(data.lead_id);
                const leadAssignedTo = Number(lead?.assigned_to);
                assignedTo = Number.isInteger(leadAssignedTo) && leadAssignedTo > 0 ? leadAssignedTo : null;
            }

            const result = await model.create({
                ...data,
                assigned_to: assignedTo
            });
            return { conversation: await model.findById(result.id), created: true };
        },

        async update(id, data) {
            const fields = [];
            const values = [];

            const allowedFields = ['status', 'assigned_to', 'unread_count', 'is_bot_active', 'current_flow_id', 'current_flow_step', 'metadata'];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            return await run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`, values);
        },

        async incrementUnread(id) {
            return await run('UPDATE conversations SET unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        },

        async touch(id, lastMessageId = null, sentAt = null) {
            const updates = [];
            const params = [];

            if (lastMessageId) {
                updates.push('last_message_id = ?');
                params.push(lastMessageId);
            }

            if (sentAt) {
                updates.push('updated_at = ?');
                params.push(sentAt);
            } else {
                updates.push('updated_at = CURRENT_TIMESTAMP');
            }

            params.push(id);
            return await run(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, params);
        },

        async touchAndMarkAsRead(id, lastMessageId = null, sentAt = null) {
            const updates = ['unread_count = 0'];
            const params = [];

            if (lastMessageId) {
                updates.push('last_message_id = ?');
                params.push(lastMessageId);
            }

            if (sentAt) {
                updates.push('updated_at = ?');
                params.push(sentAt);
            } else {
                updates.push('updated_at = CURRENT_TIMESTAMP');
            }

            params.push(id);
            return await run(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, params);
        },

        async markAsRead(id) {
            return await run('UPDATE conversations SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        },

        async list(options = {}) {
            const params = [];
            const whereClauses = [];
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);

            const ctes = [];
            if (ownerUserId) {
                ctes.push(`
                    owner_scope_users AS (
                        SELECT id
                        FROM users
                        WHERE id = ? OR owner_user_id = ?
                    )
                `);
                ctes.push(`
                    owner_scope_conversations AS (
                        SELECT c.id
                        FROM leads l
                        JOIN conversations c ON c.lead_id = l.id
                        WHERE l.owner_user_id = ?

                        UNION

                        SELECT c.id
                        FROM conversations c
                        WHERE c.assigned_to IN (SELECT id FROM owner_scope_users)

                        UNION

                        SELECT c.id
                        FROM leads l
                        JOIN conversations c ON c.lead_id = l.id
                        WHERE c.assigned_to IS NULL
                          AND l.assigned_to IN (SELECT id FROM owner_scope_users)

                        UNION

                        SELECT c.id
                        FROM conversations c
                        JOIN whatsapp_sessions ws ON ws.session_id = c.session_id
                        WHERE ws.created_by IN (SELECT id FROM owner_scope_users)
                    )
                `);
                params.push(ownerUserId, ownerUserId, ownerUserId);
                whereClauses.push('c.id IN (SELECT id FROM owner_scope_conversations)');
            }

            if (options.status) {
                whereClauses.push('c.status = ?');
                params.push(options.status);
            }

            if (options.assigned_to) {
                whereClauses.push('c.assigned_to = ?');
                params.push(options.assigned_to);
            }

            if (options.session_id) {
                whereClauses.push('c.session_id = ?');
                params.push(options.session_id);
            }

            let filteredConversationsSql = `
                SELECT c.*
                FROM conversations c
                ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
                ORDER BY c.updated_at DESC
            `;

            if (options.limit) {
                filteredConversationsSql += ' LIMIT ?';
                params.push(options.limit);
            }

            if (options.offset) {
                filteredConversationsSql += ' OFFSET ?';
                params.push(options.offset);
            }

            ctes.push(`
                filtered_conversations AS (
                    ${filteredConversationsSql}
                )
            `);

            const sql = `
                WITH ${ctes.join(',\n')}
                SELECT
                    fc.*,
                    l.name as lead_name,
                    l.phone,
                    l.vehicle,
                    l.custom_fields as lead_custom_fields,
                    u.name as agent_name
                FROM filtered_conversations fc
                JOIN leads l ON fc.lead_id = l.id
                LEFT JOIN users u ON fc.assigned_to = u.id
                ORDER BY fc.updated_at DESC
            `;

            return await query(sql, params);
        }
    };

    return model;
}

module.exports = {
    createConversationModel
};
