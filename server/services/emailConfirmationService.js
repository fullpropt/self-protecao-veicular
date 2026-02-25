const crypto = require('crypto');

const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRES_IN_TEXT = '24 horas';
const DEFAULT_APP_NAME = 'ZapVender';
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

class MailMktIntegrationError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'MailMktIntegrationError';
        this.statusCode = Number(options.statusCode) || 502;
        this.upstreamStatus = Number(options.upstreamStatus) || null;
        this.retryable = options.retryable !== false;
    }
}

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function resolveAppUrl(req) {
    const configuredAppUrl = trimTrailingSlash(process.env.APP_URL || process.env.FRONTEND_URL || '');
    if (configuredAppUrl) return configuredAppUrl;

    const host = String(req?.get?.('host') || '').trim();
    if (!host) {
        return '';
    }

    const protocol = String(req?.protocol || 'https').trim() || 'https';
    return trimTrailingSlash(`${protocol}://${host}`);
}

function resolveMailMktEndpointUrl() {
    const baseUrl = trimTrailingSlash(process.env.MAILMKT_URL || '');
    if (!baseUrl) return '';
    return `${baseUrl}/api/integrations/zapvender/send-email-confirmation`;
}

function hashEmailConfirmationToken(token) {
    return crypto
        .createHash('sha256')
        .update(String(token || ''), 'utf8')
        .digest('hex');
}

function buildEmailConfirmationToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createEmailConfirmationTokenPayload(now = Date.now()) {
    const token = buildEmailConfirmationToken();
    const tokenHash = hashEmailConfirmationToken(token);
    const expiresAt = new Date(now + EMAIL_CONFIRMATION_TTL_MS).toISOString();
    return {
        token,
        tokenHash,
        expiresAt,
        expiresInText: process.env.EMAIL_CONFIRMATION_EXPIRES_TEXT || DEFAULT_EXPIRES_IN_TEXT
    };
}

function buildEmailConfirmationUrl(appUrl, token) {
    const normalizedAppUrl = trimTrailingSlash(appUrl);
    if (!normalizedAppUrl) {
        throw new MailMktIntegrationError(
            'APP_URL nao configurada para montar link de confirmacao de email',
            { statusCode: 500, retryable: false }
        );
    }
    return `${normalizedAppUrl}/confirm-email?token=${encodeURIComponent(String(token || ''))}`;
}

function tokenFingerprint(token) {
    const hash = hashEmailConfirmationToken(token);
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function normalizePersonName(name, email) {
    const cleanedName = String(name || '').trim();
    if (cleanedName) return cleanedName;
    return String(email || '').split('@')[0] || 'Cliente';
}

async function sendEmailConfirmationViaMailMkt(payload) {
    const endpointUrl = resolveMailMktEndpointUrl();
    const apiKey = String(process.env.MAILMKT_INTEGRATION_API_KEY || '').trim();
    const timeoutMs = Number(process.env.MAILMKT_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS);

    if (!endpointUrl) {
        throw new MailMktIntegrationError('MAILMKT_URL nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    if (!apiKey) {
        throw new MailMktIntegrationError('MAILMKT_INTEGRATION_API_KEY nao configurada', {
            statusCode: 500,
            retryable: false
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS));

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const upstreamPreview = String(responseText || '').slice(0, 300);
            const integrationError = new MailMktIntegrationError(
                `MailMKT respondeu HTTP ${response.status}`,
                {
                    statusCode: response.status >= 500 ? 503 : 502,
                    upstreamStatus: response.status,
                    retryable: response.status >= 500 || response.status === 429
                }
            );
            integrationError.upstreamBodyPreview = upstreamPreview || null;
            throw integrationError;
        }

        return true;
    } catch (error) {
        if (error instanceof MailMktIntegrationError) {
            throw error;
        }

        if (error?.name === 'AbortError') {
            throw new MailMktIntegrationError('Timeout ao enviar confirmacao de email via MailMKT', {
                statusCode: 503,
                retryable: true
            });
        }

        throw new MailMktIntegrationError(`Falha de rede ao enviar confirmacao via MailMKT: ${error.message}`, {
            statusCode: 503,
            retryable: true
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function sendRegistrationConfirmationEmail(req, user, tokenPayload) {
    const appUrl = resolveAppUrl(req);
    const confirmationUrl = buildEmailConfirmationUrl(appUrl, tokenPayload.token);
    const payload = {
        email: String(user?.email || '').trim().toLowerCase(),
        name: normalizePersonName(user?.name, user?.email),
        confirmationUrl,
        appName: process.env.APP_NAME || DEFAULT_APP_NAME,
        expiresInText: tokenPayload.expiresInText || DEFAULT_EXPIRES_IN_TEXT
    };

    try {
        await sendEmailConfirmationViaMailMkt(payload);
        console.log('[auth/register] Email de confirmacao enviado', JSON.stringify({
            email: payload.email,
            userId: Number(user?.id || 0) || null,
            tokenFingerprint: tokenFingerprint(tokenPayload.token),
            expiresAt: tokenPayload.expiresAt
        }));
        return { confirmationUrl };
    } catch (error) {
        console.error('[auth/register] Falha ao enviar email de confirmacao via MailMKT', JSON.stringify({
            email: payload.email,
            userId: Number(user?.id || 0) || null,
            tokenFingerprint: tokenFingerprint(tokenPayload.token),
            upstreamStatus: Number(error?.upstreamStatus || 0) || null,
            upstreamBodyPreview: String(error?.upstreamBodyPreview || '').slice(0, 300) || null,
            message: String(error?.message || 'erro_desconhecido')
        }));
        throw error;
    }
}

function isEmailConfirmed(user) {
    if (!user || !Object.prototype.hasOwnProperty.call(user, 'email_confirmed')) return true;
    if (user.email_confirmed === null || user.email_confirmed === undefined) return true;
    return Number(user.email_confirmed) > 0;
}

function isEmailConfirmationExpired(user, now = Date.now()) {
    const expiresAtRaw = user?.email_confirmation_expires_at;
    if (!expiresAtRaw) return false;
    const expiresAtMs = new Date(expiresAtRaw).getTime();
    if (!Number.isFinite(expiresAtMs)) return true;
    return expiresAtMs < now;
}

module.exports = {
    EMAIL_CONFIRMATION_TTL_MS,
    MailMktIntegrationError,
    buildEmailConfirmationUrl,
    createEmailConfirmationTokenPayload,
    hashEmailConfirmationToken,
    isEmailConfirmed,
    isEmailConfirmationExpired,
    resolveAppUrl,
    sendRegistrationConfirmationEmail,
    tokenFingerprint
};
