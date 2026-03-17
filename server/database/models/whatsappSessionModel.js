function createWhatsAppSessionModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const parsePositiveInteger = options.parsePositiveInteger;
    const parseNonNegativeInteger = options.parseNonNegativeInteger;
    const normalizeBooleanFlag = options.normalizeBooleanFlag;
    const assertOwnerCanCreateWhatsAppSession = options.assertOwnerCanCreateWhatsAppSession;
    const normalizeSessionScopeList = options.normalizeSessionScopeList;
    const parsePlainObject = options.parsePlainObject;
    const updateAutomation = options.updateAutomation;
    const settingsGet = options.settingsGet;
    const settingsSet = options.settingsSet;

    return {
        async list(options = {}) {
            const includeDisabled = options.includeDisabled !== false;
            const createdBy = parsePositiveInteger(options.created_by);
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const filters = [];
            const params = [];

            if (ownerUserId) {
                filters.push(`
                    (
                        whatsapp_sessions.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = whatsapp_sessions.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `);
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                filters.push('created_by = ?');
                params.push(createdBy);
            }

            if (!includeDisabled) {
                filters.push('COALESCE(campaign_enabled, 1) = 1');
            }

            const rows = await query(`
                SELECT
                    id,
                    session_id,
                    phone,
                    name,
                    status,
                    COALESCE(campaign_enabled, 1) AS campaign_enabled,
                    COALESCE(daily_limit, 0) AS daily_limit,
                    COALESCE(dispatch_weight, 1) AS dispatch_weight,
                    COALESCE(hourly_limit, 0) AS hourly_limit,
                    cooldown_until,
                    qr_code,
                    last_connected_at,
                    created_by,
                    created_at,
                    updated_at
                FROM whatsapp_sessions
                ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
                ORDER BY updated_at DESC, id DESC
            `, params);
            return rows.map((row) => ({
                ...row,
                campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
                daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
                dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
                hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
                created_by: parsePositiveInteger(row.created_by)
            }));
        },

        async findBySessionId(sessionId, options = {}) {
            const normalizedSessionId = String(sessionId || '').trim();
            if (!normalizedSessionId) return null;
            const ownerUserId = parsePositiveInteger(options.owner_user_id);
            const createdBy = parsePositiveInteger(options.created_by);
            const params = [normalizedSessionId];
            let ownerFilter = '';
            if (ownerUserId) {
                ownerFilter = `
                    AND (
                        whatsapp_sessions.created_by = ?
                        OR EXISTS (
                            SELECT 1
                            FROM users u
                            WHERE u.id = whatsapp_sessions.created_by
                              AND (u.owner_user_id = ? OR u.id = ?)
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId);
            } else if (createdBy) {
                ownerFilter = ' AND created_by = ?';
                params.push(createdBy);
            }

            const row = await queryOne(`
                SELECT
                    id,
                    session_id,
                    phone,
                    name,
                    status,
                    COALESCE(campaign_enabled, 1) AS campaign_enabled,
                    COALESCE(daily_limit, 0) AS daily_limit,
                    COALESCE(dispatch_weight, 1) AS dispatch_weight,
                    COALESCE(hourly_limit, 0) AS hourly_limit,
                    cooldown_until,
                    qr_code,
                    last_connected_at,
                    created_by,
                    created_at,
                    updated_at
                FROM whatsapp_sessions
                WHERE session_id = ?
                ${ownerFilter}
            `, params);

            if (!row) return null;

            return {
                ...row,
                campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
                daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
                dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
                hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
                created_by: parsePositiveInteger(row.created_by)
            };
        },

        async upsertDispatchConfig(sessionId, data = {}) {
            const normalizedSessionId = String(sessionId || '').trim();
            if (!normalizedSessionId) {
                throw new Error('session_id e obrigatorio');
            }

            const existing = await this.findBySessionId(normalizedSessionId);
            const existingCreatedBy = parsePositiveInteger(existing?.created_by);
            const requestedOwnerUserId = parsePositiveInteger(data.owner_user_id);
            const requestedCreatedBy = parsePositiveInteger(data.created_by);
            if (requestedOwnerUserId && existing) {
                const ownedExisting = await this.findBySessionId(normalizedSessionId, {
                    owner_user_id: requestedOwnerUserId
                });
                if (!ownedExisting) {
                    throw new Error('Sem permissao para atualizar esta sessao');
                }
            } else if (existingCreatedBy && requestedCreatedBy && existingCreatedBy !== requestedCreatedBy) {
                throw new Error('Sem permissao para atualizar esta sessao');
            }
            const resolvedCreatedBy = requestedOwnerUserId || requestedCreatedBy || existingCreatedBy || null;
            if (!existing && resolvedCreatedBy) {
                await assertOwnerCanCreateWhatsAppSession(resolvedCreatedBy, 1);
            }
            const resolvedName = Object.prototype.hasOwnProperty.call(data, 'name')
                ? (data.name ? String(data.name).trim().slice(0, 120) : null)
                : (existing?.name || null);
            const campaignEnabled = Object.prototype.hasOwnProperty.call(data, 'campaign_enabled')
                ? normalizeBooleanFlag(data.campaign_enabled, existing?.campaign_enabled ?? 1)
                : (existing?.campaign_enabled ?? 1);
            const dailyLimit = Object.prototype.hasOwnProperty.call(data, 'daily_limit')
                ? parseNonNegativeInteger(data.daily_limit, existing?.daily_limit ?? 0)
                : (existing?.daily_limit ?? 0);
            const dispatchWeight = Object.prototype.hasOwnProperty.call(data, 'dispatch_weight')
                ? Math.max(1, parseNonNegativeInteger(data.dispatch_weight, existing?.dispatch_weight ?? 1) || 1)
                : Math.max(1, parseNonNegativeInteger(existing?.dispatch_weight, 1) || 1);
            const hourlyLimit = Object.prototype.hasOwnProperty.call(data, 'hourly_limit')
                ? parseNonNegativeInteger(data.hourly_limit, existing?.hourly_limit ?? 0)
                : (existing?.hourly_limit ?? 0);
            const cooldownUntil = Object.prototype.hasOwnProperty.call(data, 'cooldown_until')
                ? (data.cooldown_until ? String(data.cooldown_until) : null)
                : (existing?.cooldown_until || null);

            await run(`
                INSERT INTO whatsapp_sessions (
                    session_id, name, status, campaign_enabled, daily_limit, dispatch_weight, hourly_limit, cooldown_until, created_by, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (session_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    campaign_enabled = EXCLUDED.campaign_enabled,
                    daily_limit = EXCLUDED.daily_limit,
                    dispatch_weight = EXCLUDED.dispatch_weight,
                    hourly_limit = EXCLUDED.hourly_limit,
                    cooldown_until = EXCLUDED.cooldown_until,
                    created_by = COALESCE(EXCLUDED.created_by, whatsapp_sessions.created_by),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                normalizedSessionId,
                resolvedName,
                existing?.status || 'disconnected',
                campaignEnabled,
                dailyLimit,
                dispatchWeight,
                hourlyLimit,
                cooldownUntil,
                resolvedCreatedBy
            ]);

            return this.findBySessionId(normalizedSessionId);
        },

        async deleteBySessionId(sessionId, options = {}) {
            const normalizedSessionId = String(sessionId || '').trim();
            if (!normalizedSessionId) {
                throw new Error('session_id e obrigatorio');
            }

            const requesterOwnerUserId = parsePositiveInteger(options.owner_user_id);
            const requesterCreatedBy = parsePositiveInteger(options.created_by);
            const existing = await this.findBySessionId(normalizedSessionId);

            if (requesterOwnerUserId && existing) {
                const ownedSession = await this.findBySessionId(normalizedSessionId, {
                    owner_user_id: requesterOwnerUserId
                });
                if (!ownedSession) {
                    throw new Error('Sem permissao para remover esta sessao');
                }
            } else if (requesterCreatedBy && existing) {
                const ownedSession = await this.findBySessionId(normalizedSessionId, {
                    created_by: requesterCreatedBy
                });
                if (!ownedSession) {
                    throw new Error('Sem permissao para remover esta sessao');
                }
            }

            const campaignCleanup = await run('DELETE FROM campaign_sender_accounts WHERE session_id = ?', [normalizedSessionId]);
            const flowCleanup = await run(`
                UPDATE flows
                SET session_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
            `, [normalizedSessionId]);

            let automationCleanupCount = 0;
            const automationRows = await query(`
                SELECT id, session_scope
                FROM automations
                WHERE session_scope IS NOT NULL
                  AND TRIM(session_scope) <> ''
                  AND session_scope LIKE ?
            `, [`%${normalizedSessionId}%`]);
            for (const automation of automationRows) {
                const sessionScope = normalizeSessionScopeList(automation?.session_scope);
                if (!sessionScope.includes(normalizedSessionId)) continue;

                const nextSessionScope = sessionScope.filter((item) => item !== normalizedSessionId);
                const result = await updateAutomation(automation.id, {
                    session_scope: nextSessionScope.length ? JSON.stringify(nextSessionScope) : null
                });
                automationCleanupCount += Number(result?.changes || 0) || 0;
            }

            let businessHoursCleanupCount = 0;
            const businessHoursSettingRows = await query(`
                SELECT key
                FROM settings
                WHERE key = ?
                   OR key LIKE ?
            `, ['business_hours_by_session', 'user:%:business_hours_by_session']);
            for (const settingRow of businessHoursSettingRows) {
                const settingsKey = String(settingRow?.key || '').trim();
                if (!settingsKey) continue;

                const currentValue = parsePlainObject(await settingsGet(settingsKey));
                if (!Object.prototype.hasOwnProperty.call(currentValue, normalizedSessionId)) {
                    continue;
                }

                delete currentValue[normalizedSessionId];
                if (Object.keys(currentValue).length > 0) {
                    await settingsSet(settingsKey, currentValue, 'json');
                } else {
                    await run('DELETE FROM settings WHERE key = ?', [settingsKey]);
                }
                businessHoursCleanupCount += 1;
            }

            const sessionCleanup = await run('DELETE FROM whatsapp_sessions WHERE session_id = ?', [normalizedSessionId]);
            return {
                session_id: normalizedSessionId,
                removed: Number(sessionCleanup?.changes || 0) > 0,
                cleanup: {
                    campaign_sender_accounts: Number(campaignCleanup?.changes || 0) || 0,
                    flows: Number(flowCleanup?.changes || 0) || 0,
                    automations: automationCleanupCount,
                    business_hours_settings: businessHoursCleanupCount
                }
            };
        }
    };
}

module.exports = {
    createWhatsAppSessionModel
};
