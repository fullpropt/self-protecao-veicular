function createCampaignModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const normalizeBooleanFlag = options.normalizeBooleanFlag;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    return {
        async create(data) {
            const uuid = generateUUID();
            const sendWindowEnabled = normalizeBooleanFlag(data.send_window_enabled, 0);
            const sendWindowStart = String(data.send_window_start || '').trim() || null;
            const sendWindowEnd = String(data.send_window_end || '').trim() || null;

            const result = await run(`
                INSERT INTO campaigns (
                    uuid, name, description, type, distribution_strategy, distribution_config,
                    status, segment, tag_filter, message, delay, delay_min, delay_max, start_at,
                    send_window_enabled, send_window_start, send_window_end, created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.name,
                data.description,
                data.type || 'broadcast',
                String(data.distribution_strategy || 'single').trim() || 'single',
                toJsonStringOrNull(data.distribution_config),
                data.status || 'draft',
                data.segment,
                data.tag_filter || null,
                data.message,
                data.delay || data.delay_min || 0,
                data.delay_min || data.delay || 0,
                data.delay_max || data.delay_min || data.delay || 0,
                data.start_at,
                sendWindowEnabled,
                sendWindowStart,
                sendWindowEnd,
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
                        campaigns.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = campaigns.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            }

            if (createdBy) {
                filters += ' AND campaigns.created_by = ?';
                params.push(createdBy);
            }

            return await queryOne(`
                SELECT campaigns.*
                FROM campaigns
                WHERE campaigns.id = ?
                ${filters}
            `, params);
        },

        async list(options = {}) {
            let sql = 'SELECT campaigns.* FROM campaigns WHERE 1=1';
            const params = [];
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            const createdBy = parsePositiveInteger(options.created_by, null);

            if (options.status) {
                sql += ' AND status = ?';
                params.push(options.status);
            }

            if (options.type) {
                sql += ' AND type = ?';
                params.push(options.type);
            }

            if (ownerUserId) {
                sql += `
                    AND (
                        campaigns.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = campaigns.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            }

            if (createdBy) {
                sql += ' AND campaigns.created_by = ?';
                params.push(createdBy);
            }

            if (options.search) {
                sql += ' AND (campaigns.name LIKE ? OR campaigns.description LIKE ?)';
                params.push(`%${options.search}%`, `%${options.search}%`);
            }

            sql += ' ORDER BY campaigns.created_at DESC';

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
                'name', 'description', 'type', 'status', 'segment', 'tag_filter',
                'message', 'delay', 'delay_min', 'delay_max', 'start_at', 'sent', 'delivered', 'read', 'replied',
                'distribution_strategy', 'distribution_config',
                'send_window_enabled', 'send_window_start', 'send_window_end'
            ];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    if (key === 'distribution_strategy') {
                        values.push(String(value || '').trim() || 'single');
                    } else if (key === 'distribution_config') {
                        values.push(toJsonStringOrNull(value));
                    } else if (key === 'send_window_enabled') {
                        values.push(normalizeBooleanFlag(value, 0));
                    } else if (key === 'send_window_start' || key === 'send_window_end') {
                        values.push(String(value || '').trim() || null);
                    } else {
                        values.push(value);
                    }
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            return await run(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values);
        },

        async refreshMetrics(id) {
            const sentStats = await queryOne(`
                SELECT
                    COUNT(*) as sent,
                    SUM(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read
                FROM messages
                WHERE campaign_id = ?
            `, [id]);

            const repliedStats = await queryOne(`
                SELECT COUNT(DISTINCT incoming.lead_id) as replied
                FROM messages incoming
                WHERE incoming.is_from_me = 0
                  AND EXISTS (
                    SELECT 1
                    FROM messages outgoing
                    WHERE outgoing.campaign_id = ?
                      AND outgoing.is_from_me = 1
                      AND outgoing.lead_id = incoming.lead_id
                      AND COALESCE(outgoing.sent_at, outgoing.created_at) <= COALESCE(incoming.sent_at, incoming.created_at)
                  )
            `, [id]);

            const metrics = {
                sent: Number(sentStats?.sent || 0),
                delivered: Number(sentStats?.delivered || 0),
                read: Number(sentStats?.read || 0),
                replied: Number(repliedStats?.replied || 0)
            };

            await run(`
                UPDATE campaigns
                SET sent = ?, delivered = ?, read = ?, replied = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [metrics.sent, metrics.delivered, metrics.read, metrics.replied, id]);

            return metrics;
        },

        async refreshMetricsByLead(leadId) {
            const rows = await query(`
                SELECT DISTINCT campaign_id
                FROM messages
                WHERE lead_id = ? AND campaign_id IS NOT NULL
            `, [leadId]);

            for (const row of rows) {
                await this.refreshMetrics(row.campaign_id);
            }
        },

        async delete(id) {
            return await run('DELETE FROM campaigns WHERE id = ?', [id]);
        }
    };
}

module.exports = {
    createCampaignModel
};
