function createSupportInboxMessageModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const parsePositiveInteger = options.parsePositiveInteger;
    const parseNonNegativeInteger = options.parseNonNegativeInteger;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    return {
        async upsert(data = {}) {
            const externalMessageId = String((data?.external_message_id ?? data?.externalMessageId) || '').trim().slice(0, 255) || null;
            const provider = String(data?.provider || 'unknown').trim().toLowerCase().slice(0, 40) || 'unknown';
            const fromName = String((data?.from_name ?? data?.fromName) || '').trim().slice(0, 255) || null;
            const fromEmail = String((data?.from_email ?? data?.fromEmail) || '').trim().toLowerCase().slice(0, 255);
            const toEmail = String((data?.to_email ?? data?.toEmail) || 'support@zapvender.com').trim().toLowerCase().slice(0, 255) || 'support@zapvender.com';
            const subject = String(data?.subject || '').trim().slice(0, 500) || '(Sem assunto)';
            const bodyText = String((data?.body_text ?? data?.bodyText) || '').slice(0, 25000) || null;
            const bodyHtml = String((data?.body_html ?? data?.bodyHtml) || '').slice(0, 150000) || null;
            const rawPayload = toJsonStringOrNull(data?.raw_payload ?? data?.rawPayload);
            const receivedAt = data?.received_at ?? data?.receivedAt ?? new Date().toISOString();

            if (!fromEmail) {
                throw new Error('from_email invalido');
            }

            if (externalMessageId) {
                const existing = await queryOne(
                    'SELECT id FROM support_inbox_messages WHERE external_message_id = ? LIMIT 1',
                    [externalMessageId]
                );

                if (existing?.id) {
                    await run(`
                        UPDATE support_inbox_messages
                        SET provider = ?,
                            from_name = ?,
                            from_email = ?,
                            to_email = ?,
                            subject = ?,
                            body_text = ?,
                            body_html = ?,
                            raw_payload = ?,
                            received_at = ?,
                            is_read = 0
                        WHERE id = ?
                    `, [
                        provider,
                        fromName,
                        fromEmail,
                        toEmail,
                        subject,
                        bodyText,
                        bodyHtml,
                        rawPayload,
                        receivedAt,
                        existing.id
                    ]);

                    return { id: Number(existing.id), created: false };
                }
            }

            const result = await run(`
                INSERT INTO support_inbox_messages (
                    external_message_id, provider, from_name, from_email, to_email, subject,
                    body_text, body_html, raw_payload, received_at, is_read
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                externalMessageId,
                provider,
                fromName,
                fromEmail,
                toEmail,
                subject,
                bodyText,
                bodyHtml,
                rawPayload,
                receivedAt,
                0
            ]);

            return { id: result.lastInsertRowid, created: true };
        },

        async list(options = {}) {
            const limit = Math.max(1, Math.min(100, parsePositiveInteger(options?.limit, 30) || 30));
            const offset = Math.max(0, parseNonNegativeInteger(options?.offset, 0));
            const unreadOnly = options?.unread_only === true || options?.unreadOnly === true;
            const params = [];

            let sql = `
                SELECT *
                FROM support_inbox_messages
                WHERE 1 = 1
            `;

            if (unreadOnly) {
                sql += ' AND COALESCE(is_read, 0) = 0';
            }

            sql += `
                ORDER BY COALESCE(received_at, created_at) DESC, id DESC
                LIMIT ?
                OFFSET ?
            `;
            params.push(limit, offset);

            return await query(sql, params);
        },

        async count(options = {}) {
            const unreadOnly = options?.unread_only === true || options?.unreadOnly === true;
            let sql = 'SELECT COUNT(*) AS total FROM support_inbox_messages WHERE 1 = 1';
            const params = [];

            if (unreadOnly) {
                sql += ' AND COALESCE(is_read, 0) = 0';
            }

            const row = await queryOne(sql, params);
            return Number(row?.total || 0);
        },

        async markRead(id, isRead = true) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) {
                throw new Error('id invalido');
            }

            return await run(
                'UPDATE support_inbox_messages SET is_read = ? WHERE id = ?',
                [isRead ? 1 : 0, normalizedId]
            );
        },

        async findById(id) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) return null;
            return await queryOne('SELECT * FROM support_inbox_messages WHERE id = ? LIMIT 1', [normalizedId]);
        }
    };
}

module.exports = {
    createSupportInboxMessageModel
};
