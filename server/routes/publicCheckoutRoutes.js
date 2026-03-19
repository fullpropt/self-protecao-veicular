const crypto = require('crypto');
const express = require('express');

const PRE_CHECKOUT_PRIMARY_OBJECTIVE_OPTIONS = new Set([
    'organizar_leads',
    'automatizar_atendimento',
    'aumentar_vendas',
    'melhorar_whatsapp',
    'outro'
]);

function normalizePreCheckoutText(value, maxLength = 160) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, maxLength);
}

function normalizePreCheckoutEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    return normalized;
}

function normalizePreCheckoutPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.slice(0, 18);
}

function normalizePreCheckoutObjective(value) {
    const normalized = normalizePreCheckoutText(value, 80).toLowerCase();
    if (!normalized) return '';
    return PRE_CHECKOUT_PRIMARY_OBJECTIVE_OPTIONS.has(normalized)
        ? normalized
        : 'outro';
}

function normalizeCheckoutDocumentType(value) {
    const normalized = normalizePreCheckoutText(value, 10).toLowerCase();
    return normalized === 'cnpj' ? 'cnpj' : 'cpf';
}

function normalizeCheckoutDocumentNumber(value, documentType = 'cpf') {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return normalizeCheckoutDocumentType(documentType) === 'cnpj'
        ? digits.slice(0, 14)
        : digits.slice(0, 11);
}

function isValidCheckoutDocument(documentNumber, documentType = 'cpf') {
    const normalized = normalizeCheckoutDocumentNumber(documentNumber, documentType);
    if (!normalized) return false;
    if (normalizeCheckoutDocumentType(documentType) === 'cnpj') {
        return normalized.length === 14;
    }
    return normalized.length === 11;
}

function buildCustomCheckoutRouteUrl(planKey, params = null) {
    const normalizedPlanKey = normalizePreCheckoutText(planKey, 40).toLowerCase() || 'premium';
    const queryString = params instanceof URLSearchParams ? params.toString() : '';
    return `/#/checkout/${encodeURIComponent(normalizedPlanKey)}${queryString ? `?${queryString}` : ''}`;
}

function buildBillingSuccessRouteUrl(sessionId, planKey, extraParams = {}) {
    const params = new URLSearchParams();
    params.set('session_id', String(sessionId || '').trim());
    params.set('plan', normalizePreCheckoutText(planKey, 40).toLowerCase() || 'premium');
    for (const [key, value] of Object.entries(extraParams)) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) continue;
        params.set(key, normalizedValue);
    }
    return `/#/checkout/sucesso?${params.toString()}`;
}

function buildCheckoutSubscriptionIdempotencyKey({ planKey, email, leadCaptureId, documentNumber }, parsePositiveIntInRange) {
    const seed = [
        normalizePreCheckoutText(planKey, 40).toLowerCase(),
        normalizePreCheckoutEmail(email),
        String(parsePositiveIntInRange(leadCaptureId, 0, 0, 2147483647) || 0),
        normalizeCheckoutDocumentNumber(documentNumber),
        new Date().toISOString().slice(0, 10)
    ].join('|');
    return crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 64);
}

function parsePreCheckoutUtmPayload(body = {}, req = null) {
    const sourceBody = body && typeof body === 'object' ? body : {};
    const sourceUtm = sourceBody?.utm && typeof sourceBody.utm === 'object' ? sourceBody.utm : {};
    const query = req?.query && typeof req.query === 'object' ? req.query : {};

    return {
        utm_source: normalizePreCheckoutText(sourceUtm.utm_source || sourceUtm.source || sourceBody.utm_source || query.utm_source || '', 120),
        utm_medium: normalizePreCheckoutText(sourceUtm.utm_medium || sourceUtm.medium || sourceBody.utm_medium || query.utm_medium || '', 120),
        utm_campaign: normalizePreCheckoutText(sourceUtm.utm_campaign || sourceUtm.campaign || sourceBody.utm_campaign || query.utm_campaign || '', 160),
        utm_term: normalizePreCheckoutText(sourceUtm.utm_term || sourceUtm.term || sourceBody.utm_term || query.utm_term || '', 160),
        utm_content: normalizePreCheckoutText(sourceUtm.utm_content || sourceUtm.content || sourceBody.utm_content || query.utm_content || '', 160)
    };
}

function isValidEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function createPublicCheckoutRoutes(options = {}) {
    const router = express.Router();
    const PreCheckoutLead = options.PreCheckoutLead;
    const pagarmeCheckoutService = options.pagarmeCheckoutService;
    const parsePositiveIntInRange = options.parsePositiveIntInRange;
    const upsertCheckoutRegistrationFromPagarmePayload = options.upsertCheckoutRegistrationFromPagarmePayload;

    router.post('/api/pre-checkout/capture', async (req, res) => {
        try {
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const requestedPlanKey = normalizePreCheckoutText(
                body.planKey || body.plan_key || body.plan || 'premium',
                40
            ).toLowerCase() || 'premium';
            const plan = pagarmeCheckoutService.getPlanConfig(requestedPlanKey);
            if (!plan) {
                return res.status(400).json({ success: false, error: 'Plano invalido para pre-checkout' });
            }

            const fullName = normalizePreCheckoutText(body.fullName || body.full_name || body.name, 120);
            const email = normalizePreCheckoutEmail(body.email);
            const whatsapp = normalizePreCheckoutPhone(body.whatsapp || body.phone);
            const companyName = normalizePreCheckoutText(body.companyName || body.company_name, 120);
            const primaryObjective = normalizePreCheckoutObjective(
                body.primaryObjective || body.primary_objective || body.objective
            );

            if (!fullName) {
                return res.status(400).json({ success: false, error: 'Nome completo e obrigatorio' });
            }
            if (!isValidEmailAddress(email)) {
                return res.status(400).json({ success: false, error: 'E-mail invalido' });
            }
            if (whatsapp.length < 10) {
                return res.status(400).json({ success: false, error: 'WhatsApp invalido' });
            }
            const utmPayload = parsePreCheckoutUtmPayload(body, req);
            const sourceUrl = normalizePreCheckoutText(
                body.sourceUrl || body.source_url || req.get('referer') || '',
                500
            );
            const preCheckoutLead = await PreCheckoutLead.create({
                full_name: fullName,
                email,
                whatsapp,
                company_name: companyName,
                primary_objective: primaryObjective,
                plan_key: plan.code,
                source_url: sourceUrl || null,
                ...utmPayload,
                metadata: {
                    source: 'pre_checkout_page',
                    captured_from_path: normalizePreCheckoutText(body.path || body.captured_from_path || '', 200) || null,
                    referrer: normalizePreCheckoutText(req.get('referer') || '', 300) || null,
                    user_agent: normalizePreCheckoutText(req.get('user-agent') || '', 300) || null
                }
            });

            const redirectParams = new URLSearchParams();
            redirectParams.set('lead_capture_id', String(preCheckoutLead.id));
            redirectParams.set('prefill_name', fullName);
            redirectParams.set('prefill_email', email);
            redirectParams.set('prefill_whatsapp', whatsapp);
            if (companyName) {
                redirectParams.set('prefill_company_name', companyName);
            }
            if (primaryObjective) redirectParams.set('prefill_objective', primaryObjective);
            const redirectUrl = `/billing/checkout/${encodeURIComponent(plan.code)}?${redirectParams.toString()}`;

            return res.status(201).json({
                success: true,
                plan: plan.code,
                lead_capture_id: preCheckoutLead.id,
                redirect_url: redirectUrl
            });
        } catch (error) {
            console.error('[pre-checkout] Falha ao capturar lead:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Nao foi possivel registrar o pre-checkout agora'
            });
        }
    });

    router.get('/billing/checkout/:planKey', async (req, res) => {
        try {
            const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
            if (!plan) {
                return res.status(404).send('Plano de checkout nao encontrado');
            }

            const prefillName = normalizePreCheckoutText(req.query?.prefill_name || req.query?.name, 120);
            const prefillEmail = normalizePreCheckoutEmail(req.query?.prefill_email || req.query?.email);
            const prefillWhatsApp = normalizePreCheckoutPhone(req.query?.prefill_whatsapp || req.query?.whatsapp || req.query?.phone);
            const prefillCompanyName = normalizePreCheckoutText(req.query?.prefill_company_name || req.query?.company_name, 120);
            const prefillObjective = normalizePreCheckoutObjective(req.query?.prefill_objective || req.query?.objective);
            const leadCaptureId = parsePositiveIntInRange(
                req.query?.lead_capture_id || req.query?.leadCaptureId,
                0,
                1,
                2147483647
            );

            const redirectParams = new URLSearchParams();
            if (leadCaptureId > 0) redirectParams.set('lead_capture_id', String(leadCaptureId));
            if (prefillName) redirectParams.set('prefill_name', prefillName);
            if (prefillEmail) redirectParams.set('prefill_email', prefillEmail);
            if (prefillWhatsApp) redirectParams.set('prefill_whatsapp', prefillWhatsApp);
            if (prefillCompanyName) redirectParams.set('prefill_company_name', prefillCompanyName);
            if (prefillObjective) redirectParams.set('prefill_objective', prefillObjective);

            return res.redirect(303, buildCustomCheckoutRouteUrl(plan.code, redirectParams));
        } catch (error) {
            console.error('[billing/checkout] Falha ao iniciar checkout:', error.message);
            return res.status(500).send('Nao foi possivel iniciar o checkout agora');
        }
    });

    router.get('/api/public/billing/checkout/:planKey/config', async (req, res) => {
        try {
            const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
            if (!plan) {
                return res.status(404).json({ success: false, error: 'Plano nao encontrado' });
            }

            const publicKey = pagarmeCheckoutService.getPagarmePublicKey();
            return res.json({
                success: true,
                plan: {
                    key: plan.key,
                    code: plan.code,
                    name: plan.name,
                    amount_cents: Number(plan.amountCents || 0),
                    trial_days: Number(plan.trialDays || 0)
                },
                pagarme: {
                    public_key_configured: Boolean(publicKey),
                    public_key: publicKey || ''
                }
            });
        } catch (error) {
            console.error('[billing/checkout/config] Falha ao carregar configuracao:', error.message);
            return res.status(500).json({ success: false, error: 'Nao foi possivel carregar o checkout agora' });
        }
    });

    router.post('/api/public/billing/checkout/:planKey/subscribe', async (req, res) => {
        try {
            const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
            if (!plan) {
                return res.status(404).json({ success: false, error: 'Plano nao encontrado' });
            }

            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const fullName = normalizePreCheckoutText(body.fullName || body.full_name || body.name, 120);
            const email = normalizePreCheckoutEmail(body.email);
            const whatsapp = normalizePreCheckoutPhone(body.whatsapp || body.phone);
            const companyName = normalizePreCheckoutText(body.companyName || body.company_name, 120);
            const primaryObjective = normalizePreCheckoutObjective(
                body.primaryObjective || body.primary_objective || body.objective
            );
            const documentType = normalizeCheckoutDocumentType(body.documentType || body.document_type);
            const documentNumber = normalizeCheckoutDocumentNumber(body.documentNumber || body.document_number || body.document, documentType);
            const cardToken = normalizePreCheckoutText(body.cardToken || body.card_token, 200);
            const cardHolderName = normalizePreCheckoutText(body.cardHolderName || body.card_holder_name, 120);
            const cardNumber = String(body.cardNumber || body.card_number || '').replace(/\D+/g, '').slice(0, 19);
            const cardExpiryMonth = String(body.cardExpMonth || body.card_exp_month || '').replace(/\D+/g, '').slice(0, 2);
            const cardExpiryYear = String(body.cardExpYear || body.card_exp_year || '').replace(/\D+/g, '').slice(-4);
            const cardCvv = String(body.cardCvv || body.card_cvv || '').replace(/\D+/g, '').slice(0, 4);
            const leadCaptureId = parsePositiveIntInRange(
                body.leadCaptureId || body.lead_capture_id,
                0,
                0,
                2147483647
            );

            if (!fullName) {
                return res.status(400).json({ success: false, error: 'Nome completo e obrigatorio' });
            }
            if (!isValidEmailAddress(email)) {
                return res.status(400).json({ success: false, error: 'E-mail invalido' });
            }
            if (whatsapp.length < 10) {
                return res.status(400).json({ success: false, error: 'WhatsApp invalido' });
            }
            if (!isValidCheckoutDocument(documentNumber, documentType)) {
                return res.status(400).json({ success: false, error: 'Documento invalido' });
            }
            if (!cardToken) {
                if (!cardHolderName || cardHolderName.length < 3) {
                    return res.status(400).json({ success: false, error: 'Nome do cartao invalido' });
                }
                if (cardNumber.length < 13) {
                    return res.status(400).json({ success: false, error: 'Numero do cartao invalido' });
                }
                const expiryMonth = Number(cardExpiryMonth);
                const expiryYear = Number(cardExpiryYear);
                if (
                    !Number.isInteger(expiryMonth)
                    || expiryMonth < 1
                    || expiryMonth > 12
                    || !Number.isInteger(expiryYear)
                    || cardExpiryYear.length !== 4
                ) {
                    return res.status(400).json({ success: false, error: 'Validade do cartao invalida' });
                }
                if (cardCvv.length < 3) {
                    return res.status(400).json({ success: false, error: 'CVV invalido' });
                }
            }

            const checkoutMetadata = {
                pre_checkout_name: fullName || '',
                pre_checkout_whatsapp: whatsapp || '',
                pre_checkout_company: companyName || '',
                pre_checkout_objective: primaryObjective || '',
                pre_checkout_lead_id: leadCaptureId > 0 ? String(leadCaptureId) : '',
                custom_checkout: '1'
            };

            const idempotencyKey = buildCheckoutSubscriptionIdempotencyKey({
                planKey: plan.key,
                email,
                leadCaptureId,
                documentNumber
            }, parsePositiveIntInRange);

            const subscription = await pagarmeCheckoutService.createPlanSubscription({
                plan,
                customer: {
                    email,
                    name: fullName,
                    phone: whatsapp,
                    companyName,
                    objective: primaryObjective,
                    documentType,
                    documentNumber,
                    ...(cardToken ? {} : {
                        card: {
                            holder_name: cardHolderName,
                            number: cardNumber,
                            exp_month: cardExpiryMonth,
                            exp_year: cardExpiryYear,
                            cvv: cardCvv
                        }
                    })
                },
                cardToken,
                metadata: checkoutMetadata,
                idempotencyKey
            });

            const subscriptionPayload = subscription?.payload || null;
            if (!subscriptionPayload?.subscriptionId) {
                throw new Error('Assinatura criada sem identificador retornado pelo Pagar.me');
            }

            const registration = await upsertCheckoutRegistrationFromPagarmePayload(req, subscriptionPayload, {
                sendEmail: true
            });

            if (leadCaptureId > 0) {
                try {
                    await PreCheckoutLead.markCheckoutStarted(leadCaptureId, {
                        stripe_checkout_session_id: registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
                        metadata: {
                            checkout_provider: 'pagarme_custom',
                            subscription_id: subscriptionPayload.subscriptionId,
                            checkout_completed_at: new Date().toISOString()
                        }
                    });
                } catch (leadUpdateError) {
                    console.warn('[billing/checkout/subscribe] Falha ao atualizar pre-checkout lead:', leadUpdateError.message);
                }
            }

            return res.status(201).json({
                success: true,
                session_id: registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
                subscription_id: subscriptionPayload.subscriptionId,
                redirect_url: buildBillingSuccessRouteUrl(
                    registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
                    plan.key,
                    {
                        status: registration?.status || ''
                    }
                )
            });
        } catch (error) {
            console.error('[billing/checkout/subscribe] Falha ao criar assinatura:', error.message);
            return res.status(Number(error?.statusCode) || 500).json({
                success: false,
                error: error.message || 'Nao foi possivel iniciar a assinatura agora'
            });
        }
    });

    return router;
}

module.exports = {
    createPublicCheckoutRoutes
};
