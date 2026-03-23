const crypto = require('crypto');

const INCOMING_WEBHOOK_SECRET_MIN_LENGTH = 16;
const INCOMING_WEBHOOK_SECRET_PREFIX_LENGTH = 6;
const INCOMING_WEBHOOK_SECRET_SUFFIX_LENGTH = 4;

function normalizeIncomingWebhookSecret(value) {
    return String(value || '').trim();
}

function hashIncomingWebhookSecret(secret) {
    const normalized = normalizeIncomingWebhookSecret(secret);
    if (!normalized) return '';
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function generateIncomingWebhookSecret() {
    return `zv_in_${crypto.randomBytes(24).toString('base64url')}`;
}

function buildIncomingWebhookSecretPreview(secret) {
    const normalized = normalizeIncomingWebhookSecret(secret);
    const prefix = normalized.slice(0, INCOMING_WEBHOOK_SECRET_PREFIX_LENGTH);
    const suffix = normalized.slice(-INCOMING_WEBHOOK_SECRET_SUFFIX_LENGTH);
    return {
        prefix,
        suffix
    };
}

module.exports = {
    INCOMING_WEBHOOK_SECRET_MIN_LENGTH,
    normalizeIncomingWebhookSecret,
    hashIncomingWebhookSecret,
    generateIncomingWebhookSecret,
    buildIncomingWebhookSecretPreview
};
