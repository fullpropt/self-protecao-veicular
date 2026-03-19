const express = require('express');

function createAuthRoutes(options = {}) {
    const router = express.Router();
    const sanitizeInput = options.sanitizeInput;
    const validateLogin = options.validateLogin;
    const authenticate = options.authenticate;
    const User = options.User;
    const Settings = options.Settings;
    const CheckoutRegistration = options.CheckoutRegistration;
    const pagarmeCheckoutService = options.pagarmeCheckoutService;
    const stripeCheckoutService = options.stripeCheckoutService;
    const upsertCheckoutRegistrationFromPagarmePayload = options.upsertCheckoutRegistrationFromPagarmePayload;
    const upsertCheckoutRegistrationFromStripePayload = options.upsertCheckoutRegistrationFromStripePayload;
    const normalizeCheckoutRegistrationStatusValue = options.normalizeCheckoutRegistrationStatusValue;
    const resendCheckoutRegistrationConfirmation = options.resendCheckoutRegistrationConfirmation;
    const MailMktIntegrationError = options.MailMktIntegrationError;
    const isEmailConfirmed = options.isEmailConfirmed;
    const createEmailConfirmationTokenPayload = options.createEmailConfirmationTokenPayload;
    const normalizeOwnerUserId = options.normalizeOwnerUserId;
    const buildScopedSettingsKey = options.buildScopedSettingsKey;
    const getRegistrationEmailRuntimeConfig = options.getRegistrationEmailRuntimeConfig;
    const sendRegistrationConfirmationEmail = options.sendRegistrationConfirmationEmail;
    const hashEmailConfirmationToken = options.hashEmailConfirmationToken;
    const tokenFingerprint = options.tokenFingerprint;
    const resolveCheckoutRegistrationPlanStatus = options.resolveCheckoutRegistrationPlanStatus;
    const isCheckoutRegistrationExpired = options.isCheckoutRegistrationExpired;
    const isEmailConfirmationExpired = options.isEmailConfirmationExpired;
    const getCheckoutRegistrationProvider = options.getCheckoutRegistrationProvider;
    const applyPagarmePlanSettingsToOwner = options.applyPagarmePlanSettingsToOwner;
    const applyStripePlanSettingsToOwner = options.applyStripePlanSettingsToOwner;
    const markUserPresenceOnline = options.markUserPresenceOnline;
    const normalizePresenceUserId = options.normalizePresenceUserId;
    const USER_PRESENCE_TTL_MS = options.USER_PRESENCE_TTL_MS;
    const markUserPresenceOffline = options.markUserPresenceOffline;
    const isApplicationAdminUser = options.isApplicationAdminUser;
    const verifyPassword = options.verifyPassword;
    const generateToken = options.generateToken;
    const generateRefreshToken = options.generateRefreshToken;
    const hashPassword = options.hashPassword;
    const verifyToken = options.verifyToken;

    router.post('/api/auth/login', sanitizeInput, validateLogin, async (req, res) => {

    try {

        const { email, password } = req.validatedData || req.body;

        const normalizedEmail = String(email || '').trim().toLowerCase();

        let user = await User.findByEmail(normalizedEmail);

        if (!user || !verifyPassword(password, user.password_hash)) {

            return res.status(401).json({ error: 'Credenciais inválidas' });

        }

        

        if (!user.is_active) {

            return res.status(401).json({ error: 'Usuário desativado' });

        }

        if (!isEmailConfirmed(user)) {

            return res.status(403).json({
                error: 'Confirme seu email antes de entrar',
                code: 'EMAIL_NOT_CONFIRMED'
            });

        }

        // Recupera ambientes legados: se nao houver admin ativo, promove
        // automaticamente o usuario autenticado para admin.
        const allUsers = await User.listAll();
        const hasActiveAdmin = (allUsers || []).some((item) =>
            Number(item?.is_active) > 0
            && String(item?.role || '').trim().toLowerCase() === 'admin'
        );
        if (!hasActiveAdmin && String(user.role || '').trim().toLowerCase() !== 'admin') {
            await User.update(user.id, { role: 'admin', is_active: 1 });
            const refreshed = await User.findByIdWithPassword(user.id);
            if (refreshed) {
                user = refreshed;
            }
        }

        const ownerUserId = Number(user?.owner_user_id || 0);
        const hasOwnerAssigned = Number.isInteger(ownerUserId) && ownerUserId > 0;
        if (!hasOwnerAssigned) {
            await User.update(user.id, { owner_user_id: user.id, role: 'admin', is_active: 1 });
            const refreshed = await User.findByIdWithPassword(user.id);
            if (refreshed) {
                user = refreshed;
            } else {
                user.owner_user_id = user.id;
                user.role = 'admin';
            }
        }

        

        await User.updateLastLogin(user.id);
        markUserPresenceOnline(user.id);

        

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        const isApplicationAdmin = isApplicationAdminUser(user);

        

        res.json({

            success: true,

            token,

            refreshToken,

            user: {

                id: user.id,

                uuid: user.uuid,

                name: user.name,

                email: user.email,

                role: user.role,
                owner_user_id: user.owner_user_id,
                is_application_admin: isApplicationAdmin

            }

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

    });



router.post('/api/auth/register', async (req, res) => {

    try {

        const { name, companyName, email, password } = req.body;



        if (!name || !companyName || !email || !password) {

            return res.status(400).json({ error: 'Nome, nome da empresa, email e senha sao obrigatorios' });

        }



        if (String(password).length < 6) {

            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

        }



        const normalizedName = String(name || '').trim();
        const normalizedCompanyName = String(companyName || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const existing = await User.findActiveByEmail(normalizedEmail);
        const registrationPasswordHash = hashPassword(String(password));
        const confirmationTokenPayload = createEmailConfirmationTokenPayload();

        let user = null;
        let createdNewUser = false;
        let resentForPendingUser = false;

        if (existing && isEmailConfirmed(existing)) {

            return res.status(409).json({ error: 'Email ja cadastrado' });

        }

        if (existing && !isEmailConfirmed(existing)) {
            resentForPendingUser = true;

            await User.update(existing.id, {
                name: normalizedName,
                email: normalizedEmail,
                email_confirmed: 0,
                email_confirmed_at: null,
                email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
                email_confirmation_expires_at: confirmationTokenPayload.expiresAt
            });
            await User.updatePassword(existing.id, registrationPasswordHash);

            const existingOwnerUserId = Number(existing?.owner_user_id || 0);
            if (!Number.isInteger(existingOwnerUserId) || existingOwnerUserId <= 0) {
                await User.update(existing.id, { owner_user_id: existing.id });
            }

            user = await User.findByIdWithPassword(existing.id);
        } else {
            createdNewUser = true;

            const created = await User.create({

                name: normalizedName,

                email: normalizedEmail,

                password_hash: registrationPasswordHash,
                email_confirmed: 0,
                email_confirmed_at: null,
                email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
                email_confirmation_expires_at: confirmationTokenPayload.expiresAt,

                role: 'admin'

            });



            if (Number(created?.id) > 0) {
                await User.update(Number(created.id), { owner_user_id: Number(created.id) });
            }

            user = await User.findByIdWithPassword(Number(created?.id || 0));
        }

        if (!user) {

            return res.status(500).json({ error: 'Falha ao preparar cadastro do usuario' });

        }

        const ownerUserId = normalizeOwnerUserId(user?.owner_user_id) || Number(user?.id || 0);
        if (ownerUserId > 0) {
            await Settings.set(
                buildScopedSettingsKey('company_name', ownerUserId),
                normalizedCompanyName || normalizedName || 'ZapVender',
                'string'
            );
        }

        try {
            const emailSettings = await getRegistrationEmailRuntimeConfig();
            await sendRegistrationConfirmationEmail(req, user, confirmationTokenPayload, {
                emailSettings
            });
        } catch (error) {
            if (error instanceof MailMktIntegrationError) {
                return res.status(error.statusCode || 502).json({
                    error: createdNewUser
                        ? 'Conta criada, mas nao foi possivel enviar o email de confirmacao agora'
                        : 'Nao foi possivel reenviar o email de confirmacao agora',
                    code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                    retryable: error.retryable !== false,
                    requiresEmailConfirmation: true,
                    accountCreated: createdNewUser
                });
            }
            throw error;
        }

        return res.status(createdNewUser ? 201 : 200).json({
            success: true,
            requiresEmailConfirmation: true,
            message: resentForPendingUser
                ? 'Sua conta ainda nao foi confirmada. Enviamos um novo link de confirmacao para o seu email.'
                : 'Conta criada com sucesso. Verifique seu email para confirmar o cadastro antes de entrar.',
            email: user.email,
            expiresInText: confirmationTokenPayload.expiresInText
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

    });



router.post('/api/auth/resend-confirmation', async (req, res) => {

    try {

        const email = String(req.body?.email || '').trim().toLowerCase();
        const sessionId = String(req.body?.sessionId || req.body?.session_id || '').trim();

        if (!email && !sessionId) {
            return res.status(400).json({
                error: 'Email ou sessionId e obrigatorio',
                code: 'EMAIL_REQUIRED'
            });
        }

        const user = email ? await User.findActiveByEmail(email) : null;
        let checkoutRegistration = sessionId
            ? await CheckoutRegistration.findBySessionId(sessionId)
            : null;

        if (!checkoutRegistration && sessionId) {
            try {
                const checkoutPayload = await pagarmeCheckoutService.resolveCheckoutSessionPayload(sessionId);
                checkoutRegistration = await upsertCheckoutRegistrationFromPagarmePayload(req, checkoutPayload, {
                    sendEmail: false
                });
            } catch (error) {
                console.warn('[auth/resend-confirmation] Nao foi possivel hidratar checkout Pagar.me por sessionId', JSON.stringify({
                    sessionId,
                    message: String(error?.message || 'erro_desconhecido')
                }));
            }
        }

        if (!checkoutRegistration && sessionId) {
            try {
                const checkoutPayload = await stripeCheckoutService.resolveCheckoutSessionPayload(sessionId);
                checkoutRegistration = await upsertCheckoutRegistrationFromStripePayload(req, checkoutPayload, {
                    sendEmail: false
                });
            } catch (error) {
                console.warn('[auth/resend-confirmation] Nao foi possivel hidratar checkout Stripe por sessionId', JSON.stringify({
                    sessionId,
                    message: String(error?.message || 'erro_desconhecido')
                }));
            }
        }

        if (!checkoutRegistration && email) {
            checkoutRegistration = await CheckoutRegistration.findLatestByEmail(email, { onlyIncomplete: true });
        }

        if (checkoutRegistration) {
            const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
            if (
                Number(checkoutRegistration?.linked_user_id) > 0
                || checkoutRegistration?.completed_at
                || registrationStatus === 'linked_existing_account'
            ) {
                return res.json({
                    success: true,
                    requiresEmailConfirmation: false,
                    sent: false,
                    alreadyConfirmed: true,
                    message: 'Este checkout ja foi vinculado a uma conta. Entre normalmente no ZapVender.'
                });
            }

            if (Number(checkoutRegistration?.email_confirmed) > 0) {
                return res.json({
                    success: true,
                    requiresEmailConfirmation: false,
                    sent: false,
                    alreadyConfirmed: true,
                    message: 'Este email ja foi confirmado. Use o link recebido para concluir o cadastro.'
                });
            }

            try {
                const resendResult = await resendCheckoutRegistrationConfirmation(req, checkoutRegistration);
                const updatedRegistration = resendResult?.registration || checkoutRegistration;
                return res.json({
                    success: true,
                    requiresEmailConfirmation: true,
                    sent: true,
                    message: 'Enviamos um novo link de confirmacao para o email informado no checkout.',
                    email: updatedRegistration.email,
                    expiresInText: resendResult?.expiresInText || (process.env.EMAIL_CONFIRMATION_EXPIRES_TEXT || '24 horas')
                });
            } catch (error) {
                if (error instanceof MailMktIntegrationError) {
                    return res.status(error.statusCode || 502).json({
                        error: 'Nao foi possivel reenviar o email de confirmacao agora',
                        code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                        retryable: error.retryable !== false,
                        requiresEmailConfirmation: true,
                        sent: false
                    });
                }
                throw error;
            }
        }

        if (!user) {
            return res.json({
                success: true,
                requiresEmailConfirmation: true,
                sent: false,
                message: 'Se existir uma conta pendente para este email, um novo link de confirmacao sera enviado.'
            });
        }

        if (isEmailConfirmed(user)) {
            return res.json({
                success: true,
                requiresEmailConfirmation: false,
                sent: false,
                alreadyConfirmed: true,
                message: 'Este email ja esta confirmado. Voce pode entrar normalmente.'
            });
        }

        const confirmationTokenPayload = createEmailConfirmationTokenPayload();
        await User.update(user.id, {
            email_confirmed: 0,
            email_confirmed_at: null,
            email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
            email_confirmation_expires_at: confirmationTokenPayload.expiresAt
        });

        const refreshedUser = await User.findByIdWithPassword(user.id);
        const targetUser = refreshedUser || user;

        try {
            const emailSettings = await getRegistrationEmailRuntimeConfig();
            await sendRegistrationConfirmationEmail(req, targetUser, confirmationTokenPayload, {
                emailSettings
            });
        } catch (error) {
            if (error instanceof MailMktIntegrationError) {
                return res.status(error.statusCode || 502).json({
                    error: 'Nao foi possivel reenviar o email de confirmacao agora',
                    code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                    retryable: error.retryable !== false,
                    requiresEmailConfirmation: true,
                    sent: false
                });
            }
            throw error;
        }

        return res.json({
            success: true,
            requiresEmailConfirmation: true,
            sent: true,
            message: 'Enviamos um novo link de confirmacao para o seu email.',
            email: targetUser.email,
            expiresInText: confirmationTokenPayload.expiresInText
        });

    } catch (error) {

        return res.status(500).json({ error: error.message });

    }

    });



router.get('/api/auth/confirm-email', async (req, res) => {

    try {

        const rawToken = String(req.query?.token || '').trim();

        if (!rawToken) {
            return res.status(400).json({
                error: 'Token de confirmacao e obrigatorio',
                code: 'EMAIL_CONFIRMATION_TOKEN_REQUIRED'
            });
        }

        const confirmationTokenHash = hashEmailConfirmationToken(rawToken);
        const confirmationTokenFingerprint = tokenFingerprint(rawToken);
        const checkoutRegistration = await CheckoutRegistration.findByEmailConfirmationTokenHash(confirmationTokenHash);

        if (checkoutRegistration) {
            const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
            const registrationPlanStatus = resolveCheckoutRegistrationPlanStatus(checkoutRegistration, 'active');

            if (
                Number(checkoutRegistration?.linked_user_id) > 0
                || checkoutRegistration?.completed_at
                || registrationStatus === 'linked_existing_account'
            ) {
                return res.json({
                    success: true,
                    flow: 'login',
                    message: 'Email confirmado e cadastro ja concluido. Voce pode entrar no ZapVender.',
                    registration: {
                        email: checkoutRegistration.email,
                        plan: {
                            code: checkoutRegistration.stripe_plan_code || checkoutRegistration.stripe_plan_key || '',
                            name: checkoutRegistration.stripe_plan_name || 'Plano',
                            status: registrationPlanStatus
                        }
                    }
                });
            }

            if (!Number(checkoutRegistration?.email_confirmed) && isCheckoutRegistrationExpired(checkoutRegistration)) {
                await CheckoutRegistration.update(checkoutRegistration.id, {
                    status: 'expired',
                    email_confirmation_token_hash: null,
                    email_confirmation_expires_at: null
                });
                console.warn('[auth/confirm-email] Token expirado para checkout', JSON.stringify({
                    checkoutRegistrationId: Number(checkoutRegistration?.id || 0) || null,
                    tokenFingerprint: confirmationTokenFingerprint
                }));
                return res.status(400).json({
                    error: 'Link de confirmacao expirado. Solicite o reenvio para concluir seu cadastro.',
                    code: 'EMAIL_CONFIRMATION_EXPIRED'
                });
            }

            const confirmedRegistration = Number(checkoutRegistration?.email_confirmed) > 0
                ? checkoutRegistration
                : await CheckoutRegistration.markEmailConfirmed(checkoutRegistration.id);

            console.log('[auth/confirm-email] Email confirmado para checkout', JSON.stringify({
                checkoutRegistrationId: Number(confirmedRegistration?.id || 0) || null,
                email: confirmedRegistration?.email || null,
                sessionId: confirmedRegistration?.stripe_checkout_session_id || null
            }));

            return res.json({
                success: true,
                flow: 'complete_registration',
                message: 'Email confirmado com sucesso. Agora finalize seu cadastro.',
                registration: {
                    email: confirmedRegistration.email,
                    plan: {
                        code: confirmedRegistration.stripe_plan_code || confirmedRegistration.stripe_plan_key || '',
                        name: confirmedRegistration.stripe_plan_name || 'Plano',
                        status: resolveCheckoutRegistrationPlanStatus(confirmedRegistration, 'active')
                    }
                }
            });
        }

        const user = await User.findByEmailConfirmationTokenHash(confirmationTokenHash);

        if (!user) {
            console.warn('[auth/confirm-email] Token invalido', JSON.stringify({
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        if (isEmailConfirmed(user)) {
            await User.update(user.id, {
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            console.warn('[auth/confirm-email] Token reutilizado para email ja confirmado', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        if (isEmailConfirmationExpired(user)) {
            await User.update(user.id, {
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            console.warn('[auth/confirm-email] Token expirado', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao expirado. Faca um novo cadastro para reenviar o email.',
                code: 'EMAIL_CONFIRMATION_EXPIRED'
            });
        }

        const confirmedUser = await User.consumeEmailConfirmationToken(confirmationTokenHash);

        if (!confirmedUser) {
            console.warn('[auth/confirm-email] Token invalido apos validacao (concorrencia/reuso)', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        console.log('[auth/confirm-email] Email confirmado com sucesso', JSON.stringify({
            userId: Number(confirmedUser?.id || 0) || null,
            email: confirmedUser?.email || null
        }));

        return res.json({
            success: true,
            flow: 'login',
            message: 'Email confirmado com sucesso. Voce ja pode entrar no ZapVender.',
            user: {
                id: confirmedUser.id,
                email: confirmedUser.email,
                name: confirmedUser.name
            }
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

    });



router.post('/api/auth/complete-registration', async (req, res) => {

    try {

        const rawToken = String(req.body?.token || '').trim();
        const name = String(req.body?.name || '').trim();
        const companyName = String(req.body?.companyName || req.body?.company_name || '').trim();
        const password = String(req.body?.password || '');

        if (!rawToken) {
            return res.status(400).json({
                error: 'Token de confirmacao e obrigatorio',
                code: 'EMAIL_CONFIRMATION_TOKEN_REQUIRED'
            });
        }

        if (!name || !companyName || !password) {
            return res.status(400).json({
                error: 'Nome, nome da empresa e senha sao obrigatorios',
                code: 'COMPLETE_REGISTRATION_REQUIRED_FIELDS'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Senha deve ter pelo menos 6 caracteres',
                code: 'PASSWORD_TOO_SHORT'
            });
        }

        const confirmationTokenHash = hashEmailConfirmationToken(rawToken);
        let checkoutRegistration = await CheckoutRegistration.findByEmailConfirmationTokenHash(confirmationTokenHash);
        if (!checkoutRegistration) {
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
        if (
            Number(checkoutRegistration?.linked_user_id) > 0
            || checkoutRegistration?.completed_at
            || registrationStatus === 'linked_existing_account'
        ) {
            return res.status(409).json({
                error: 'Este cadastro ja foi concluido. Entre normalmente no ZapVender.',
                code: 'REGISTRATION_ALREADY_COMPLETED'
            });
        }

        if (!Number(checkoutRegistration?.email_confirmed) && isCheckoutRegistrationExpired(checkoutRegistration)) {
            await CheckoutRegistration.update(checkoutRegistration.id, {
                status: 'expired',
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            return res.status(400).json({
                error: 'Link de confirmacao expirado. Solicite o reenvio para concluir seu cadastro.',
                code: 'EMAIL_CONFIRMATION_EXPIRED'
            });
        }

        if (!Number(checkoutRegistration?.email_confirmed)) {
            checkoutRegistration = await CheckoutRegistration.markEmailConfirmed(checkoutRegistration.id);
        }

        const passwordHash = hashPassword(password);
        const normalizedEmail = String(checkoutRegistration.email || '').trim().toLowerCase();
        const normalizedName = String(name || '').trim();
        const normalizedCompanyName = String(companyName || '').trim();
        const existingUser = await User.findActiveByEmail(normalizedEmail);
        const nowIso = new Date().toISOString();

        let user = null;
        if (existingUser && isEmailConfirmed(existingUser)) {
            return res.status(409).json({
                error: 'Email ja cadastrado',
                code: 'EMAIL_ALREADY_REGISTERED'
            });
        }

        if (existingUser && !isEmailConfirmed(existingUser)) {
            await User.update(existingUser.id, {
                name: normalizedName,
                email: normalizedEmail,
                role: 'admin',
                is_active: 1,
                email_confirmed: 1,
                email_confirmed_at: nowIso,
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            await User.updatePassword(existingUser.id, passwordHash);

            const existingOwnerUserId = normalizeOwnerUserId(existingUser?.owner_user_id) || Number(existingUser.id || 0);
            if (existingOwnerUserId > 0 && Number(existingUser?.owner_user_id || 0) !== existingOwnerUserId) {
                await User.update(existingUser.id, { owner_user_id: existingOwnerUserId });
            }

            user = await User.findByIdWithPassword(existingUser.id);
        } else {
            const created = await User.create({
                name: normalizedName,
                email: normalizedEmail,
                password_hash: passwordHash,
                email_confirmed: 1,
                email_confirmed_at: nowIso,
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null,
                role: 'admin'
            });

            if (Number(created?.id || 0) > 0) {
                await User.update(Number(created.id), { owner_user_id: Number(created.id) });
            }
            user = await User.findByIdWithPassword(Number(created?.id || 0));
        }

        if (!user) {
            return res.status(500).json({
                error: 'Falha ao concluir cadastro do usuario'
            });
        }

        const ownerUserId = normalizeOwnerUserId(user?.owner_user_id) || Number(user?.id || 0) || null;
        if (ownerUserId) {
            await Settings.set(
                buildScopedSettingsKey('company_name', ownerUserId),
                normalizedCompanyName || normalizedName || 'ZapVender',
                'string'
            );

            const applyPlanSettings = getCheckoutRegistrationProvider(checkoutRegistration) === 'pagarme'
                ? applyPagarmePlanSettingsToOwner
                : applyStripePlanSettingsToOwner;
            await applyPlanSettings(ownerUserId, {
                name: checkoutRegistration.stripe_plan_name || 'Plano',
                code: checkoutRegistration.stripe_plan_code || checkoutRegistration.stripe_plan_key || '',
                status: resolveCheckoutRegistrationPlanStatus(checkoutRegistration, 'active'),
                renewalDate: checkoutRegistration?.metadata?.renewalDate || null,
                externalReference: checkoutRegistration.stripe_subscription_id || checkoutRegistration.stripe_checkout_session_id || '',
                subscriptionId: checkoutRegistration.stripe_subscription_id || '',
                checkoutSessionId: checkoutRegistration.stripe_checkout_session_id || ''
            });
        }

        await CheckoutRegistration.update(checkoutRegistration.id, {
            status: 'completed',
            email_confirmed: 1,
            email_confirmed_at: checkoutRegistration.email_confirmed_at || nowIso,
            email_confirmation_token_hash: null,
            email_confirmation_expires_at: null,
            linked_user_id: user.id,
            owner_user_id: ownerUserId,
            completed_at: nowIso,
            metadata: {
                ...(checkoutRegistration?.metadata && typeof checkoutRegistration.metadata === 'object' ? checkoutRegistration.metadata : {}),
                companyName: normalizedCompanyName,
                completedAt: nowIso
            }
        });

        return res.json({
            success: true,
            message: 'Cadastro concluido com sucesso. Agora voce ja pode entrar no ZapVender.',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {

        return res.status(500).json({ error: error.message });

    }

    });



router.post('/api/auth/refresh', async (req, res) => {

    try {

        const { refreshToken } = req.body;

        if (!refreshToken) {

            return res.status(400).json({ error: 'Refresh token Ã© obrigatÃ³rio' });

        }

        

        const decoded = verifyToken(refreshToken);

        if (!decoded || decoded.type !== 'refresh') {

            return res.status(401).json({ error: 'Refresh token invÃ¡lido' });

        }

        

        const user = await User.findById(decoded.id);

        if (!user || !user.is_active) {

            return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });

        }
        markUserPresenceOnline(user.id);

        

        const token = generateToken(user);

        

        res.json({ success: true, token });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

    });



router.post('/api/auth/presence', authenticate, async (req, res) => {

    try {
        const userId = normalizePresenceUserId(req.user?.id);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        }

        markUserPresenceOnline(userId);
        res.json({ success: true, is_online: true, ttl_ms: USER_PRESENCE_TTL_MS });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar presenca do usuario' });
    }
    });

router.post('/api/auth/logout', authenticate, async (req, res) => {

    try {
        const userId = normalizePresenceUserId(req.user?.id);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        }

        markUserPresenceOffline(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao finalizar sessao do usuario' });
    }
    });


    router.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
        const userId = Number(req.user?.id || 0);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
        }

        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' });
        }

        const user = await User.findByIdWithPassword(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        if (!verifyPassword(currentPassword, user.password_hash)) {
            return res.status(400).json({ success: false, error: 'Senha atual invÃ¡lida' });
        }

        await User.updatePassword(userId, hashPassword(newPassword));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao alterar senha' });
    }
    });


    return router;
}

module.exports = {
    createAuthRoutes
};
