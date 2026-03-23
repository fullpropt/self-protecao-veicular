function createAdminDashboardController(options = {}) {
    const ensureApplicationAdmin = options.ensureApplicationAdmin;
    const loadEmailDeliverySettings = options.loadEmailDeliverySettings;
    const sanitizeEmailDeliverySettingsForResponse = options.sanitizeEmailDeliverySettingsForResponse;
    const normalizeEmailDeliverySettingsInput = options.normalizeEmailDeliverySettingsInput;
    const isValidEmailAddress = options.isValidEmailAddress;
    const serializeEmailDeliverySettingsForStorage = options.serializeEmailDeliverySettingsForStorage;
    const Settings = options.Settings;
    const emailDeliverySettingsKey = options.emailDeliverySettingsKey;
    const buildRuntimeEmailDeliveryConfig = options.buildRuntimeEmailDeliveryConfig;
    const createEmailConfirmationTokenPayload = options.createEmailConfirmationTokenPayload;
    const resolveAppUrl = options.resolveAppUrl;
    const buildEmailConfirmationUrl = options.buildEmailConfirmationUrl;
    const buildEmailTemplateContext = options.buildEmailTemplateContext;
    const buildRenderedEmailContent = options.buildRenderedEmailContent;
    const getRegistrationEmailRuntimeConfig = options.getRegistrationEmailRuntimeConfig;
    const sendRegistrationConfirmationEmail = options.sendRegistrationConfirmationEmail;
    const MailMktIntegrationError = options.MailMktIntegrationError;
    const SupportInboxMessage = options.SupportInboxMessage;

    return {
        async getEmailSettings(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const currentSettings = await loadEmailDeliverySettings();
                return res.json({
                    success: true,
                    settings: sanitizeEmailDeliverySettingsForResponse(currentSettings)
                });
            } catch (error) {
                console.error('[admin/dashboard/email-settings:get] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao carregar configuracoes de email'
                });
            }
        },

        async updateEmailSettings(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const currentSettings = await loadEmailDeliverySettings();
                const normalized = normalizeEmailDeliverySettingsInput(req.body, currentSettings);

                if (normalized.provider === 'sendgrid') {
                    if (!normalized.sendgridFromEmail || !isValidEmailAddress(normalized.sendgridFromEmail)) {
                        return res.status(400).json({
                            success: false,
                            error: 'Informe um email remetente valido para o SendGrid'
                        });
                    }

                    if (!String(normalized.sendgridApiKey || '').trim()) {
                        return res.status(400).json({
                            success: false,
                            error: 'Informe a SENDGRID_API_KEY para enviar emails'
                        });
                    }
                }

                if (normalized.provider === 'mailgun') {
                    if (!String(normalized.mailgunDomain || '').trim()) {
                        return res.status(400).json({
                            success: false,
                            error: 'Informe o MAILGUN_DOMAIN para enviar emails'
                        });
                    }

                    if (!normalized.mailgunFromEmail || !isValidEmailAddress(normalized.mailgunFromEmail)) {
                        return res.status(400).json({
                            success: false,
                            error: 'Informe um email remetente valido para o Mailgun'
                        });
                    }

                    if (!String(normalized.mailgunApiKey || '').trim()) {
                        return res.status(400).json({
                            success: false,
                            error: 'Informe a MAILGUN_API_KEY para enviar emails'
                        });
                    }
                }

                const serialized = serializeEmailDeliverySettingsForStorage(normalized);
                await Settings.set(emailDeliverySettingsKey, serialized, 'json');

                const refreshed = await loadEmailDeliverySettings();
                return res.json({
                    success: true,
                    settings: sanitizeEmailDeliverySettingsForResponse(refreshed)
                });
            } catch (error) {
                console.error('[admin/dashboard/email-settings:put] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao salvar configuracoes de email'
                });
            }
        },

        async previewEmailSettings(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const currentSettings = await loadEmailDeliverySettings();
                const normalized = normalizeEmailDeliverySettingsInput(req.body, currentSettings);
                const runtimeSettings = buildRuntimeEmailDeliveryConfig(normalized);

                const tokenPayload = createEmailConfirmationTokenPayload();
                const baseAppUrl = resolveAppUrl(req) || String(process.env.APP_URL || 'https://zapvender.com').trim();
                const confirmationUrl = buildEmailConfirmationUrl(baseAppUrl, tokenPayload.token);

                const rawPreviewEmail = String(req.body?.previewEmail || req.body?.email || req.user?.email || '').trim().toLowerCase();
                const previewEmail = isValidEmailAddress(rawPreviewEmail) ? rawPreviewEmail : 'contato@empresa.com';
                const previewName = String(req.body?.previewName || req.body?.name || 'Usuario').trim() || 'Usuario';

                const context = buildEmailTemplateContext(
                    {
                        id: req.user?.id || null,
                        name: previewName,
                        email: previewEmail
                    },
                    confirmationUrl,
                    {
                        appName: runtimeSettings.appName,
                        expiresInText: tokenPayload.expiresInText,
                        appUrl: baseAppUrl
                    }
                );
                const content = buildRenderedEmailContent(context, runtimeSettings);

                return res.json({
                    success: true,
                    preview: {
                        subject: content.subject,
                        html: content.html,
                        text: content.text
                    }
                });
            } catch (error) {
                console.error('[admin/dashboard/email-settings:preview] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao gerar pre-visualizacao do email'
                });
            }
        },

        async sendTestEmail(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const targetEmail = String(req.body?.email || req.user?.email || '').trim().toLowerCase();
                if (!targetEmail || !isValidEmailAddress(targetEmail)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Informe um email valido para o envio de teste'
                    });
                }

                const runtimeSettings = await getRegistrationEmailRuntimeConfig();
                const tokenPayload = createEmailConfirmationTokenPayload();

                await sendRegistrationConfirmationEmail(
                    req,
                    {
                        id: req.user?.id || null,
                        name: 'Teste de configuracao',
                        email: targetEmail
                    },
                    tokenPayload,
                    {
                        emailSettings: runtimeSettings
                    }
                );

                return res.json({
                    success: true,
                    message: 'Email de teste enviado com sucesso',
                    email: targetEmail,
                    provider: runtimeSettings.provider
                });
            } catch (error) {
                if (error instanceof MailMktIntegrationError) {
                    return res.status(error.statusCode || 502).json({
                        success: false,
                        error: error.message || 'Falha ao enviar email de teste',
                        retryable: error.retryable !== false
                    });
                }

                console.error('[admin/dashboard/email-settings:test] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao enviar email de teste'
                });
            }
        },

        async listEmailSupportInbox(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 30) || 30));
                const offset = Math.max(0, Number(req.query?.offset || 0) || 0);
                const unreadOnly = ['1', 'true', 'yes', 'sim', 'on'].includes(
                    String(req.query?.unread_only ?? req.query?.unreadOnly ?? '').trim().toLowerCase()
                );

                const [messages, unreadCount] = await Promise.all([
                    SupportInboxMessage.list({
                        limit,
                        offset,
                        unread_only: unreadOnly
                    }),
                    SupportInboxMessage.count({
                        unread_only: true
                    })
                ]);

                return res.json({
                    success: true,
                    inbox: {
                        messages,
                        unreadCount
                    }
                });
            } catch (error) {
                console.error('[admin/dashboard/email-support-inbox:get] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao carregar caixa de entrada de suporte'
                });
            }
        },

        async markEmailSupportInboxRead(req, res) {
            if (!ensureApplicationAdmin(req, res)) return;

            try {
                const messageId = parseInt(String(req.params?.id || ''), 10);
                if (!Number.isInteger(messageId) || messageId <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Mensagem invalida'
                    });
                }

                const isRead = req.body?.isRead === false || req.body?.is_read === 0 || req.body?.is_read === false
                    ? false
                    : true;
                await SupportInboxMessage.markRead(messageId, isRead);
                const message = await SupportInboxMessage.findById(messageId);

                return res.json({
                    success: true,
                    supportMessage: message
                });
            } catch (error) {
                console.error('[admin/dashboard/email-support-inbox:read] falha:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Falha ao atualizar status da mensagem'
                });
            }
        }
    };
}

module.exports = {
    createAdminDashboardController
};
