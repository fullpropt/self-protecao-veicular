const express = require('express');

function createWhatsAppSessionRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const requireActiveWhatsAppPlan = options.requireActiveWhatsAppPlan;
    const resolveSessionIdOrDefault = options.resolveSessionIdOrDefault;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const WhatsAppSession = options.WhatsAppSession;
    const normalizeOwnerUserId = options.normalizeOwnerUserId;
    const sessions = options.sessions;
    const sessionStartupErrors = options.sessionStartupErrors;
    const sessionInitLockTimestamps = options.sessionInitLockTimestamps;
    const sessionInitLocks = options.sessionInitLocks;
    const getSessionDispatchState = options.getSessionDispatchState;
    const senderAllocatorService = options.senderAllocatorService;
    const sanitizeSessionId = options.sanitizeSessionId;
    const resolveRuntimeSessionStore = options.resolveRuntimeSessionStore;
    const parsePositiveIntInRange = options.parsePositiveIntInRange;
    const runSessionReconnectCatchup = options.runSessionReconnectCatchup;
    const planLimitsService = options.planLimitsService;
    const removeSessionCompletely = options.removeSessionCompletely;
    const disconnectSessionPreservingRecord = options.disconnectSessionPreservingRecord;
    const resolveSessionOwnerUserId = options.resolveSessionOwnerUserId;
    const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS = options.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS;
    const WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS = options.WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS;
    const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION = options.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION;
    const WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION = options.WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION;
    const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS = options.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS;
    const WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS = options.WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS;
    const WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT = options.WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT;
    const WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT = options.WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT;
    const WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS = options.WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS;

    router.get('/api/whatsapp/status', authenticate, async (req, res) => {
        const sessionId = resolveSessionIdOrDefault(req.query?.sessionId);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        if (ownerScopeUserId) {
            const storedSession = await WhatsAppSession.findBySessionId(sessionId);
            if (storedSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    return res.status(404).json({ error: 'Conta nao encontrada' });
                }
            } else {
                const runtimeOwnerUserId = normalizeOwnerUserId(sessions.get(sessionId)?.ownerUserId);
                if (!runtimeOwnerUserId || runtimeOwnerUserId !== ownerScopeUserId) {
                    return res.status(404).json({ error: 'Conta nao encontrada' });
                }
            }
        }

        const session = sessions.get(sessionId);
        const lastStartupError = sessionStartupErrors.get(sessionId) || null;
        const initLockStartedAt = Number(sessionInitLockTimestamps.get(sessionId) || 0);
        const initLockAgeMs = sessionInitLocks.has(sessionId) && initLockStartedAt > 0
            ? Math.max(0, Date.now() - initLockStartedAt)
            : null;

        const connected = !!(session && session.isConnected);
        const dispatchState = getSessionDispatchState(sessionId);

        let phone = null;

        if (session && session.user && session.user.id) {
            const jid = String(session.user.id);
            phone = '+' + jid.replace(/@s\.whatsapp\.net|@c\.us/g, '').trim();
        }

        return res.json({
            connected,
            phone,
            status: dispatchState.status || (connected ? 'connected' : 'disconnected'),
            reconnecting: Boolean(session?.reconnecting),
            sendReadyAt: Number(session?.sendReadyAtMs || 0) > 0 ? new Date(Number(session.sendReadyAtMs)).toISOString() : null,
            dispatchBlockedUntil: Number(session?.dispatchBlockedUntilMs || 0) > Date.now()
                ? new Date(Number(session.dispatchBlockedUntilMs)).toISOString()
                : null,
            lastDisconnectReason: session?.lastDisconnectReason || null,
            lastStartupError,
            initLock: {
                active: sessionInitLocks.has(sessionId),
                ageMs: initLockAgeMs
            }
        });
    });

    router.get('/api/whatsapp/sessions', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
        try {
            const includeDisabled = String(req.query?.includeDisabled ?? 'true').toLowerCase() !== 'false';
            const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
            const sessionsList = await senderAllocatorService.listDispatchSessions({
                includeDisabled,
                ownerUserId: ownerScopeUserId || undefined
            });
            return res.json({ success: true, sessions: sessionsList });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.post('/api/whatsapp/sessions/:sessionId/history/resync', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
        try {
            const sessionId = sanitizeSessionId(req.params.sessionId);
            if (!sessionId) {
                return res.status(400).json({ success: false, error: 'sessionId invalido' });
            }

            const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
            if (ownerScopeUserId) {
                const existingSession = await WhatsAppSession.findBySessionId(sessionId);
                if (existingSession) {
                    const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                        owner_user_id: ownerScopeUserId
                    });
                    if (!ownedSession) {
                        return res.status(403).json({ success: false, error: 'Sem permissao para ressincronizar esta conta' });
                    }
                } else {
                    const runtimeSessionOwnerUserId = normalizeOwnerUserId(sessions.get(sessionId)?.ownerUserId);
                    if (!runtimeSessionOwnerUserId || runtimeSessionOwnerUserId !== ownerScopeUserId) {
                        return res.status(404).json({ success: false, error: 'Conta nao encontrada' });
                    }
                }
            }

            const runtimeSession = sessions.get(sessionId);
            if (!runtimeSession?.socket) {
                return res.status(409).json({
                    success: false,
                    error: 'Sessao nao esta ativa no runtime. Conecte o WhatsApp para ressincronizar.'
                });
            }
            if (!runtimeSession.isConnected) {
                return res.status(409).json({
                    success: false,
                    error: 'Sessao desconectada no momento. Aguarde reconexao para ressincronizar.'
                });
            }
            const runtimeStore = resolveRuntimeSessionStore(sessionId, runtimeSession);
            if (!runtimeStore || typeof runtimeStore.loadMessages !== 'function') {
                return res.status(409).json({
                    success: false,
                    error: 'Store local indisponivel para reidratacao. Tente novamente em instantes.'
                });
            }

            const payload = req.body && typeof req.body === 'object' ? req.body : {};
            const trigger = String(payload.trigger || 'manual-api').trim() || 'manual-api';
            const isManualResync = /manual|resync/i.test(trigger);
            const scopeRaw = String(payload.scope || 'all').trim().toLowerCase();
            const unreadOnly = ['unread', 'pending', 'nao_lidas', 'nao-lidas', 'naolidas'].includes(scopeRaw);

            const defaultMaxConversations = isManualResync
                ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS
                : WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS;
            const defaultMessagesPerConversation = isManualResync
                ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION
                : WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION;
            const defaultMaxRuntimeMs = isManualResync
                ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS
                : WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS;

            const maxConversations = parsePositiveIntInRange(
                payload.maxConversations ?? payload.max_conversations,
                defaultMaxConversations,
                1,
                WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
            );
            const messagesPerConversation = parsePositiveIntInRange(
                payload.messagesPerConversation ??
                payload.messages_per_conversation ??
                payload.limitPerConversation ??
                payload.limit_per_conversation,
                defaultMessagesPerConversation,
                10,
                WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT
            );
            const maxRuntimeMs = parsePositiveIntInRange(
                payload.maxRuntimeMs ?? payload.max_runtime_ms,
                defaultMaxRuntimeMs,
                3000,
                WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS
            );

            const summary = await runSessionReconnectCatchup(sessionId, {
                trigger,
                expectedSocket: runtimeSession.socket,
                maxConversations,
                messagesPerConversation,
                maxRuntimeMs,
                unreadOnly
            });

            return res.json({
                success: true,
                sessionId,
                trigger,
                options: {
                    scope: unreadOnly ? 'unread' : 'all',
                    maxConversations,
                    messagesPerConversation,
                    maxRuntimeMs
                },
                summary
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    router.put('/api/whatsapp/sessions/:sessionId', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
        try {
            const sessionId = sanitizeSessionId(req.params.sessionId);
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId invalido' });
            }

            const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
            if (ownerScopeUserId) {
                const existingSession = await WhatsAppSession.findBySessionId(sessionId);
                if (existingSession) {
                    const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                        owner_user_id: ownerScopeUserId
                    });
                    if (!ownedSession) {
                        return res.status(403).json({ error: 'Sem permissao para editar esta conta' });
                    }
                }
                if (!existingSession) {
                    await planLimitsService.assertOwnerCanCreateWhatsAppSession(ownerScopeUserId, 1);
                }
            }

            const updated = await WhatsAppSession.upsertDispatchConfig(sessionId, {
                name: req.body?.name,
                campaign_enabled: req.body?.campaign_enabled,
                daily_limit: req.body?.daily_limit,
                dispatch_weight: req.body?.dispatch_weight,
                hourly_limit: req.body?.hourly_limit,
                cooldown_until: req.body?.cooldown_until,
                owner_user_id: ownerScopeUserId || undefined,
                created_by: ownerScopeUserId || undefined
            });

            return res.json({ success: true, session: updated });
        } catch (error) {
            return res.status(Number(error?.statusCode || 400) || 400).json({
                error: error.message,
                ...(error?.code ? { code: error.code } : {})
            });
        }
    });

    router.delete('/api/whatsapp/sessions/:sessionId', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
        try {
            const sessionId = sanitizeSessionId(req.params.sessionId);
            if (!sessionId) {
                return res.status(400).json({ error: 'sessionId invalido' });
            }

            const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
            if (ownerScopeUserId) {
                const existingSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!existingSession) {
                    return res.status(404).json({ error: 'Conta nao encontrada' });
                }
            }

            await removeSessionCompletely(sessionId, {
                ownerUserId: ownerScopeUserId || undefined,
                createdBy: ownerScopeUserId || undefined
            });
            return res.json({ success: true, session_id: sessionId });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.post('/api/whatsapp/disconnect', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
        try {
            const sessionId = resolveSessionIdOrDefault(req.body?.sessionId || req.query?.sessionId);
            const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
            if (ownerScopeUserId) {
                const existingSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!existingSession) {
                    return res.status(404).json({ error: 'Conta nao encontrada' });
                }
            }

            await disconnectSessionPreservingRecord(sessionId, {
                ownerUserId: ownerScopeUserId || undefined,
                logoutSocket: true
            });

            return res.json({ success: true, session_id: sessionId });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.get('/api/status', authenticate, async (req, res) => {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        let scopedConnectedSessions = 0;

        for (const [sessionId, session] of sessions.entries()) {
            const runtimeOwnerUserId = normalizeOwnerUserId(session?.ownerUserId);
            const sessionOwnerUserId = runtimeOwnerUserId || await resolveSessionOwnerUserId(sessionId);
            if (ownerScopeUserId && sessionOwnerUserId && Number(sessionOwnerUserId) !== Number(ownerScopeUserId)) {
                continue;
            }
            if (session?.isConnected) {
                scopedConnectedSessions += 1;
            }
        }

        return res.json({
            status: 'online',
            version: '4.1.0',
            connected_sessions: scopedConnectedSessions,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

module.exports = {
    createWhatsAppSessionRoutes
};
