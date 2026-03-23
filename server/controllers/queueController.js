function createQueueController(options = {}) {
    const queueService = options.queueService;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const Lead = options.Lead;
    const Conversation = options.Conversation;
    const canAccessLeadRecordInOwnerScope = options.canAccessLeadRecordInOwnerScope;
    const canAccessConversationInOwnerScope = options.canAccessConversationInOwnerScope;
    const sanitizeSessionId = options.sanitizeSessionId;
    const canAccessSessionRecordInOwnerScope = options.canAccessSessionRecordInOwnerScope;
    const senderAllocatorService = options.senderAllocatorService;
    const query = options.query;
    const normalizeSenderAccountsPayload = options.normalizeSenderAccountsPayload;
    const normalizeCampaignDistributionStrategy = options.normalizeCampaignDistributionStrategy;

    return {
        async getQueueStatus(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            return res.json({
                success: true,
                ...(await queueService.getStatus({
                    ownerUserId: ownerScopeUserId || undefined
                }))
            });
        },

        async addQueueItem(req, res) {
            try {
                const {
                    leadId,
                    conversationId,
                    campaignId,
                    content,
                    mediaType,
                    mediaUrl,
                    priority,
                    scheduledAt,
                    sessionId,
                    isFirstContact,
                    assignmentMeta
                } = req.body || {};

                const normalizedLeadId = Number(leadId);
                if (!Number.isInteger(normalizedLeadId) || normalizedLeadId <= 0) {
                    return res.status(400).json({ success: false, error: 'leadId invalido' });
                }

                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const lead = await Lead.findById(normalizedLeadId);
                if (!lead) {
                    return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
                }

                const hasLeadAccess = await canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId || null);
                if (!hasLeadAccess) {
                    return res.status(403).json({ success: false, error: 'Sem permissao para enfileirar mensagens para este lead' });
                }

                const normalizedConversationId = Number(conversationId);
                let resolvedConversationId = null;
                if (Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
                    const conversation = await Conversation.findById(normalizedConversationId);
                    if (!conversation) {
                        return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
                    }

                    const hasConversationAccess = await canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId || null);
                    if (!hasConversationAccess) {
                        return res.status(403).json({ success: false, error: 'Sem permissao para enfileirar nesta conversa' });
                    }

                    if (Number(conversation.lead_id) !== normalizedLeadId) {
                        return res.status(400).json({ success: false, error: 'Conversa informada nao pertence ao lead' });
                    }

                    resolvedConversationId = normalizedConversationId;
                }

                let resolvedSessionId = sanitizeSessionId(sessionId);
                if (resolvedSessionId) {
                    const hasSessionAccess = await canAccessSessionRecordInOwnerScope(req, resolvedSessionId, ownerScopeUserId || null);
                    if (!hasSessionAccess) {
                        return res.status(403).json({ success: false, error: 'Sem permissao para usar esta conta de WhatsApp' });
                    }
                } else {
                    const allocation = await senderAllocatorService.allocateForSingleLead({
                        leadId: normalizedLeadId,
                        campaignId,
                        strategy: 'round_robin',
                        ownerUserId: ownerScopeUserId || undefined
                    });
                    resolvedSessionId = sanitizeSessionId(allocation?.sessionId);
                }

                const result = await queueService.add({
                    leadId: normalizedLeadId,
                    conversationId: resolvedConversationId,
                    campaignId,
                    sessionId: resolvedSessionId || null,
                    isFirstContact: isFirstContact !== false,
                    assignmentMeta: assignmentMeta || null,
                    content,
                    mediaType,
                    mediaUrl,
                    priority,
                    scheduledAt
                });

                return res.json({ success: true, ...result });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error?.message || 'Falha ao adicionar mensagem na fila'
                });
            }
        },

        async addQueueBulk(req, res) {
            try {
                const payload = req.validatedData || {};
                const leadIds = Array.isArray(payload.leadIds) ? payload.leadIds : (Array.isArray(req.body?.leadIds) ? req.body.leadIds : []);
                const content = typeof payload.content === 'string' ? payload.content : String(req.body?.content || '');
                const optionsSource = (payload.options && typeof payload.options === 'object')
                    ? payload.options
                    : req.body?.options;
                const queueOptions = (optionsSource && typeof optionsSource === 'object' && !Array.isArray(optionsSource))
                    ? { ...optionsSource }
                    : {};

                const parseNonNegative = (value) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
                };

                const legacyDelay = parseNonNegative(req.body?.delay);
                const legacyDelayMin = parseNonNegative(req.body?.delayMin ?? req.body?.delay_min);
                const legacyDelayMax = parseNonNegative(req.body?.delayMax ?? req.body?.delay_max);

                if (queueOptions.delayMs === undefined && legacyDelay !== null) {
                    queueOptions.delayMs = legacyDelay;
                }
                if (queueOptions.delayMinMs === undefined && legacyDelayMin !== null) {
                    queueOptions.delayMinMs = legacyDelayMin;
                }
                if (queueOptions.delayMaxMs === undefined && legacyDelayMax !== null) {
                    queueOptions.delayMaxMs = legacyDelayMax;
                }

                const hasSessionAssignments = queueOptions.sessionAssignments && typeof queueOptions.sessionAssignments === 'object';
                const normalizedLeadIds = Array.from(
                    new Set(
                        Array.isArray(leadIds)
                            ? leadIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
                            : []
                    )
                );
                if (!normalizedLeadIds.length) {
                    return res.status(400).json({ success: false, error: 'leadIds invalido' });
                }

                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const leadRows = await query(
                    'SELECT id, assigned_to, owner_user_id FROM leads WHERE id = ANY(?::int[])',
                    [normalizedLeadIds]
                );
                const leadById = new Map((leadRows || []).map((lead) => [Number(lead.id), lead]));
                const missingLeadIds = normalizedLeadIds.filter((id) => !leadById.has(id));
                if (missingLeadIds.length > 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Um ou mais leads nao foram encontrados',
                        missing_lead_ids: missingLeadIds
                    });
                }

                for (const leadIdValue of normalizedLeadIds) {
                    const leadRecord = leadById.get(leadIdValue);
                    const allowed = await canAccessLeadRecordInOwnerScope(req, leadRecord, ownerScopeUserId || null);
                    if (!allowed) {
                        return res.status(403).json({
                            success: false,
                            error: 'Sem permissao para enfileirar para um ou mais leads'
                        });
                    }
                }

                const fixedSessionId = sanitizeSessionId(
                    queueOptions.sessionId || queueOptions.session_id || req.body?.sessionId || req.body?.session_id
                );
                const senderAccounts = normalizeSenderAccountsPayload(
                    queueOptions.senderAccounts || queueOptions.sender_accounts || req.body?.sender_accounts || req.body?.senderAccounts
                );
                const distributionStrategy = normalizeCampaignDistributionStrategy(
                    queueOptions.distributionStrategy || queueOptions.distribution_strategy || req.body?.distribution_strategy,
                    fixedSessionId ? 'single' : (senderAccounts.length ? 'weighted_round_robin' : 'round_robin')
                );

                const sessionIdsToValidate = new Set();
                if (fixedSessionId) sessionIdsToValidate.add(fixedSessionId);
                for (const account of senderAccounts) {
                    const accountSessionId = sanitizeSessionId(account?.session_id || account?.sessionId);
                    if (accountSessionId) sessionIdsToValidate.add(accountSessionId);
                }
                if (hasSessionAssignments) {
                    for (const leadIdValue of normalizedLeadIds) {
                        const assignedSessionId = sanitizeSessionId(
                            queueOptions.sessionAssignments[String(leadIdValue)]
                            || queueOptions.sessionAssignments[leadIdValue]
                        );
                        if (assignedSessionId) sessionIdsToValidate.add(assignedSessionId);
                    }
                }

                for (const sessionIdToValidate of sessionIdsToValidate) {
                    const hasSessionAccess = await canAccessSessionRecordInOwnerScope(req, sessionIdToValidate, ownerScopeUserId || null);
                    if (!hasSessionAccess) {
                        return res.status(403).json({
                            success: false,
                            error: `Sem permissao para usar a conta de WhatsApp ${sessionIdToValidate}`
                        });
                    }
                }

                let distribution = { strategyUsed: fixedSessionId ? 'single' : distributionStrategy, summary: {} };
                if (!hasSessionAssignments) {
                    const allocationPlan = await senderAllocatorService.buildDistributionPlan({
                        leadIds: normalizedLeadIds,
                        campaignId: queueOptions.campaignId || req.body?.campaignId || null,
                        senderAccounts,
                        strategy: distributionStrategy,
                        sessionId: fixedSessionId || null,
                        ownerUserId: ownerScopeUserId || undefined
                    });
                    queueOptions.sessionAssignments = allocationPlan.assignmentsByLead;
                    queueOptions.assignmentMetaByLead = allocationPlan.assignmentMetaByLead;
                    distribution = {
                        strategyUsed: allocationPlan.strategyUsed,
                        summary: allocationPlan.summary || {}
                    };
                }

                queueOptions.ownerUserId = ownerScopeUserId || undefined;
                const results = await queueService.addBulk(normalizedLeadIds, content, queueOptions);

                return res.json({
                    success: true,
                    queued: results.length,
                    distribution: {
                        strategy: distribution.strategyUsed,
                        by_session: distribution.summary
                    }
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error?.message || 'Falha ao enfileirar disparo em massa'
                });
            }
        },

        async deleteQueueItem(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const cancelled = await queueService.cancel(req.params.id, {
                ownerUserId: ownerScopeUserId || undefined
            });
            if (!cancelled) {
                return res.status(404).json({ success: false, error: 'Mensagem da fila nao encontrada' });
            }
            return res.json({ success: true });
        },

        async clearQueue(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const count = await queueService.cancelAll({
                ownerUserId: ownerScopeUserId || undefined
            });

            return res.json({ success: true, cancelled: count });
        }
    };
}

module.exports = {
    createQueueController
};
