const express = require('express');

function createDashboardReadRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const getScopedUserId = options.getScopedUserId;
    const senderAllocatorService = options.senderAllocatorService;
    const query = options.query;
    const CustomEvent = options.CustomEvent;

    const DASHBOARD_PERIOD_METRICS = new Set(['novos_contatos', 'mensagens', 'interacoes']);
    const CUSTOM_EVENT_PERIODS = new Map([
        ['this_month', { label: 'Este mes' }],
        ['week', { label: 'Semana' }],
        ['year', { label: 'Ano' }],
        ['last_30_days', { label: 'Ultimos 30 dias' }]
    ]);
    const CUSTOM_EVENT_PERIOD_ALIASES = new Map([
        ['mes', 'this_month'],
        ['month', 'this_month'],
        ['this_month', 'this_month'],
        ['semana', 'week'],
        ['week', 'week'],
        ['ano', 'year'],
        ['year', 'year'],
        ['ultimos_30_dias', 'last_30_days'],
        ['last_30_days', 'last_30_days'],
        ['30d', 'last_30_days']
    ]);
    
    function normalizePeriodDateInput(value) {
        const normalized = String(value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
        const parsed = new Date(`${normalized}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) return null;
        return {
            raw: normalized,
            date: parsed
        };
    }
    
    function formatUtcDateKey(date) {
        return date.toISOString().slice(0, 10);
    }
    
    function formatDateLabelShort(dateKey) {
        const [, month, day] = String(dateKey).split('-');
        if (!month || !day) return dateKey;
        return `${day}/${month}`;
    }
    
    function normalizeCustomEventPeriod(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return 'this_month';
        return CUSTOM_EVENT_PERIOD_ALIASES.get(normalized) || 'this_month';
    }
    
    function getUtcDayStart(date = new Date()) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }
    
    function resolveCustomEventPeriodRange(periodInput) {
        const period = normalizeCustomEventPeriod(periodInput);
        const periodMeta = CUSTOM_EVENT_PERIODS.get(period) || CUSTOM_EVENT_PERIODS.get('this_month');
        const todayStart = getUtcDayStart(new Date());
        const endExclusive = new Date(todayStart);
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    
        const start = new Date(todayStart);
        if (period === 'week') {
            start.setUTCDate(start.getUTCDate() - 6);
        } else if (period === 'year') {
            start.setUTCMonth(0, 1);
        } else if (period === 'last_30_days') {
            start.setUTCDate(start.getUTCDate() - 29);
        } else {
            start.setUTCDate(1);
        }
    
        const endInclusive = new Date(endExclusive);
        endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
    
        return {
            period,
            label: periodMeta?.label || 'Este mes',
            startDate: start.toISOString().slice(0, 10),
            endDate: endInclusive.toISOString().slice(0, 10),
            startAt: start.toISOString(),
            endAt: endExclusive.toISOString()
        };
    }
    
    function normalizeDashboardHealthText(value) {
        return String(value || '').trim();
    }
    
    function parseDashboardHealthIsoMs(value) {
        const parsed = Date.parse(String(value || ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    
    function mapDashboardSessionStatusLabel(status) {
        const normalized = normalizeDashboardHealthText(status).toLowerCase();
        if (normalized === 'connected') return 'Conectada';
        if (normalized === 'warming_up') return 'Aquecendo';
        if (normalized === 'reconnecting') return 'Reconectando';
        if (normalized === 'disconnected') return 'Desconectada';
        return normalized ? normalized : 'Indisponível';
    }
    
    function buildDashboardAccountRisk(account) {
        const nowMs = Date.now();
        const campaignEnabled = account?.campaign_enabled !== false;
        const status = normalizeDashboardHealthText(account?.status).toLowerCase();
        const cooldownMs = parseDashboardHealthIsoMs(account?.cooldown_until);
        const cooldownActive = cooldownMs > nowMs;
        const sentToday = Number(account?.sent_today || 0);
        const uniqueLeadsToday = Number(account?.unique_leads_today || 0);
        const responseRate = Number(account?.response_rate || 0);
        const sentLastHour = Number(account?.sent_last_hour || 0);
        const dailyLimit = Number(account?.daily_limit || 0);
        const hourlyLimit = Number(account?.hourly_limit || 0);
        const possibleBlockedContacts = Number(account?.possible_blocked_contacts || 0);
        const dailyUsageRatio = dailyLimit > 0 ? sentToday / dailyLimit : null;
        const hourlyUsageRatio = hourlyLimit > 0 ? sentLastHour / hourlyLimit : null;
    
        if (!campaignEnabled) {
            return {
                level: 'paused',
                label: 'Pausada',
                reason: 'Conta fora da rotina de disparos.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 0
            };
        }
    
        if (cooldownActive) {
            return {
                level: 'critical',
                label: 'Em cooldown',
                reason: 'A conta entrou em resfriamento automático.',
                cooldown_active: true,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 4
            };
        }
    
        const reachedDailyLimit = dailyUsageRatio !== null && dailyUsageRatio >= 1;
        const reachedHourlyLimit = hourlyUsageRatio !== null && hourlyUsageRatio >= 1;
        const nearDailyLimit = dailyUsageRatio !== null && dailyUsageRatio >= 0.85;
        const nearHourlyLimit = hourlyUsageRatio !== null && hourlyUsageRatio >= 0.85;
        const warmDailyLimit = dailyUsageRatio !== null && dailyUsageRatio >= 0.65;
        const warmHourlyLimit = hourlyUsageRatio !== null && hourlyUsageRatio >= 0.65;
        const veryLowResponse = uniqueLeadsToday >= 20 && responseRate < 5;
        const lowResponse = uniqueLeadsToday >= 10 && responseRate < 10;
    
        if (reachedDailyLimit || reachedHourlyLimit) {
            return {
                level: 'critical',
                label: 'Limite atingido',
                reason: 'O volume de envio bateu o limite configurado.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 4
            };
        }
    
        if (nearDailyLimit || nearHourlyLimit) {
            return {
                level: 'critical',
                label: 'Ritmo alto',
                reason: 'Conta muito próxima do limite configurado.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 3
            };
        }
    
        if (veryLowResponse) {
            return {
                level: 'critical',
                label: 'Baixa resposta',
                reason: 'Volume alto com retorno muito baixo.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 3
            };
        }
    
        if (status === 'disconnected' || status === 'reconnecting') {
            return {
                level: 'attention',
                label: 'Sessão instável',
                reason: 'A conta não está pronta para disparar agora.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 2
            };
        }
    
        if (warmDailyLimit || warmHourlyLimit) {
            return {
                level: 'attention',
                label: 'Pede atenção',
                reason: 'O ritmo de envio começou a acelerar.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 2
            };
        }
    
        if (lowResponse) {
            return {
                level: 'attention',
                label: 'Engajamento baixo',
                reason: 'Poucas respostas para o volume enviado.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 2
            };
        }
    
        if (possibleBlockedContacts >= 3) {
            return {
                level: 'attention',
                label: 'Entregas em alerta',
                reason: `${possibleBlockedContacts} contato(s) com suspeita de bloqueio ou entrega travada.`,
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 2
            };
        }
    
        if (sentToday <= 0) {
            return {
                level: 'healthy',
                label: 'Sem pressão',
                reason: 'Nenhum disparo enviado hoje nesta conta.',
                cooldown_active: false,
                daily_usage_ratio: dailyUsageRatio,
                hourly_usage_ratio: hourlyUsageRatio,
                sort_weight: 1
            };
        }
    
        return {
            level: 'healthy',
            label: 'Saudavel',
            reason: 'Ritmo e resposta dentro do esperado.',
            cooldown_active: false,
            daily_usage_ratio: dailyUsageRatio,
            hourly_usage_ratio: hourlyUsageRatio,
            sort_weight: 1
        };
    }
    
    router.get('/api/dashboard/stats-period', authenticate, async (req, res) => {
        try {
            const metric = String(req.query.metric || 'novos_contatos')
                .trim()
                .toLowerCase();
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    
            if (!DASHBOARD_PERIOD_METRICS.has(metric)) {
                return res.status(400).json({ success: false, error: 'MÃ©trica invÃ¡lida' });
            }
    
            const startInput = normalizePeriodDateInput(req.query.startDate);
            const endInput = normalizePeriodDateInput(req.query.endDate);
    
            if (!startInput || !endInput) {
                return res.status(400).json({ success: false, error: 'PerÃ­odo invÃ¡lido' });
            }
    
            if (startInput.date > endInput.date) {
                return res.status(400).json({ success: false, error: 'Data inicial maior que data final' });
            }
    
            const maxDaysRange = 370;
            const periodDays = Math.floor((endInput.date.getTime() - startInput.date.getTime()) / 86400000) + 1;
            if (periodDays > maxDaysRange) {
                return res.status(400).json({ success: false, error: `PerÃ­odo mÃ¡ximo Ã© de ${maxDaysRange} dias` });
            }
    
            const endExclusiveDate = new Date(endInput.date);
            endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);
    
            const startAt = `${startInput.raw}T00:00:00.000Z`;
            const endExclusiveAt = endExclusiveDate.toISOString();
    
            let rows = [];
            if (metric === 'novos_contatos') {
                const params = [startAt, endExclusiveAt];
                const ownerFilter = ownerScopeUserId
                    ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                    : '';
                if (ownerScopeUserId) {
                    params.push(ownerScopeUserId, ownerScopeUserId);
                }
                const assignedFilter = scopedUserId ? ' AND assigned_to = ?' : '';
                if (scopedUserId) {
                    params.push(scopedUserId);
                }
                rows = await query(
                    `
                    SELECT
                        TO_CHAR((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                        COUNT(*)::int AS total
                    FROM leads
                    WHERE created_at >= ? AND created_at < ?${ownerFilter}${assignedFilter}
                    GROUP BY (created_at AT TIME ZONE 'UTC')::date
                    ORDER BY (created_at AT TIME ZONE 'UTC')::date ASC
                    `,
                    params
                );
            } else if (metric === 'mensagens') {
                const params = [startAt, endExclusiveAt];
                const ownerFilter = ownerScopeUserId
                    ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                    : '';
                if (ownerScopeUserId) {
                    params.push(ownerScopeUserId, ownerScopeUserId);
                }
                const assignedFilter = scopedUserId ? ' AND l.assigned_to = ?' : '';
                if (scopedUserId) {
                    params.push(scopedUserId);
                }
                rows = await query(
                    `
                    SELECT
                        TO_CHAR((COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                        COUNT(*)::int AS total
                    FROM messages m
                    LEFT JOIN leads l ON l.id = m.lead_id
                    WHERE COALESCE(m.sent_at, m.created_at) >= ? AND COALESCE(m.sent_at, m.created_at) < ?${ownerFilter}${assignedFilter}
                    GROUP BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date
                    ORDER BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date ASC
                    `,
                    params
                );
            } else {
                const params = [startAt, endExclusiveAt];
                const ownerFilter = ownerScopeUserId
                    ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                    : '';
                if (ownerScopeUserId) {
                    params.push(ownerScopeUserId, ownerScopeUserId);
                }
                const assignedFilter = scopedUserId ? ' AND l.assigned_to = ?' : '';
                if (scopedUserId) {
                    params.push(scopedUserId);
                }
                rows = await query(
                    `
                    SELECT
                        TO_CHAR((COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                        COUNT(DISTINCT m.lead_id)::int AS total
                    FROM messages m
                    LEFT JOIN leads l ON l.id = m.lead_id
                    WHERE COALESCE(m.sent_at, m.created_at) >= ? AND COALESCE(m.sent_at, m.created_at) < ?
                      AND m.is_from_me = 0${ownerFilter}${assignedFilter}
                    GROUP BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date
                    ORDER BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date ASC
                    `,
                    params
                );
            }
    
            const totalsByDay = new Map(
                rows.map((row) => [String(row.day), Number(row.total) || 0])
            );
    
            const labels = [];
            const data = [];
            const points = [];
            const cursor = new Date(startInput.date);
    
            while (cursor <= endInput.date) {
                const dateKey = formatUtcDateKey(cursor);
                const value = totalsByDay.get(dateKey) || 0;
                const label = formatDateLabelShort(dateKey);
                labels.push(label);
                data.push(value);
                points.push({
                    date: dateKey,
                    label,
                    value
                });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
    
            res.json({
                success: true,
                metric,
                startDate: startInput.raw,
                endDate: endInput.raw,
                labels,
                data,
                points,
                total: data.reduce((sum, item) => sum + item, 0)
            });
        } catch (error) {
            console.error('Falha ao carregar estatÃ­sticas por perÃ­odo:', error);
            res.status(500).json({ success: false, error: 'Erro ao carregar estatÃ­sticas por perÃ­odo' });
        }
    });
    
    router.get('/api/dashboard/account-health', authenticate, async (req, res) => {
        try {
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const sessionsList = await senderAllocatorService.listDispatchSessions({
                includeDisabled: true,
                ownerUserId: ownerScopeUserId || undefined
            });
            const sessionIds = Array.from(new Set(
                (sessionsList || [])
                    .map((session) => normalizeDashboardHealthText(session?.session_id))
                    .filter(Boolean)
            ));
            const { startIso, endIso } = senderAllocatorService.getTodayWindow();
            const generatedAt = new Date().toISOString();
    
            if (!sessionIds.length) {
                return res.json({
                    success: true,
                    date: startIso.slice(0, 10),
                    generatedAt,
                    summary: {
                        total_accounts: 0,
                        critical: 0,
                        attention: 0,
                        healthy: 0,
                        paused: 0,
                        cooldown: 0
                    },
                    accounts: []
                });
            }
    
            const sessionPlaceholders = sessionIds.map(() => '?').join(', ');
            const lastHourIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const blockedSignalWindowStartIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const blockedSignalStableBeforeIso = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
            let leadScopeSql = '';
            const leadScopeParams = [];
    
            if (ownerScopeUserId) {
                leadScopeSql += `
                  AND (
                        l.owner_user_id = ?
                        OR (
                            l.owner_user_id IS NULL
                            AND EXISTS (
                                SELECT 1
                                FROM users owner_scope
                                WHERE owner_scope.id = l.assigned_to
                                  AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                            )
                        )
                    )
                `;
                leadScopeParams.push(ownerScopeUserId, ownerScopeUserId, ownerScopeUserId);
            }
    
            if (scopedUserId) {
                leadScopeSql += ' AND l.assigned_to = ?';
                leadScopeParams.push(scopedUserId);
            }
    
            const sessionSummaryRows = await query(`
                WITH sent_base AS (
                    SELECT
                        q.session_id,
                        q.lead_id,
                        COUNT(*)::int AS sent_messages,
                        MIN(COALESCE(q.processed_at, q.updated_at, q.created_at)) AS first_sent_at,
                        MAX(COALESCE(q.processed_at, q.updated_at, q.created_at)) AS last_sent_at,
                        SUM(
                            CASE
                                WHEN COALESCE(q.processed_at, q.updated_at, q.created_at) >= ? THEN 1
                                ELSE 0
                            END
                        )::int AS sent_last_hour
                    FROM message_queue q
                    INNER JOIN leads l ON l.id = q.lead_id
                    WHERE q.status = 'sent'
                      AND q.session_id IN (${sessionPlaceholders})
                      AND COALESCE(q.processed_at, q.updated_at, q.created_at) >= ?
                      AND COALESCE(q.processed_at, q.updated_at, q.created_at) < ?
                      ${leadScopeSql}
                    GROUP BY q.session_id, q.lead_id
                ),
                responded AS (
                    SELECT
                        sb.session_id,
                        sb.lead_id
                    FROM sent_base sb
                    WHERE EXISTS (
                        SELECT 1
                        FROM conversations c
                        INNER JOIN messages m ON m.conversation_id = c.id
                        WHERE c.lead_id = sb.lead_id
                          AND c.session_id = sb.session_id
                          AND m.is_from_me = 0
                          AND COALESCE(m.sent_at, m.created_at) >= sb.first_sent_at
                          AND COALESCE(m.sent_at, m.created_at) < ?
                    )
                )
                SELECT
                    sb.session_id,
                    SUM(sb.sent_messages)::int AS sent_today,
                    COUNT(*)::int AS unique_leads_today,
                    COALESCE(COUNT(r.lead_id), 0)::int AS replied_today,
                    SUM(sb.sent_last_hour)::int AS sent_last_hour,
                    MIN(sb.first_sent_at) AS first_sent_at,
                    MAX(sb.last_sent_at) AS last_sent_at
                FROM sent_base sb
                LEFT JOIN responded r
                  ON r.session_id = sb.session_id
                 AND r.lead_id = sb.lead_id
                GROUP BY sb.session_id
            `, [
                lastHourIso,
                ...sessionIds,
                startIso,
                endIso,
                ...leadScopeParams,
                endIso
            ]);
    
            const dispatchRows = await query(`
                WITH sent_base AS (
                    SELECT
                        q.session_id,
                        q.campaign_id,
                        q.lead_id,
                        COUNT(*)::int AS sent_messages,
                        MIN(COALESCE(q.processed_at, q.updated_at, q.created_at)) AS first_sent_at,
                        MAX(COALESCE(q.processed_at, q.updated_at, q.created_at)) AS last_sent_at
                    FROM message_queue q
                    INNER JOIN leads l ON l.id = q.lead_id
                    WHERE q.status = 'sent'
                      AND q.session_id IN (${sessionPlaceholders})
                      AND COALESCE(q.processed_at, q.updated_at, q.created_at) >= ?
                      AND COALESCE(q.processed_at, q.updated_at, q.created_at) < ?
                      ${leadScopeSql}
                    GROUP BY q.session_id, q.campaign_id, q.lead_id
                ),
                responded AS (
                    SELECT
                        sb.session_id,
                        sb.campaign_id,
                        sb.lead_id
                    FROM sent_base sb
                    WHERE EXISTS (
                        SELECT 1
                        FROM conversations c
                        INNER JOIN messages m ON m.conversation_id = c.id
                        WHERE c.lead_id = sb.lead_id
                          AND c.session_id = sb.session_id
                          AND m.is_from_me = 0
                          AND COALESCE(m.sent_at, m.created_at) >= sb.first_sent_at
                          AND COALESCE(m.sent_at, m.created_at) < ?
                    )
                )
                SELECT
                    sb.session_id,
                    sb.campaign_id,
                    camp.name AS campaign_name,
                    SUM(sb.sent_messages)::int AS sent_today,
                    COUNT(*)::int AS unique_leads_today,
                    COALESCE(COUNT(r.lead_id), 0)::int AS replied_today,
                    MIN(sb.first_sent_at) AS first_sent_at,
                    MAX(sb.last_sent_at) AS last_sent_at
                FROM sent_base sb
                LEFT JOIN responded r
                  ON r.session_id = sb.session_id
                 AND (
                        (r.campaign_id IS NULL AND sb.campaign_id IS NULL)
                        OR r.campaign_id = sb.campaign_id
                     )
                 AND r.lead_id = sb.lead_id
                LEFT JOIN campaigns camp ON camp.id = sb.campaign_id
                GROUP BY sb.session_id, sb.campaign_id, camp.name
                ORDER BY sb.session_id ASC, SUM(sb.sent_messages) DESC, MAX(sb.last_sent_at) DESC
            `, [
                ...sessionIds,
                startIso,
                endIso,
                ...leadScopeParams,
                endIso
            ]);
    
            const blockedSignalRows = await query(`
                WITH outbound_recent AS (
                    SELECT
                        c.session_id,
                        m.lead_id,
                        COUNT(*)::int AS outbound_recent,
                        SUM(CASE WHEN m.status IN ('delivered', 'read') THEN 1 ELSE 0 END)::int AS delivered_recent,
                        MAX(COALESCE(m.sent_at, m.created_at)) AS last_outbound_at
                    FROM messages m
                    INNER JOIN conversations c ON c.id = m.conversation_id
                    INNER JOIN leads l ON l.id = m.lead_id
                    WHERE m.is_from_me = 1
                      AND c.session_id IN (${sessionPlaceholders})
                      AND COALESCE(m.sent_at, m.created_at) >= ?
                      AND COALESCE(m.sent_at, m.created_at) < ?
                      ${leadScopeSql}
                    GROUP BY c.session_id, m.lead_id
                ),
                latest_outbound AS (
                    SELECT DISTINCT ON (c.session_id, m.lead_id)
                        c.session_id,
                        m.lead_id,
                        m.status AS last_status,
                        COALESCE(m.sent_at, m.created_at) AS last_outbound_at
                    FROM messages m
                    INNER JOIN conversations c ON c.id = m.conversation_id
                    INNER JOIN leads l ON l.id = m.lead_id
                    WHERE m.is_from_me = 1
                      AND c.session_id IN (${sessionPlaceholders})
                      AND COALESCE(m.sent_at, m.created_at) >= ?
                      AND COALESCE(m.sent_at, m.created_at) < ?
                      ${leadScopeSql}
                    ORDER BY c.session_id, m.lead_id, COALESCE(m.sent_at, m.created_at) DESC, m.id DESC
                ),
                incoming_recent AS (
                    SELECT
                        c.session_id,
                        m.lead_id,
                        MAX(COALESCE(m.sent_at, m.created_at)) AS last_incoming_at
                    FROM messages m
                    INNER JOIN conversations c ON c.id = m.conversation_id
                    INNER JOIN leads l ON l.id = m.lead_id
                    WHERE m.is_from_me = 0
                      AND c.session_id IN (${sessionPlaceholders})
                      AND COALESCE(m.sent_at, m.created_at) >= ?
                      AND COALESCE(m.sent_at, m.created_at) < ?
                      ${leadScopeSql}
                    GROUP BY c.session_id, m.lead_id
                )
                SELECT
                    ob.session_id,
                    COUNT(*) FILTER (
                        WHERE ob.outbound_recent >= 2
                          AND COALESCE(ob.delivered_recent, 0) = 0
                          AND COALESCE(lo.last_status, 'pending') IN ('pending', 'sent')
                          AND COALESCE(lo.last_outbound_at, ob.last_outbound_at) < ?
                          AND ir.last_incoming_at IS NULL
                    )::int AS possible_blocked_contacts
                FROM outbound_recent ob
                LEFT JOIN latest_outbound lo
                  ON lo.session_id = ob.session_id
                 AND lo.lead_id = ob.lead_id
                LEFT JOIN incoming_recent ir
                  ON ir.session_id = ob.session_id
                 AND ir.lead_id = ob.lead_id
                GROUP BY ob.session_id
            `, [
                ...sessionIds,
                blockedSignalWindowStartIso,
                endIso,
                ...leadScopeParams,
                ...sessionIds,
                blockedSignalWindowStartIso,
                endIso,
                ...leadScopeParams,
                ...sessionIds,
                blockedSignalWindowStartIso,
                endIso,
                ...leadScopeParams,
                blockedSignalStableBeforeIso
            ]);
    
            const summaryBySessionId = new Map(
                (sessionSummaryRows || []).map((row) => [normalizeDashboardHealthText(row?.session_id), row])
            );
            const blockedSignalBySessionId = new Map(
                (blockedSignalRows || []).map((row) => [
                    normalizeDashboardHealthText(row?.session_id),
                    Number(row?.possible_blocked_contacts || 0)
                ])
            );
            const dispatchesBySessionId = new Map();
    
            for (const row of dispatchRows || []) {
                const sessionId = normalizeDashboardHealthText(row?.session_id);
                if (!sessionId) continue;
                const sentToday = Number(row?.sent_today || 0);
                const uniqueLeadsToday = Number(row?.unique_leads_today || 0);
                const repliedToday = Number(row?.replied_today || 0);
                const responseRate = uniqueLeadsToday > 0
                    ? Number(((repliedToday / uniqueLeadsToday) * 100).toFixed(1))
                    : 0;
                const currentDispatches = dispatchesBySessionId.get(sessionId) || [];
                currentDispatches.push({
                    campaign_id: row?.campaign_id === null || row?.campaign_id === undefined
                        ? null
                        : Number(row.campaign_id),
                    campaign_name: normalizeDashboardHealthText(row?.campaign_name) || 'Envios avulsos',
                    sent_today: sentToday,
                    unique_leads_today: uniqueLeadsToday,
                    replied_today: repliedToday,
                    response_rate: responseRate,
                    first_sent_at: row?.first_sent_at || null,
                    last_sent_at: row?.last_sent_at || null
                });
                dispatchesBySessionId.set(sessionId, currentDispatches);
            }
    
            const accounts = (sessionsList || []).map((session) => {
                const sessionId = normalizeDashboardHealthText(session?.session_id);
                const metrics = summaryBySessionId.get(sessionId) || null;
                const possibleBlockedContacts = Number(blockedSignalBySessionId.get(sessionId) || 0);
                const sentToday = Number(metrics?.sent_today || 0);
                const uniqueLeadsToday = Number(metrics?.unique_leads_today || 0);
                const repliedToday = Number(metrics?.replied_today || 0);
                const sentLastHour = Number(metrics?.sent_last_hour || 0);
                const responseRate = uniqueLeadsToday > 0
                    ? Number(((repliedToday / uniqueLeadsToday) * 100).toFixed(1))
                    : 0;
                const risk = buildDashboardAccountRisk({
                    ...session,
                    sent_today: sentToday,
                    unique_leads_today: uniqueLeadsToday,
                    response_rate: responseRate,
                    sent_last_hour: sentLastHour,
                    possible_blocked_contacts: possibleBlockedContacts
                });
    
                return {
                    session_id: sessionId,
                    session_name: normalizeDashboardHealthText(session?.name) || sessionId,
                    phone: session?.phone || null,
                    status: normalizeDashboardHealthText(session?.status) || 'disconnected',
                    status_label: mapDashboardSessionStatusLabel(session?.status),
                    campaign_enabled: session?.campaign_enabled !== false,
                    daily_limit: Number(session?.daily_limit || 0),
                    hourly_limit: Number(session?.hourly_limit || 0),
                    cooldown_until: session?.cooldown_until || null,
                    cooldown_active: risk.cooldown_active,
                    sent_today: sentToday,
                    unique_leads_today: uniqueLeadsToday,
                    replied_today: repliedToday,
                    response_rate: responseRate,
                    sent_last_hour: sentLastHour,
                    first_sent_at: metrics?.first_sent_at || null,
                    last_sent_at: metrics?.last_sent_at || null,
                    risk_level: risk.level,
                    risk_label: risk.label,
                    risk_reason: risk.reason,
                    daily_usage_ratio: risk.daily_usage_ratio,
                    hourly_usage_ratio: risk.hourly_usage_ratio,
                    possible_blocked_contacts: possibleBlockedContacts,
                    dispatches: dispatchesBySessionId.get(sessionId) || [],
                    risk_sort_weight: risk.sort_weight
                };
            }).sort((left, right) => {
                const byRisk = Number(right?.risk_sort_weight || 0) - Number(left?.risk_sort_weight || 0);
                if (byRisk !== 0) return byRisk;
                const bySent = Number(right?.sent_today || 0) - Number(left?.sent_today || 0);
                if (bySent !== 0) return bySent;
                return String(left?.session_name || '').localeCompare(String(right?.session_name || ''), 'pt-BR');
            });
    
            const summary = accounts.reduce((acc, account) => {
                acc.total_accounts += 1;
                if (account.risk_level === 'critical') acc.critical += 1;
                else if (account.risk_level === 'attention') acc.attention += 1;
                else if (account.risk_level === 'paused') acc.paused += 1;
                else acc.healthy += 1;
                if (account.cooldown_active) acc.cooldown += 1;
                return acc;
            }, {
                total_accounts: 0,
                critical: 0,
                attention: 0,
                healthy: 0,
                paused: 0,
                cooldown: 0
            });
    
            res.json({
                success: true,
                date: startIso.slice(0, 10),
                generatedAt,
                summary,
                accounts
            });
        } catch (error) {
            console.error('Falha ao carregar saude das contas do dashboard:', error);
            res.status(500).json({ success: false, error: 'Erro ao carregar saude das contas do dashboard' });
        }
    });
    
    
    

    function parseBooleanInput(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
            if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
        }
        return fallback;
    }

    router.get('/api/custom-events/stats', authenticate, async (req, res) => {
        try {
            const periodRange = resolveCustomEventPeriodRange(req.query.period);
            const onlyActive = parseBooleanInput(
                req.query.active_only ?? req.query.activeOnly ?? req.query.active,
                false
            );
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    
            const events = await CustomEvent.listWithPeriodTotals(periodRange.startAt, periodRange.endAt, {
                is_active: onlyActive ? 1 : undefined,
                owner_user_id: ownerScopeUserId || undefined
            });
    
            const totals = events.reduce((acc, event) => {
                const triggers = Number(event.total_period) || 0;
                acc.triggers += triggers;
                if (Number(event.is_active) > 0) acc.activeEvents += 1;
                return acc;
            }, { triggers: 0, activeEvents: 0 });
    
            res.json({
                success: true,
                period: periodRange.period,
                label: periodRange.label,
                startDate: periodRange.startDate,
                endDate: periodRange.endDate,
                startAt: periodRange.startAt,
                endAt: periodRange.endAt,
                totals: {
                    events: events.length,
                    activeEvents: totals.activeEvents,
                    triggers: totals.triggers
                },
                events
            });
        } catch (error) {
            console.error('Falha ao carregar estatisticas de eventos personalizados:', error);
            res.status(500).json({ success: false, error: 'Erro ao carregar eventos personalizados' });
        }
    });
    

    return router;
}

module.exports = {
    createDashboardReadRoutes
};
