function createMessageController(options = {}) {
    const getScopedUserId = options.getScopedUserId;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const Conversation = options.Conversation;
    const Message = options.Message;
    const Lead = options.Lead;
    const WhatsAppSession = options.WhatsAppSession;
    const canAccessConversationInOwnerScope = options.canAccessConversationInOwnerScope;
    const canAccessLeadRecordInOwnerScope = options.canAccessLeadRecordInOwnerScope;
    const canAccessAssignedRecordInOwnerScope = options.canAccessAssignedRecordInOwnerScope;
    const markConversationAsReadWithMetadata = options.markConversationAsReadWithMetadata;
    const sendMessage = options.sendMessage;
    const sanitizeSessionId = options.sanitizeSessionId;
    const resolveSessionIdOrDefault = options.resolveSessionIdOrDefault;
    const resolveMessageContentWithFallback = options.resolveMessageContentWithFallback;
    const normalizeText = options.normalizeText;
    const parseLeadCustomFields = options.parseLeadCustomFields;
    const normalizeLeadAvatarUrl = options.normalizeLeadAvatarUrl;
    const LEAD_AVATAR_CUSTOM_FIELD_KEY = options.LEAD_AVATAR_CUSTOM_FIELD_KEY;
    const getSessionPhone = options.getSessionPhone;
    const normalizePhoneDigits = options.normalizePhoneDigits;
    const isSelfPhone = options.isSelfPhone;
    const getSessionDisplayName = options.getSessionDisplayName;
    const normalizeJid = options.normalizeJid;
    const backfillConversationMessagesFromStore = options.backfillConversationMessagesFromStore;
    const query = options.query;
    const sessions = options.sessions;
    const triggerChatSync = options.triggerChatSync;
    const createStoreBackfillResult = options.createStoreBackfillResult;
    const previewForMedia = options.previewForMedia;

    function previewForMediaLocal(mediaType) {
        switch (mediaType) {
            case 'image':
                return '[imagem]';
            case 'video':
                return '[video]';
            case 'audio':
                return '[audio]';
            case 'document':
                return '[documento]';
            case 'sticker':
                return '[sticker]';
            default:
                return '[mensagem]';
        }
    }

    function normalizePhoneSuffix(value) {
        if (!value) return '';
        const digits = String(value).replace(/\D/g, '');
        if (!digits) return '';
        return digits.length >= 11 ? digits.slice(-11) : digits;
    }

    function parseBooleanFlag(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const normalized = String(value || '').trim().toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
            if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
        }
        return fallback;
    }

    async function countMissingStickerMediaForConversation(conversationId) {
        const normalizedConversationId = Number(conversationId);
        if (!Number.isFinite(normalizedConversationId) || normalizedConversationId <= 0) return 0;

        try {
            const rows = await query(`
            SELECT COUNT(*) AS total
            FROM messages
            WHERE conversation_id = ?
              AND LOWER(COALESCE(media_type, '')) = 'sticker'
              AND COALESCE(TRIM(media_url), '') = ''
        `, [normalizedConversationId]);

            return Math.max(0, Number(rows?.[0]?.total || 0) || 0);
        } catch (error) {
            console.warn(`[rehydrate-sticker] Falha ao contar stickers pendentes na conversa ${normalizedConversationId}:`, error.message);
            return 0;
        }
    }

    return {
        async listConversations(req, res) {
            const { status, assigned_to, session_id, limit, offset } = req.query;
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const requestedAssignedTo = assigned_to ? parseInt(assigned_to) : undefined;
            const resolvedAssignedTo = scopedUserId || requestedAssignedTo;
            const conversations = await Conversation.list({
                status,
                assigned_to: resolvedAssignedTo,
                owner_user_id: ownerScopeUserId || undefined,
                session_id,
                limit: limit ? parseInt(limit) : 100,
                offset: offset ? parseInt(offset) : 0
            });
            const conversationIds = conversations
                .map((conversation) => Number(conversation?.id || 0))
                .filter((conversationId) => Number.isInteger(conversationId) && conversationId > 0);

            const runningFlowByConversationId = new Map();
            if (conversationIds.length > 0) {
                try {
                    const placeholders = conversationIds.map(() => '?').join(', ');
                    const runningExecutionRows = await query(`
                        SELECT
                            conversation_id,
                            COUNT(*) AS total,
                            MAX(flow_id) AS flow_id
                        FROM flow_executions
                        WHERE status = 'running'
                          AND conversation_id IN (${placeholders})
                        GROUP BY conversation_id
                    `, conversationIds);

                    for (const row of runningExecutionRows || []) {
                        const conversationId = Number(row?.conversation_id || 0);
                        if (!Number.isInteger(conversationId) || conversationId <= 0) continue;

                        runningFlowByConversationId.set(conversationId, {
                            total: Math.max(0, Number(row?.total || 0) || 0),
                            flowId: Number(row?.flow_id || 0) || null
                        });
                    }
                } catch (error) {
                    console.warn('[messageController:listConversations] Falha ao consultar execucoes de fluxo em andamento:', error.message);
                }
            }

            const lastMessages = await Message.getLastMessagesByConversationIds(
                conversations.map((conversation) => conversation.id)
            );
            const lastMessageByConversationId = new Map(
                lastMessages.map((message) => [Number(message.conversation_id), message])
            );

            const normalized = conversations.map((c) => {
                const lastMessage = lastMessageByConversationId.get(Number(c.id)) || null;
                const decrypted = resolveMessageContentWithFallback(lastMessage);
                const runningFlow = runningFlowByConversationId.get(Number(c.id)) || null;
                const flowIsRunning = Boolean((runningFlow?.total || 0) > 0);
                const runningFlowId = Number(runningFlow?.flowId || 0) || null;
                const isBotActive = parseBooleanFlag(c?.is_bot_active, true);

                let metadata = {};
                try {
                    metadata = c?.metadata ? JSON.parse(c.metadata) : {};
                } catch (_) {
                    metadata = {};
                }
                const metadataLastMessage = normalizeText(metadata?.last_message || '');
                const metadataLastMessageAt = normalizeText(metadata?.last_message_at || '');
                const lastMessageWasFromMe = Boolean(lastMessage?.is_from_me);
                const unreadCount = lastMessageWasFromMe ? 0 : Math.max(0, Number(c?.unread_count || 0));

                const lastMessageText =
                    (decrypted || '').trim()
                    || (lastMessage ? previewForMediaLocal(lastMessage.media_type) : '')
                    || metadataLastMessage
                    || (unreadCount > 0 ? '[mensagem recebida]' : '');

                const lastMessageAt =
                    lastMessage?.sent_at
                    || lastMessage?.created_at
                    || metadataLastMessageAt
                    || c?.updated_at
                    || c?.created_at
                    || null;

                const leadCustomFields = parseLeadCustomFields(c?.lead_custom_fields);
                const avatarUrl = normalizeLeadAvatarUrl(
                    leadCustomFields?.[LEAD_AVATAR_CUSTOM_FIELD_KEY] || leadCustomFields?.avatarUrl
                );

                let name = normalizeText(c.lead_name);
                const sessionPhone = getSessionPhone(c.session_id);
                const phoneDigits = normalizePhoneDigits(c.phone);
                const sessionDigits = normalizePhoneDigits(sessionPhone);
                if (isSelfPhone(phoneDigits, sessionDigits)) {
                    const sessionName = normalizeText(getSessionDisplayName(c.session_id) || 'Usuário');
                    name = sessionName ? `${sessionName} (Você)` : 'Você';
                }

                return {
                    ...c,
                    unread: unreadCount,
                    lastMessage: normalizeText(lastMessageText),
                    lastMessageAt,
                    name,
                    phone: c.phone,
                    avatar_url: avatarUrl || null,
                    is_bot_active: isBotActive ? 1 : 0,
                    flow_is_running: flowIsRunning ? 1 : 0,
                    flow_running_id: runningFlowId
                };
            }).filter((conv) => {
                if (!conv.lastMessageAt && !conv.lastMessage && Number(conv?.unread || 0) <= 0) {
                    return false;
                }
                return true;
            });

            const deduped = new Map();
            for (const conv of normalized) {
                const phoneKey = normalizePhoneSuffix(conv.phone);
                const sessionKey = sanitizeSessionId(conv.session_id || conv.sessionId || '');
                const baseKey = phoneKey || String(conv.lead_id || conv.id);
                const key = sessionKey ? `${sessionKey}::${baseKey}` : baseKey;
                if (!deduped.has(key)) {
                    deduped.set(key, conv);
                    continue;
                }
                const existing = deduped.get(key);
                const existingTime = existing?.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
                const currentTime = conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
                if (currentTime >= existingTime) {
                    deduped.set(key, conv);
                }
            }

            const sorted = Array.from(deduped.values()).sort((a, b) => {
                const aTime = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const bTime = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return bTime - aTime;
            });

            return res.json({ success: true, conversations: sorted });
        },

        async toggleConversationFlow(req, res) {
            const conversationId = parseInt(req.params.id, 10);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            if (!conversationId) {
                return res.status(400).json({ error: 'ID de conversa invalido' });
            }

            try {
                const conversation = await Conversation.findById(conversationId);
                const hasAccess = conversation
                    ? await canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId)
                    : false;

                if (!conversation || !hasAccess) {
                    return res.status(404).json({ error: 'Conversa nao encontrada' });
                }

                const currentIsBotActive = parseBooleanFlag(conversation.is_bot_active, true);
                const hasExplicitActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'active');
                const nextIsBotActive = hasExplicitActive
                    ? parseBooleanFlag(req.body?.active, currentIsBotActive)
                    : !currentIsBotActive;

                await Conversation.update(conversationId, { is_bot_active: nextIsBotActive ? 1 : 0 });

                const runningExecutionRows = await query(`
                    SELECT
                        COUNT(*) AS total,
                        MAX(flow_id) AS flow_id
                    FROM flow_executions
                    WHERE status = 'running'
                      AND conversation_id = ?
                `, [conversationId]);
                const runningExecution = runningExecutionRows?.[0] || {};
                const flowIsRunning = Math.max(0, Number(runningExecution?.total || 0) || 0) > 0;
                const runningFlowId = Number(runningExecution?.flow_id || 0) || null;

                return res.json({
                    success: true,
                    conversation_id: conversationId,
                    is_bot_active: nextIsBotActive ? 1 : 0,
                    flow_is_running: flowIsRunning ? 1 : 0,
                    flow_running_id: runningFlowId
                });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        },

        async markConversationRead(req, res) {
            const conversationId = parseInt(req.params.id, 10);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            if (!conversationId) {
                return res.status(400).json({ error: 'ID de conversa invalido' });
            }

            try {
                const conversation = await Conversation.findById(conversationId);
                const hasAccess = conversation
                    ? await canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId)
                    : false;
                if (!conversation || !hasAccess) {
                    return res.status(404).json({ error: 'Conversa nao encontrada' });
                }

                await markConversationAsReadWithMetadata(conversation);

                return res.json({ success: true });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        },

        async sendLegacyApiMessage(req, res) {
            const validatedPayload = req.validatedData || {};
            const sessionId = String(validatedPayload.sessionId || req.body?.sessionId || '').trim();
            const to = validatedPayload.to || req.body?.to;
            const message = validatedPayload.message || req.body?.message;
            const type = validatedPayload.type || req.body?.type;
            const sendOptionsPayload = req.body?.options;
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            if (!sessionId || !to || !message) {
                return res.status(400).json({ error: 'ParÃ¢metros obrigatÃ³rios: sessionId, to, message' });
            }

            try {
                const normalizedSessionId = sanitizeSessionId(sessionId);
                if (ownerScopeUserId && normalizedSessionId) {
                    const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                        owner_user_id: ownerScopeUserId
                    });
                    if (!allowedSession) {
                        return res.status(403).json({ error: 'Sem permissao para usar esta conta WhatsApp' });
                    }
                }

                const sendOptions = {
                    ...(sendOptionsPayload || {}),
                    ...(scopedUserId ? { assigned_to: scopedUserId } : {})
                };

                const result = await sendMessage(sessionId, to, message, type || 'text', sendOptions);

                const responseTimestamp = result?.savedMessage?.sent_at || result?.sentAt || new Date().toISOString();
                return res.json({
                    success: true,
                    messageId: result.key.id,
                    timestamp: responseTimestamp,
                    sentAt: responseTimestamp
                });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        },

        async sendMessageByLeadOrPhone(req, res) {
            const { leadId, phone, content, type, options: sendOptionsPayload, sessionId } = req.body;
            const scopedUserId = getScopedUserId(req);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            let to = phone;

            if (!to && leadId) {
                const lead = await Lead.findById(leadId);
                const hasAccess = lead
                    ? await canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId)
                    : false;
                if (!lead || !hasAccess) {
                    return res.status(404).json({ error: 'Lead nao encontrado' });
                }

                to = lead?.phone;
            }

            if (!to || !content) {
                return res.status(400).json({ error: 'ParÃ¢metros obrigatÃ³rios: phone/to e content' });
            }

            try {
                const resolvedSessionId = resolveSessionIdOrDefault(sessionId);
                if (ownerScopeUserId && resolvedSessionId) {
                    const allowedSession = await WhatsAppSession.findBySessionId(resolvedSessionId, {
                        owner_user_id: ownerScopeUserId
                    });
                    if (!allowedSession) {
                        return res.status(403).json({ error: 'Sem permissao para usar esta conta WhatsApp' });
                    }
                }
                const sendOptions = {
                    ...(sendOptionsPayload || {}),
                    ...(scopedUserId ? { assigned_to: scopedUserId } : {})
                };
                const result = await sendMessage(resolvedSessionId, to, content, type || 'text', sendOptions);

                const responseTimestamp = result?.savedMessage?.sent_at || result?.sentAt || new Date().toISOString();
                return res.json({
                    success: true,
                    messageId: result.key.id,
                    timestamp: responseTimestamp,
                    sentAt: responseTimestamp
                });
            } catch (error) {
                return res.status(500).json({ error: error.message });
            }
        },

        async listMessages(req, res) {
            const leadId = Number(req.params.leadId);
            const limit = parseInt(req.query.limit) || 100;
            const conversationId = Number(req.query.conversation_id || req.query.conversationId);
            const hasConversationId = Number.isFinite(conversationId) && conversationId > 0;
            const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
            const contactJid = normalizeJid(req.query.contact_jid || req.query.contactJid);
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            let messages = [];
            let resolvedConversation = null;
            let resolvedLead = null;

            if (hasConversationId) {
                const conversation = await Conversation.findById(conversationId);
                const conversationSessionId = sanitizeSessionId(conversation?.session_id);
                if (conversation && (!sessionId || conversationSessionId === sessionId)) {
                    resolvedConversation = conversation;
                }
                if (resolvedConversation) {
                    resolvedLead = await Lead.findById(resolvedConversation.lead_id);
                    messages = await Message.listByConversation(resolvedConversation.id, { limit });
                }
            } else if (Number.isFinite(leadId) && leadId > 0) {
                resolvedLead = await Lead.findById(leadId);
                const conversation = await Conversation.findByLeadId(leadId, sessionId || null);
                if (conversation) {
                    resolvedConversation = conversation;
                    messages = await Message.listByConversation(conversation.id, { limit });
                } else {
                    messages = [];
                }
            }

            const hasConversationAccess = resolvedConversation
                ? await canAccessConversationInOwnerScope(req, resolvedConversation, ownerScopeUserId)
                : false;

            if (resolvedLead && !hasConversationAccess && !(await canAccessAssignedRecordInOwnerScope(req, resolvedLead.assigned_to, ownerScopeUserId))) {
                return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
            }
            if (!resolvedLead && resolvedConversation && !hasConversationAccess) {
                return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
            }

            const backfillSessionId = sanitizeSessionId(
                sessionId || resolvedConversation?.session_id
            );
            const hasMissingMedia = messages.some((item) => {
                const mediaType = String(item?.media_type || '').trim().toLowerCase();
                if (!mediaType || mediaType === 'text') return false;
                return !String(item?.media_url || '').trim();
            });
            if ((messages.length === 0 || hasMissingMedia) && resolvedConversation && backfillSessionId) {
                const backfillResult = await backfillConversationMessagesFromStore({
                    sessionId: backfillSessionId,
                    conversation: resolvedConversation,
                    lead: resolvedLead,
                    contactJid,
                    limit: Math.max(limit, 50)
                });
                if ((backfillResult.inserted || 0) > 0 || (backfillResult.hydratedMedia || 0) > 0) {
                    messages = await Message.listByConversation(resolvedConversation.id, { limit });
                }
            }

            const decrypted = messages.map((m) => {
                const raw = resolveMessageContentWithFallback(m);
                let text = raw;
                if ((!text || !String(text).trim()) && m.media_type && m.media_type !== 'text') {
                    const previewFn = typeof previewForMedia === 'function' ? previewForMedia : previewForMediaLocal;
                    text = previewFn(m.media_type);
                }
                text = normalizeText(text);
                return {
                    ...m,
                    content: text
                };
            });

            return res.json({ success: true, messages: decrypted });
        },

        async rehydrateMissingMedia(req, res) {
            const leadId = Number(req.params.leadId);
            const payload = req.body || {};
            const requestedLimit = Number(payload.limit || req.query.limit);
            const limit = Math.max(50, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 250, 500));
            const conversationId = Number(
                payload.conversation_id
                || payload.conversationId
                || req.query.conversation_id
                || req.query.conversationId
            );
            const hasConversationId = Number.isFinite(conversationId) && conversationId > 0;
            const sessionId = sanitizeSessionId(
                payload.session_id
                || payload.sessionId
                || req.query.session_id
                || req.query.sessionId
            );
            const contactJid = normalizeJid(
                payload.contact_jid
                || payload.contactJid
                || req.query.contact_jid
                || req.query.contactJid
            );
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

            let resolvedConversation = null;
            let resolvedLead = null;

            if (hasConversationId) {
                const conversation = await Conversation.findById(conversationId);
                const conversationSessionId = sanitizeSessionId(conversation?.session_id);
                if (conversation && (!sessionId || conversationSessionId === sessionId)) {
                    resolvedConversation = conversation;
                }
                if (resolvedConversation) {
                    resolvedLead = await Lead.findById(resolvedConversation.lead_id);
                }
            } else if (Number.isFinite(leadId) && leadId > 0) {
                resolvedLead = await Lead.findById(leadId);
                const conversation = await Conversation.findByLeadId(leadId, sessionId || null);
                if (conversation) {
                    resolvedConversation = conversation;
                }
            }

            const hasConversationAccess = resolvedConversation
                ? await canAccessConversationInOwnerScope(req, resolvedConversation, ownerScopeUserId)
                : false;

            if (resolvedLead && !hasConversationAccess && !(await canAccessAssignedRecordInOwnerScope(req, resolvedLead.assigned_to, ownerScopeUserId))) {
                return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
            }
            if (!resolvedLead && resolvedConversation && !hasConversationAccess) {
                return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
            }
            if (!resolvedConversation) {
                return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
            }

            const backfillSessionId = sanitizeSessionId(sessionId || resolvedConversation.session_id);
            if (!backfillSessionId) {
                return res.status(400).json({ success: false, error: 'Sessao da conversa nao encontrada' });
            }

            try {
                const runtimeSession = sessions.get(backfillSessionId);
                if (runtimeSession?.socket && runtimeSession?.store) {
                    try {
                        await triggerChatSync(backfillSessionId, runtimeSession.socket, runtimeSession.store, 0);
                    } catch (syncError) {
                        console.warn(`[${backfillSessionId}] Falha no sync manual para reidratacao de midia:`, syncError.message);
                    }
                }

                const missingStickersBefore = await countMissingStickerMediaForConversation(resolvedConversation.id);
                const backfillResult = await backfillConversationMessagesFromStore({
                    sessionId: backfillSessionId,
                    conversation: resolvedConversation,
                    lead: resolvedLead,
                    contactJid: contactJid || resolvedLead?.jid || resolvedLead?.phone || '',
                    limit
                });
                const missingStickersAfter = await countMissingStickerMediaForConversation(resolvedConversation.id);

                return res.json({
                    success: true,
                    conversationId: resolvedConversation.id,
                    leadId: resolvedLead?.id || resolvedConversation.lead_id || null,
                    sessionId: backfillSessionId,
                    limit,
                    backfill: backfillResult || createStoreBackfillResult(),
                    missingStickersBefore,
                    missingStickersAfter
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error?.message || 'Falha ao reidratar midias da conversa'
                });
            }
        }
    };
}

module.exports = {
    createMessageController
};
