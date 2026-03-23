function createMessageModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;

    return {
        async create(data) {
            const uuid = generateUUID();

            const result = await run(`
                INSERT INTO messages (uuid, message_id, conversation_id, lead_id, sender_type, sender_id, content, content_encrypted, media_type, media_url, media_mime_type, media_filename, status, is_from_me, reply_to_id, campaign_id, metadata, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.message_id,
                data.conversation_id,
                data.lead_id,
                data.sender_type || (data.is_from_me ? 'agent' : 'lead'),
                data.sender_id,
                data.content,
                data.content_encrypted,
                data.media_type || 'text',
                data.media_url,
                data.media_mime_type,
                data.media_filename,
                data.status || 'pending',
                data.is_from_me ? 1 : 0,
                data.reply_to_id,
                data.campaign_id || null,
                JSON.stringify(data.metadata || {}),
                data.sent_at || new Date().toISOString()
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id) {
            return await queryOne('SELECT * FROM messages WHERE id = ?', [id]);
        },

        async findByMessageId(messageId) {
            return await queryOne('SELECT * FROM messages WHERE message_id = ?', [messageId]);
        },

        async updateStatus(messageId, status, timestamp = null) {
            const updates = { status };

            if (status === 'delivered' && timestamp) {
                updates.delivered_at = timestamp;
            } else if (status === 'read' && timestamp) {
                updates.read_at = timestamp;
            }

            const fields = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
            const values = [...Object.values(updates), messageId];

            return await run(`UPDATE messages SET ${fields} WHERE message_id = ?`, values);
        },

        async listByConversation(conversationId, options = {}) {
            const limit = Number(options.limit || 0);
            const offset = Number(options.offset || 0);

            if (Number.isFinite(limit) && limit > 0 && (!Number.isFinite(offset) || offset <= 0)) {
                return await query(`
                    SELECT *
                    FROM (
                        SELECT *
                        FROM messages
                        WHERE conversation_id = ?
                        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
                        LIMIT ?
                    ) recent_messages
                    ORDER BY COALESCE(sent_at, created_at) ASC, id ASC
                `, [conversationId, Math.floor(limit)]);
            }

            let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
            const params = [conversationId];

            sql += ' ORDER BY COALESCE(sent_at, created_at) ASC, id ASC';

            if (Number.isFinite(limit) && limit > 0) {
                sql += ' LIMIT ?';
                params.push(Math.floor(limit));
            }

            if (Number.isFinite(offset) && offset > 0) {
                sql += ' OFFSET ?';
                params.push(Math.floor(offset));
            }

            return await query(sql, params);
        },

        async listByLead(leadId, options = {}) {
            const limit = Number(options.limit || 0);
            const offset = Number(options.offset || 0);

            if (Number.isFinite(limit) && limit > 0 && (!Number.isFinite(offset) || offset <= 0)) {
                return await query(`
                    SELECT *
                    FROM (
                        SELECT *
                        FROM messages
                        WHERE lead_id = ?
                        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
                        LIMIT ?
                    ) recent_messages
                    ORDER BY COALESCE(sent_at, created_at) ASC, id ASC
                `, [leadId, Math.floor(limit)]);
            }

            let sql = 'SELECT * FROM messages WHERE lead_id = ?';
            const params = [leadId];

            sql += ' ORDER BY COALESCE(sent_at, created_at) ASC, id ASC';

            if (Number.isFinite(limit) && limit > 0) {
                sql += ' LIMIT ?';
                params.push(Math.floor(limit));
            }

            if (Number.isFinite(offset) && offset > 0) {
                sql += ' OFFSET ?';
                params.push(Math.floor(offset));
            }

            return await query(sql, params);
        },

        async getLastByLead(leadId) {
            return await queryOne('SELECT * FROM messages WHERE lead_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1', [leadId]);
        },

        async getLastMessage(conversationId) {
            return await queryOne('SELECT * FROM messages WHERE conversation_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1', [conversationId]);
        },

        async getLastMessagesByConversationIds(conversationIds = []) {
            const ids = Array.from(
                new Set(
                    (Array.isArray(conversationIds) ? conversationIds : [])
                        .map((id) => Number(id))
                        .filter((id) => Number.isInteger(id) && id > 0)
                )
            );

            if (ids.length === 0) return [];

            const placeholders = ids.map(() => '?').join(', ');
            return await query(`
                SELECT DISTINCT ON (conversation_id) *
                FROM messages
                WHERE conversation_id IN (${placeholders})
                ORDER BY conversation_id, COALESCE(sent_at, created_at) DESC, id DESC
            `, ids);
        },

        async hasCampaignDelivery(campaignId, leadId) {
            const row = await queryOne(`
                SELECT id
                FROM messages
                WHERE campaign_id = ?
                  AND lead_id = ?
                  AND is_from_me = 1
                LIMIT 1
            `, [campaignId, leadId]);
            return !!row;
        }
    };
}

module.exports = {
    createMessageModel
};
