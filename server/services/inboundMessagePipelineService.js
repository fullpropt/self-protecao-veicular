function createInboundMessagePipelineService(options = {}) {
    const runInboundAutomationSerialized = typeof options.runInboundAutomationSerialized === 'function'
        ? options.runInboundAutomationSerialized
        : async (_conversationId, task) => await task();
    const runWithConversationPostgresLock = typeof options.runWithConversationPostgresLock === 'function'
        ? options.runWithConversationPostgresLock
        : async (_conversationId, task) => await task({});
    const getBusinessHoursSettings = typeof options.getBusinessHoursSettings === 'function'
        ? options.getBusinessHoursSettings
        : async () => ({ enabled: false, autoReplyMessage: '' });
    const isWithinBusinessHours = typeof options.isWithinBusinessHours === 'function'
        ? options.isWithinBusinessHours
        : () => true;
    const shouldSendOutsideHoursAutoReply = typeof options.shouldSendOutsideHoursAutoReply === 'function'
        ? options.shouldSendOutsideHoursAutoReply
        : () => false;
    const sendMessage = typeof options.sendMessage === 'function'
        ? options.sendMessage
        : async () => null;
    const markOutsideHoursAutoReplySent = typeof options.markOutsideHoursAutoReplySent === 'function'
        ? options.markOutsideHoursAutoReplySent
        : () => {};
    const flowService = options.flowService || null;
    const scheduleAutomations = typeof options.scheduleAutomations === 'function'
        ? options.scheduleAutomations
        : async () => null;
    const automationEventTypes = options.automationEventTypes || {};
    const flowInboundTelemetryEnabled = options.flowInboundTelemetryEnabled === true;
    const flowInboundTelemetrySlowMs = Math.max(
        1,
        Number(options.flowInboundTelemetrySlowMs || 2000) || 2000
    );
    const logStructured = typeof options.logStructured === 'function'
        ? options.logStructured
        : () => {};

    async function runInboundLeadAutomationStage(context = {}) {
        const conversationId = Number(context?.conversation?.id || 0);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return {
                outsideBusinessHoursBypass: false,
                flowProcessingDurationMs: 0,
                automationsSchedulingDurationMs: 0,
                lockWaitMs: 0
            };
        }

        const sessionId = String(context?.sessionId || '').trim();
        const lead = context?.lead || {};
        const conversation = context?.conversation || {};
        const phone = String(context?.phone || '').trim();
        const text = String(context?.text || '');
        const mediaType = String(context?.mediaType || 'text').trim() || 'text';
        const isSelfChat = context?.isSelfChat === true;
        const interactiveSelection = context?.interactiveSelection || {};
        const messageTimestampIso = String(context?.messageTimestampIso || '').trim();
        const leadCreated = context?.leadCreated === true;
        const convCreated = context?.convCreated === true;
        const incomingMessageId = String(context?.incomingMessageId || '').trim();
        const sessionOwnerUserId = Number(context?.sessionOwnerUserId || 0) || null;

        const metrics = {
            outsideBusinessHoursBypass: false,
            flowProcessingDurationMs: 0,
            automationsSchedulingDurationMs: 0,
            lockWaitMs: 0
        };

        await runInboundAutomationSerialized(conversationId, async () => {
            await runWithConversationPostgresLock(conversationId, async (lockContext = {}) => {
                metrics.lockWaitMs += Math.max(0, Number(lockContext?.lockWaitMs || 0) || 0);

                const automationStartedAtMs = Date.now();
                console.log(`[${sessionId}] ?? Mensagem de ${lead.name || phone}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

                const businessHoursSettings = await getBusinessHoursSettings(
                    sessionOwnerUserId || null,
                    false,
                    sessionId
                );
                const isOutsideBusinessHours = businessHoursSettings.enabled
                    && !isWithinBusinessHours(businessHoursSettings);

                if (isOutsideBusinessHours && !isSelfChat) {
                    metrics.outsideBusinessHoursBypass = true;
                    const autoReplyText = String(businessHoursSettings.autoReplyMessage || '').trim();

                    if (autoReplyText && shouldSendOutsideHoursAutoReply(conversationId)) {
                        try {
                            await sendMessage(sessionId, phone, autoReplyText, 'text', {
                                conversationId
                            });
                            markOutsideHoursAutoReplySent(conversationId);
                        } catch (autoReplyError) {
                            console.error(`[${sessionId}] Erro ao enviar resposta fora do horario:`, autoReplyError.message);
                        }
                    }

                    return;
                }

                if (conversation.is_bot_active && flowService?.processIncomingMessage) {
                    const flowStartedAtMs = Date.now();
                    conversation.created = convCreated;

                    await flowService.processIncomingMessage(
                        {
                            text,
                            mediaType,
                            selectionId: interactiveSelection?.id || '',
                            selectionText: interactiveSelection?.text || ''
                        },
                        lead,
                        conversation
                    );

                    metrics.flowProcessingDurationMs += Date.now() - flowStartedAtMs;
                }

                const automationsStartedAtMs = Date.now();
                await scheduleAutomations({
                    event: automationEventTypes.MESSAGE_RECEIVED,
                    sessionId,
                    text,
                    mediaType,
                    lead,
                    conversation,
                    messageTimestampMs: Date.parse(messageTimestampIso) || Date.now(),
                    leadCreated,
                    conversationCreated: convCreated
                });
                metrics.automationsSchedulingDurationMs += Date.now() - automationsStartedAtMs;

                const automationTotalMs = Date.now() - automationStartedAtMs;
                if (!flowInboundTelemetryEnabled && automationTotalMs >= flowInboundTelemetrySlowMs) {
                    logStructured(
                        'warn',
                        'flow.inbound.automation_slow',
                        {
                            sessionId,
                            conversationId,
                            messageId: incomingMessageId || 'n/a',
                            totalMs: automationTotalMs
                        },
                        'Automacao do inbound acima do limite de latencia'
                    );
                }
            });
        });

        return metrics;
    }

    return {
        runInboundLeadAutomationStage
    };
}

module.exports = {
    createInboundMessagePipelineService
};
