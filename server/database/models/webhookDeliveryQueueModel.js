function createWebhookDeliveryQueueModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const parseNonNegativeInteger = options.parseNonNegativeInteger;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    return {
        async add(data) {
            const webhookId = parsePositiveInteger(data?.webhook_id ?? data?.webhookId, null);
            if (!webhookId) {
                throw new Error('webhook_id invalido');
            }

            const event = String(data?.event || '').trim();
            if (!event) {
                throw new Error('event invalido');
            }

            const dedupeKey = String((data?.dedupe_key ?? data?.dedupeKey) || '').trim().slice(0, 255);
            if (!dedupeKey) {
                throw new Error('dedupe_key invalido');
            }

            const payload = toJsonStringOrNull(data?.payload);
            if (!payload) {
                throw new Error('payload invalido');
            }

            const maxAttempts = Math.max(
                1,
                Math.min(
                    20,
                    parsePositiveInteger(data?.max_attempts ?? data?.maxAttempts, 3) || 3
                )
            );
            const nextAttemptAt = data?.next_attempt_at ?? data?.nextAttemptAt ?? null;
            const uuid = generateUUID();

            const inserted = await queryOne(`
                INSERT INTO webhook_delivery_queue (
                    uuid, webhook_id, event, payload, dedupe_key, max_attempts, next_attempt_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (webhook_id, dedupe_key) DO NOTHING
                RETURNING id, uuid, webhook_id, event, dedupe_key, status, attempts, max_attempts, next_attempt_at, created_at
            `, [
                uuid,
                webhookId,
                event,
                payload,
                dedupeKey,
                maxAttempts,
                nextAttemptAt
            ]);

            if (inserted) {
                return {
                    ...inserted,
                    created: true,
                    duplicated: false
                };
            }

            const existing = await queryOne(`
                SELECT id, uuid, webhook_id, event, dedupe_key, status, attempts, max_attempts, next_attempt_at, created_at
                FROM webhook_delivery_queue
                WHERE webhook_id = ?
                  AND dedupe_key = ?
                LIMIT 1
            `, [webhookId, dedupeKey]);

            return {
                ...(existing || {}),
                created: false,
                duplicated: true
            };
        },

        async findById(id) {
            return await queryOne('SELECT * FROM webhook_delivery_queue WHERE id = ?', [id]);
        },

        async getPending(options = {}) {
            const limit = parsePositiveInteger(options?.limit, 20) || 20;
            return await query(`
                SELECT *
                FROM webhook_delivery_queue
                WHERE status = 'pending'
                  AND attempts < max_attempts
                  AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
                ORDER BY COALESCE(next_attempt_at, created_at) ASC, id ASC
                LIMIT ?
            `, [limit]);
        },

        async markProcessing(id) {
            return await run(`
                UPDATE webhook_delivery_queue
                SET status = 'processing',
                    attempts = attempts + 1,
                    locked_at = CURRENT_TIMESTAMP,
                    processed_at = NULL
                WHERE id = ?
            `, [id]);
        },

        async markSent(id, options = {}) {
            const responseStatus = parseNonNegativeInteger(options?.response_status ?? options?.responseStatus, null);
            const responseBody = String((options?.response_body ?? options?.responseBody) || '').slice(0, 2000) || null;
            const durationMs = parseNonNegativeInteger(options?.duration_ms ?? options?.durationMs, null);

            return await run(`
                UPDATE webhook_delivery_queue
                SET status = 'sent',
                    next_attempt_at = NULL,
                    locked_at = NULL,
                    last_error = NULL,
                    response_status = ?,
                    response_body = ?,
                    duration_ms = ?,
                    processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [responseStatus, responseBody, durationMs, id]);
        },

        async markFailed(id, errorMessage, options = {}) {
            const nextAttemptAt = options?.next_attempt_at ?? options?.nextAttemptAt ?? null;
            const responseStatus = parseNonNegativeInteger(options?.response_status ?? options?.responseStatus, null);
            const responseBody = String((options?.response_body ?? options?.responseBody) || '').slice(0, 2000) || null;
            const durationMs = parseNonNegativeInteger(options?.duration_ms ?? options?.durationMs, null);
            const normalizedError = String(errorMessage || '').slice(0, 1000) || 'Falha desconhecida na entrega';

            return await run(`
                UPDATE webhook_delivery_queue
                SET status = CASE
                        WHEN attempts >= max_attempts THEN 'failed'
                        ELSE 'pending'
                    END,
                    next_attempt_at = CASE
                        WHEN attempts >= max_attempts THEN NULL
                        ELSE ?
                    END,
                    locked_at = NULL,
                    last_error = ?,
                    response_status = ?,
                    response_body = ?,
                    duration_ms = ?,
                    processed_at = CASE
                        WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
                WHERE id = ?
            `, [nextAttemptAt, normalizedError, responseStatus, responseBody, durationMs, id]);
        },

        async markCancelled(id, reason = 'Cancelado') {
            return await run(`
                UPDATE webhook_delivery_queue
                SET status = 'cancelled',
                    next_attempt_at = NULL,
                    locked_at = NULL,
                    last_error = ?,
                    processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [String(reason || 'Cancelado').slice(0, 500), id]);
        },

        async requeueStuck(staleAfterMs = 120000) {
            const safeStaleMs = Math.max(5000, parseNonNegativeInteger(staleAfterMs, 120000));
            const result = await run(`
                UPDATE webhook_delivery_queue
                SET status = 'pending',
                    next_attempt_at = CURRENT_TIMESTAMP,
                    locked_at = NULL,
                    processed_at = NULL,
                    last_error = COALESCE(last_error, '[WEBHOOK_RECOVERY] Reenfileirado apos processamento interrompido')
                WHERE status = 'processing'
                  AND locked_at IS NOT NULL
                  AND locked_at <= (CURRENT_TIMESTAMP - (? * INTERVAL '1 millisecond'))
            `, [safeStaleMs]);

            return Number(result?.changes || 0);
        },

        async getStats() {
            const row = await queryOne(`
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
                FROM webhook_delivery_queue
            `);

            return {
                total: Number(row?.total || 0),
                pending: Number(row?.pending || 0),
                processing: Number(row?.processing || 0),
                sent: Number(row?.sent || 0),
                failed: Number(row?.failed || 0),
                cancelled: Number(row?.cancelled || 0)
            };
        }
    };
}

module.exports = {
    createWebhookDeliveryQueueModel
};
