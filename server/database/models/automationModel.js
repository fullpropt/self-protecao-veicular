function createAutomationModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;

    return {
        async create(data) {
            const uuid = generateUUID();
            const isActive = typeof data.is_active === 'boolean' ? (data.is_active ? 1 : 0) : (data.is_active ?? 1);

            const result = await run(`
                INSERT INTO automations (uuid, name, description, trigger_type, trigger_value, action_type, action_value, delay, session_scope, tag_filter, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.name,
                data.description,
                data.trigger_type,
                data.trigger_value,
                data.action_type,
                data.action_value,
                data.delay || 0,
                data.session_scope || null,
                data.tag_filter || null,
                isActive,
                data.created_by
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id, options = {}) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [id];
            let ownerFilter = '';

            if (ownerUserId) {
                ownerFilter = `
                    AND (
                        automations.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = automations.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                ownerFilter = ' AND automations.created_by = ?';
                params.push(createdBy);
            }

            return await queryOne(`
                SELECT automations.*
                FROM automations
                WHERE automations.id = ?
                ${ownerFilter}
            `, params);
        },

        async list(options = {}) {
            let sql = 'SELECT * FROM automations WHERE 1=1';
            const params = [];

            if (options.is_active !== undefined) {
                sql += ' AND is_active = ?';
                params.push(options.is_active ? 1 : 0);
            }

            if (options.trigger_type) {
                sql += ' AND trigger_type = ?';
                params.push(options.trigger_type);
            }

            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);

            if (ownerUserId) {
                sql += `
                    AND (
                        automations.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = automations.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                sql += ' AND automations.created_by = ?';
                params.push(createdBy);
            }

            if (options.search) {
                sql += ' AND (name LIKE ? OR description LIKE ?)';
                params.push(`%${options.search}%`, `%${options.search}%`);
            }

            sql += ' ORDER BY created_at DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            if (options.offset) {
                sql += ' OFFSET ?';
                params.push(options.offset);
            }

            return await query(sql, params);
        },

        async update(id, data) {
            const fields = [];
            const values = [];

            const allowedFields = [
                'name', 'description', 'trigger_type', 'trigger_value',
                'action_type', 'action_value', 'delay', 'session_scope', 'tag_filter', 'is_active', 'executions', 'last_execution'
            ];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    if (key === 'is_active' && typeof value === 'boolean') {
                        values.push(value ? 1 : 0);
                    } else {
                        values.push(value);
                    }
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            return await run(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`, values);
        },

        async delete(id) {
            return await run('DELETE FROM automations WHERE id = ?', [id]);
        }
    };
}

module.exports = {
    createAutomationModel
};
