const crypto = require('crypto');

function createIncomingWebhookService(options = {}) {
    const IncomingWebhookCredential = options.IncomingWebhookCredential;
    const normalizeOwnerUserId = options.normalizeOwnerUserId;
    const normalizeImportedLeadPhone = options.normalizeImportedLeadPhone;
    const parsePositiveIntInRange = options.parsePositiveIntInRange;
    const parseLeadTagsForMerge = options.parseLeadTagsForMerge;
    const parseLeadCustomFields = options.parseLeadCustomFields;

    function resolveIncomingWebhookOwnerUserId() {
        const value = normalizeOwnerUserId(process.env.WEBHOOK_INCOMING_OWNER_USER_ID);
        return value || null;
    }

    function normalizeIncomingWebhookSecret(value) {
        return String(value || '').trim();
    }

    function extractIncomingWebhookSecret(req, payload = null) {
        const sourcePayload = payload && typeof payload === 'object' ? payload : {};
        const bodySecret = normalizeIncomingWebhookSecret(sourcePayload.secret);
        if (bodySecret) {
            return bodySecret;
        }

        const headerSecret = normalizeIncomingWebhookSecret(
            req.get('x-webhook-secret')
            || req.get('x-incoming-webhook-secret')
            || req.get('x-api-key')
        );
        if (headerSecret) {
            return headerSecret;
        }

        const authorization = normalizeIncomingWebhookSecret(req.get('authorization'));
        if (authorization && /^bearer\s+/i.test(authorization)) {
            return normalizeIncomingWebhookSecret(authorization.replace(/^bearer\s+/i, ''));
        }

        return '';
    }

    function timingSafeIncomingWebhookSecretEquals(inputSecret, expectedSecret) {
        const left = normalizeIncomingWebhookSecret(inputSecret);
        const right = normalizeIncomingWebhookSecret(expectedSecret);
        if (!left || !right) return false;

        const leftBuffer = Buffer.from(left, 'utf8');
        const rightBuffer = Buffer.from(right, 'utf8');
        if (leftBuffer.length !== rightBuffer.length) return false;

        try {
            return crypto.timingSafeEqual(leftBuffer, rightBuffer);
        } catch (_) {
            return false;
        }
    }

    function maskIncomingWebhookSecret(prefix = '', suffix = '') {
        const normalizedPrefix = String(prefix || '').trim();
        const normalizedSuffix = String(suffix || '').trim();
        if (!normalizedPrefix && !normalizedSuffix) return '';
        return `${normalizedPrefix}***${normalizedSuffix}`;
    }

    function serializeIncomingWebhookCredentialForApi(credential) {
        if (!credential) return null;
        return {
            id: Number(credential.id || 0) || null,
            owner_user_id: Number(credential.owner_user_id || 0) || null,
            secret_masked: maskIncomingWebhookSecret(credential.secret_prefix, credential.secret_suffix),
            secret_prefix: String(credential.secret_prefix || '').trim(),
            secret_suffix: String(credential.secret_suffix || '').trim(),
            created_by: Number(credential.created_by || 0) || null,
            last_rotated_at: credential.last_rotated_at || null,
            last_used_at: credential.last_used_at || null,
            created_at: credential.created_at || null,
            updated_at: credential.updated_at || null
        };
    }

    async function ensureLegacyIncomingWebhookCredentialBridge() {
        const legacySecret = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET);
        const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();

        if (!legacySecret || !legacyOwnerUserId) {
            return;
        }

        const existingOwnerCredential = await IncomingWebhookCredential.findByOwnerUserId(legacyOwnerUserId);
        if (existingOwnerCredential) {
            return;
        }

        try {
            await IncomingWebhookCredential.upsertForOwner(legacyOwnerUserId, {
                secret: legacySecret
            });
            console.log(`[IncomingWebhook] Credencial legada sincronizada para owner ${legacyOwnerUserId}`);
        } catch (error) {
            console.warn(`[IncomingWebhook] Nao foi possivel sincronizar credencial legada do owner ${legacyOwnerUserId}: ${error.message}`);
        }
    }

    async function resolveIncomingWebhookOwnerContext(req, payload = null) {
        const sourcePayload = payload && typeof payload === 'object' ? payload : {};
        const secret = extractIncomingWebhookSecret(req, sourcePayload);
        if (!secret) {
            return {
                ownerUserId: null,
                source: 'missing-secret'
            };
        }

        let tableLookupFailed = false;
        try {
            const credential = await IncomingWebhookCredential.findOwnerBySecret(secret);
            const ownerUserId = normalizeOwnerUserId(credential?.owner_user_id);
            if (ownerUserId) {
                return {
                    ownerUserId,
                    source: 'owner-secret',
                    credential
                };
            }
        } catch (error) {
            tableLookupFailed = true;
            console.error('[IncomingWebhook] Falha ao validar credencial por owner:', error.message);
        }

        const legacySecret = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET);
        const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();
        if (
            legacySecret
            && legacyOwnerUserId
            && timingSafeIncomingWebhookSecretEquals(secret, legacySecret)
        ) {
            return {
                ownerUserId: legacyOwnerUserId,
                source: 'legacy-secret'
            };
        }

        return {
            ownerUserId: null,
            source: tableLookupFailed ? 'lookup-error' : 'invalid-secret'
        };
    }

    function normalizeIncomingWebhookLeadPayload(rawData, ownerUserId) {
        const sourceData = rawData && typeof rawData === 'object' ? rawData : {};
        const phone = normalizeImportedLeadPhone(
            sourceData.phone
            || sourceData.telefone
            || sourceData.whatsapp
            || sourceData.celular
            || sourceData.numero
        );

        const name = String(sourceData.name || sourceData.nome || '').trim() || 'Sem nome';
        const email = String(sourceData.email || '').trim().toLowerCase();
        const status = parsePositiveIntInRange(sourceData.status, 1, 1, 4);
        const tags = Array.from(new Set(parseLeadTagsForMerge(sourceData.tags)));
        const customFields = parseLeadCustomFields(sourceData.custom_fields);

        const payload = {
            name,
            phone,
            email,
            status,
            tags,
            source: 'webhook',
            assigned_to: ownerUserId,
            owner_user_id: ownerUserId
        };

        if (Object.keys(customFields).length > 0) {
            payload.custom_fields = customFields;
        }

        return payload;
    }

    return {
        resolveIncomingWebhookOwnerUserId,
        normalizeIncomingWebhookSecret,
        serializeIncomingWebhookCredentialForApi,
        ensureLegacyIncomingWebhookCredentialBridge,
        resolveIncomingWebhookOwnerContext,
        normalizeIncomingWebhookLeadPayload
    };
}

module.exports = {
    createIncomingWebhookService
};
