function createMessageQueueModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const normalizeBooleanFlag = options.normalizeBooleanFlag;
    const toJsonStringOrNull = options.toJsonStringOrNull;
    const parsePositiveInteger = options.parsePositiveInteger;

    function appendMessageQueueOwnerScopeFilter(sql, params, ownerUserId, tableAlias = 'message_queue') {
        const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
        if (!normalizedOwnerUserId) return sql;
        params.push(normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId);

        return `${sql}
            AND EXISTS (
                SELECT 1
                FROM leads queue_leads
                WHERE queue_leads.id = ${tableAlias}.lead_id
                  AND (
                      queue_leads.owner_user_id = ?
                      OR (
                          queue_leads.owner_user_id IS NULL
                          AND EXISTS (
                              SELECT 1
                              FROM users owner_scope
                              WHERE owner_scope.id = queue_leads.assigned_to
                                AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                          )
                      )
                  )
            )
        `;
    }

    const model = {
        async add(data) {
            const uuid = generateUUID();

            const result = await run(`
                INSERT INTO message_queue (
                    uuid, lead_id, conversation_id, campaign_id, session_id, is_first_contact, assignment_meta,
                    content, media_type, media_url, priority, scheduled_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                data.lead_id,
                data.conversation_id,
                data.campaign_id || null,
                data.session_id || null,
                normalizeBooleanFlag(data.is_first_contact, 1),
                toJsonStringOrNull(data.assignment_meta),
                data.content,
                data.media_type || 'text',
                data.media_url,
                data.priority || 0,
                data.scheduled_at
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async getNext() {
            return await queryOne(`
                SELECT * FROM message_queue
                WHERE status = 'pending'
                AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
                AND attempts < max_attempts
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
            `);
        },

        async markProcessing(id) {
            return await run(`
                UPDATE message_queue
                SET status = 'processing', attempts = attempts + 1
                WHERE id = ?
            `, [id]);
        },

        async markSent(id) {
            return await run(`
                UPDATE message_queue
                SET status = 'sent',
                    error_message = NULL,
                    processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);
        },

        async markFailed(id, errorMessage, options = {}) {
            const nextScheduledAt = options?.next_scheduled_at || options?.nextScheduledAt || null;
            const errorText = String(errorMessage || '');
            const normalizedError = errorText
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
            const isDisconnectedSessionError =
                normalizedError.includes('not connected') ||
                normalizedError.includes('nao esta conectado') ||
                normalizedError.includes('nÃ£o estÃ¡ conectado') ||
                (
                    normalizedError.includes('conectad') &&
                    (normalizedError.includes('sess') || normalizedError.includes('whatsapp') || normalizedError.includes('conexao'))
                );

            if (!nextScheduledAt && isDisconnectedSessionError) {
                const retryAt = new Date(Date.now() + 60 * 1000).toISOString();
                console.log(`[QueueDebug][model] MODEL_MARKFAILED_FALLBACK_TO_REQUEUE messageId=${id} retryAt=${retryAt} error=${errorText}`);
                return await model.requeueTransient(id, `[M_REQUEUE] ${errorMessage}`, retryAt);
            }

            if (nextScheduledAt) {
                console.log(`[QueueDebug][model] MODEL_MARKFAILED_WITH_SCHEDULE messageId=${id} nextScheduledAt=${nextScheduledAt} error=${errorText}`);
                return await run(`
                    UPDATE message_queue
                    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                        error_message = ?,
                        scheduled_at = CASE
                            WHEN attempts >= max_attempts THEN scheduled_at
                            ELSE ?
                        END
                    WHERE id = ?
                `, [errorMessage, nextScheduledAt, id]);
            }

            console.log(`[QueueDebug][model] MODEL_MARKFAILED_DIRECT messageId=${id} error=${errorText}`);
            return await run(`
                UPDATE message_queue
                SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                    error_message = ?
                WHERE id = ?
            `, [`[M_FAIL_DIRECT] ${errorMessage}`, id]);
        },

        async requeueTransient(id, errorMessage, nextScheduledAt) {
            const scheduledAt = nextScheduledAt || new Date(Date.now() + 60 * 1000).toISOString();
            console.log(`[QueueDebug][model] MODEL_REQUEUE_TRANSIENT messageId=${id} scheduledAt=${scheduledAt} error=${String(errorMessage || '')}`);

            return await run(`
                UPDATE message_queue
                SET status = 'pending',
                    error_message = ?,
                    scheduled_at = ?,
                    processed_at = NULL,
                    attempts = CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END
                WHERE id = ?
            `, [errorMessage, scheduledAt, id]);
        },

        async setAssignment(id, sessionId, assignmentMeta = null) {
            return await run(`
                UPDATE message_queue
                SET session_id = ?, assignment_meta = ?
                WHERE id = ?
            `, [sessionId || null, toJsonStringOrNull(assignmentMeta), id]);
        },

        async cancel(id, options = {}) {
            const messageId = parsePositiveInteger(id, null);
            if (!messageId) {
                return { changes: 0, lastInsertRowid: null };
            }

            const ownerUserId = parsePositiveInteger(options?.owner_user_id, null);
            const params = [messageId];
            let sql = `UPDATE message_queue SET status = 'cancelled' WHERE id = ?`;

            if (ownerUserId) {
                sql = appendMessageQueueOwnerScopeFilter(sql, params, ownerUserId, 'message_queue');
            }

            return await run(sql, params);
        },

        async getPending(options = {}) {
            const params = [];
            const readyOnly = options?.ready_only === true || options?.readyOnly === true;
            const onlyActiveCampaigns = options?.only_active_campaigns === true || options?.onlyActiveCampaigns === true;
            const ownerUserId = parsePositiveInteger(options?.owner_user_id, null);
            const limit = Number(options?.limit || 0);

            let sql = `
                SELECT * FROM message_queue
                WHERE status = 'pending'
            `;

            if (readyOnly) {
                sql += `
                    AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
                    AND attempts < max_attempts
                `;
            }

            if (onlyActiveCampaigns) {
                sql += `
                    AND (
                        campaign_id IS NULL
                        OR EXISTS (
                            SELECT 1
                            FROM campaigns
                            WHERE campaigns.id = message_queue.campaign_id
                              AND campaigns.status = 'active'
                        )
                    )
                `;
            }

            if (ownerUserId) {
                sql = appendMessageQueueOwnerScopeFilter(sql, params, ownerUserId, 'message_queue');
            }

            sql += ' ORDER BY priority DESC, created_at ASC';

            if (Number.isFinite(limit) && limit > 0) {
                sql += ' LIMIT ?';
                params.push(Math.floor(limit));
            }

            return await query(sql, params);
        },

        async listLeadIdsWithQueuedOrSentForCampaign(campaignId, leadIds = []) {
            const normalizedCampaignId = Number(campaignId || 0);
            if (!Number.isInteger(normalizedCampaignId) || normalizedCampaignId <= 0) {
                return [];
            }

            const normalizedLeadIds = Array.from(
                new Set(
                    (Array.isArray(leadIds) ? leadIds : [])
                        .map((value) => Number(value))
                        .filter((value) => Number.isInteger(value) && value > 0)
                )
            );

            const params = [normalizedCampaignId];
            let sql = `
                SELECT DISTINCT lead_id
                FROM message_queue
                WHERE campaign_id = ?
                  AND status IN ('pending', 'processing', 'sent')
            `;

            if (normalizedLeadIds.length > 0) {
                sql += ' AND lead_id = ANY(?::int[])';
                params.push(normalizedLeadIds);
            }

            const rows = await query(sql, params);
            return (rows || [])
                .map((row) => Number(row?.lead_id || 0))
                .filter((value) => Number.isInteger(value) && value > 0);
        },

        async hasQueuedOrSentForCampaignLead(campaignId, leadId) {
            const row = await queryOne(`
                SELECT id
                FROM message_queue
                WHERE campaign_id = ?
                  AND lead_id = ?
                  AND status IN ('pending', 'processing', 'sent')
                LIMIT 1
            `, [campaignId, leadId]);
            return !!row;
        },

        async getCampaignProgress(campaignId) {
            const row = await queryOne(`
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
                FROM message_queue
                WHERE campaign_id = ?
            `, [campaignId]);

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

    return model;
}

module.exports = {
    createMessageQueueModel
};
