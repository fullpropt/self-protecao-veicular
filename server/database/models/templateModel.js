function createTemplateModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;

    return {
        async create(data) {
            const uuid = generateUUID();

            const result = await run(`
                INSERT INTO templates (uuid, name, category, content, variables, media_url, media_type, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.name,
                data.category || 'general',
                data.content,
                JSON.stringify(data.variables || ['nome', 'telefone', 'email']),
                data.media_url,
                data.media_type,
                data.created_by
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id, options = {}) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            const createdBy = parsePositiveInteger(options.created_by, null);
            const params = [id];
            let filters = '';

            if (ownerUserId) {
                filters += `
                    AND (
                        templates.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = templates.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            }

            if (createdBy) {
                filters += ' AND templates.created_by = ?';
                params.push(createdBy);
            }

            return await queryOne(`
                SELECT templates.*
                FROM templates
                WHERE templates.id = ?
                ${filters}
            `, params);
        },

        async list(options = {}) {
            let sql = 'SELECT templates.* FROM templates WHERE templates.is_active = 1';
            const params = [];

            if (options.category) {
                sql += ' AND templates.category = ?';
                params.push(options.category);
            }

            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            const createdBy = parsePositiveInteger(options.created_by, null);

            if (ownerUserId) {
                sql += `
                    AND (
                        templates.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = templates.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            }

            if (createdBy) {
                sql += ' AND templates.created_by = ?';
                params.push(createdBy);
            }

            sql += ' ORDER BY usage_count DESC, name ASC';

            return await query(sql, params);
        },

        async incrementUsage(id) {
            return await run('UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?', [id]);
        },

        async update(id, data) {
            const fields = [];
            const values = [];

            const allowedFields = ['name', 'category', 'content', 'variables', 'media_url', 'media_type', 'is_active'];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            return await run(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`, values);
        },

        async delete(id) {
            return await run('UPDATE templates SET is_active = 0 WHERE id = ?', [id]);
        }
    };
}

module.exports = {
    createTemplateModel
};
