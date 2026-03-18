function createSettingsController(options = {}) {
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const User = options.User;
    const buildOwnerPlanStatus = options.buildOwnerPlanStatus;
    const stripeCheckoutService = options.stripeCheckoutService;
    const pagarmeCheckoutService = options.pagarmeCheckoutService;
    const CheckoutRegistration = options.CheckoutRegistration;
    const syncStripePlanStatusByIdentifiers = options.syncStripePlanStatusByIdentifiers;
    const syncPagarmePlanStatusByIdentifiers = options.syncPagarmePlanStatusByIdentifiers;
    const Settings = options.Settings;
    const buildScopedSettingsKey = options.buildScopedSettingsKey;
    const normalizeSettingsForResponse = options.normalizeSettingsForResponse;
    const getRequesterRole = options.getRequesterRole;
    const isUserAdminRole = options.isUserAdminRole;
    const queueService = options.queueService;
    const invalidateBusinessHoursSettingsCache = options.invalidateBusinessHoursSettingsCache;

    function toOwnerAdminPayload(user) {
        if (!user) {
            return null;
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email
        };
    }

    return {
        async getPlanStatus(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const ownerAdmin = await User.findById(ownerScopeUserId || req.user?.id);
                const plan = await buildOwnerPlanStatus(ownerScopeUserId);

                return res.json({
                    success: true,
                    owner_admin: toOwnerAdminPayload(ownerAdmin),
                    plan
                });
            } catch (error) {
                return res.status(500).json({ success: false, error: 'Erro ao carregar status do plano' });
            }
        },

        async refreshPlanStatus(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const nowIso = new Date().toISOString();
                const ownerAdmin = await User.findById(ownerScopeUserId || req.user?.id);
                let plan = await buildOwnerPlanStatus(ownerScopeUserId);

                if (String(plan?.provider || '').trim().toLowerCase() === 'stripe') {
                    const subscriptionId = String(plan?.external_reference || '').trim();
                    if (subscriptionId) {
                        const subscription = await stripeCheckoutService.retrieveSubscription(subscriptionId);
                        const registration = await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
                            || await CheckoutRegistration.findByStripeCustomerId(subscription?.customer);
                        const priceId = String(subscription?.items?.data?.[0]?.price?.id || '').trim();
                        const inferredPlan = stripeCheckoutService.inferPlanByPriceId(priceId);

                        await syncStripePlanStatusByIdentifiers({
                            subscriptionId,
                            customerId: String(subscription?.customer || '').trim(),
                            priceId,
                            planKey: registration?.stripe_plan_key || inferredPlan?.key || '',
                            planCode: registration?.stripe_plan_code || inferredPlan?.code || '',
                            planName: registration?.stripe_plan_name || inferredPlan?.name || '',
                            subscriptionStatus: stripeCheckoutService.normalizePlanStatus(subscription?.status),
                            renewalDate: Number(subscription?.current_period_end || 0) > 0
                                ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
                                : null
                        });
                        plan = await buildOwnerPlanStatus(ownerScopeUserId);
                    } else {
                        await Settings.set(
                            buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                            nowIso,
                            'string'
                        );
                        plan = await buildOwnerPlanStatus(ownerScopeUserId);
                    }
                } else if (String(plan?.provider || '').trim().toLowerCase() === 'pagarme') {
                    const subscriptionId = String(plan?.external_reference || '').trim();
                    if (subscriptionId) {
                        const subscription = await pagarmeCheckoutService.retrieveSubscription(subscriptionId);
                        const subscriptionPayload = await pagarmeCheckoutService.resolveSubscriptionPayload(subscription);
                        const registration = await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
                            || await CheckoutRegistration.findByStripeCustomerId(subscriptionPayload?.customerId || '');

                        await syncPagarmePlanStatusByIdentifiers({
                            subscriptionId,
                            customerId: String(subscriptionPayload?.customerId || '').trim(),
                            customerEmail: String(subscriptionPayload?.customerEmail || '').trim().toLowerCase(),
                            priceId: String(subscriptionPayload?.priceId || '').trim(),
                            planKey: subscriptionPayload?.planKey || registration?.stripe_plan_key || '',
                            planCode: subscriptionPayload?.planCode || registration?.stripe_plan_code || '',
                            planName: subscriptionPayload?.planName || registration?.stripe_plan_name || '',
                            subscriptionStatus: subscriptionPayload?.subscriptionStatus || 'active',
                            renewalDate: subscriptionPayload?.renewalDate || null,
                            metadata: {
                                ...(subscriptionPayload?.metadata && typeof subscriptionPayload.metadata === 'object'
                                    ? subscriptionPayload.metadata
                                    : {}),
                                provider: 'pagarme'
                            }
                        });
                        plan = await buildOwnerPlanStatus(ownerScopeUserId);
                    } else {
                        await Settings.set(
                            buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                            nowIso,
                            'string'
                        );
                        plan = await buildOwnerPlanStatus(ownerScopeUserId);
                    }
                } else {
                    await Settings.set(
                        buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                        nowIso,
                        'string'
                    );
                    plan = await buildOwnerPlanStatus(ownerScopeUserId);
                }

                return res.json({
                    success: true,
                    owner_admin: toOwnerAdminPayload(ownerAdmin),
                    plan
                });
            } catch (error) {
                return res.status(500).json({ success: false, error: 'Erro ao atualizar status do plano' });
            }
        },

        async getSettings(req, res) {
            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const settings = normalizeSettingsForResponse(await Settings.getAll(), ownerScopeUserId);

            return res.json({ success: true, settings });
        },

        async updateSettings(req, res) {
            const requesterRole = getRequesterRole(req);
            if (!isUserAdminRole(requesterRole)) {
                return res.status(403).json({
                    success: false,
                    error: 'Sem permissao para atualizar configuracoes da conta'
                });
            }

            const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            const incomingSettings = req.body && typeof req.body === 'object' ? req.body : {};
            const changedKeys = Object.keys(incomingSettings);

            for (const [key, value] of Object.entries(incomingSettings)) {
                const type = typeof value === 'number' ? 'number'
                    : typeof value === 'boolean' ? 'boolean'
                        : typeof value === 'object' ? 'json' : 'string';

                await Settings.set(buildScopedSettingsKey(key, ownerScopeUserId), value, type);
            }

            const hasQueueSettings =
                Object.prototype.hasOwnProperty.call(incomingSettings, 'bulk_message_delay')
                || Object.prototype.hasOwnProperty.call(incomingSettings, 'max_messages_per_minute');

            if (hasQueueSettings && !ownerScopeUserId) {
                await queueService.updateSettings({
                    delay: incomingSettings.bulk_message_delay,
                    maxPerMinute: incomingSettings.max_messages_per_minute
                });
            }

            const touchedBusinessHours = changedKeys.some((key) => String(key || '').startsWith('business_hours_'));
            if (touchedBusinessHours) {
                invalidateBusinessHoursSettingsCache(ownerScopeUserId || null);
                if (typeof queueService.invalidateBusinessHoursCache === 'function') {
                    queueService.invalidateBusinessHoursCache(ownerScopeUserId || null);
                }
            }

            return res.json({
                success: true,
                settings: normalizeSettingsForResponse(await Settings.getAll(), ownerScopeUserId)
            });
        }
    };
}

module.exports = {
    createSettingsController
};
