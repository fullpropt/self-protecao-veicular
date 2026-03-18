function createWebhookModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const appendOwnerCreatedByFilters = options.appendOwnerCreatedByFilters;

    const model = {
        async create(data) {
            const uuid = generateUUID();

            const result = await run(`
                INSERT INTO webhooks (uuid, name, url, secret, events, headers, is_active, retry_count, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.name,
                data.url,
                data.secret,
                JSON.stringify(data.events || []),
                JSON.stringify(data.headers || {}),
                data.is_active !== undefined ? data.is_active : 1,
                data.retry_count || 3,
                data.created_by
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id, optionsScope = {}) {
            const filters = ['webhooks.id = ?'];
            const params = [id];
            appendOwnerCreatedByFilters(filters, params, optionsScope, { tableAlias: 'webhooks' });

            return await queryOne(`
                SELECT webhooks.*
                FROM webhooks
                WHERE ${filters.join(' AND ')}
            `, params);
        },

        async findByEvent(event, optionsScope = {}) {
            const filters = [
                'webhooks.is_active = 1',
                'webhooks.events LIKE ?'
            ];
            const params = [`%"${event}"%`];
            appendOwnerCreatedByFilters(filters, params, optionsScope, { tableAlias: 'webhooks' });

            return await query(`
                SELECT webhooks.*
                FROM webhooks
                WHERE ${filters.join(' AND ')}
            `, params);
        },

        async list(optionsScope = {}) {
            const filters = [];
            const params = [];
            appendOwnerCreatedByFilters(filters, params, optionsScope, { tableAlias: 'webhooks' });

            const whereClause = filters.length > 0
                ? `WHERE ${filters.join(' AND ')}`
                : '';

            return await query(`
                SELECT webhooks.*
                FROM webhooks
                ${whereClause}
                ORDER BY webhooks.name ASC
            `, params);
        },

        async update(id, data, optionsScope = {}) {
            const existing = await model.findById(id, optionsScope);
            if (!existing) return null;

            const fields = [];
            const values = [];

            const allowedFields = ['name', 'url', 'secret', 'events', 'headers', 'is_active', 'retry_count'];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            if (fields.length === 0) return existing;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);
            return await model.findById(id, optionsScope);
        },

        async logTrigger(webhookId, event, payload, responseStatus, responseBody, durationMs) {
            return await run(`
                INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, duration_ms)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [webhookId, event, JSON.stringify(payload), responseStatus, responseBody, durationMs]);
        },

        async delete(id, optionsScope = {}) {
            const existing = await model.findById(id, optionsScope);
            if (!existing) return null;
            return await run('DELETE FROM webhooks WHERE id = ?', [id]);
        }
    };

    return model;
}

module.exports = {
    createWebhookModel
};
