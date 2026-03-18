function createIncomingWebhookCredentialModel(options = {}) {
    const queryOne = options.queryOne;
    const run = options.run;
    const parsePositiveInteger = options.parsePositiveInteger;
    const normalizeIncomingWebhookSecret = options.normalizeIncomingWebhookSecret;
    const hashIncomingWebhookSecret = options.hashIncomingWebhookSecret;
    const generateIncomingWebhookSecret = options.generateIncomingWebhookSecret;
    const buildIncomingWebhookSecretPreview = options.buildIncomingWebhookSecretPreview;
    const incomingWebhookSecretMinLength = options.incomingWebhookSecretMinLength || 16;

    const model = {
        MIN_SECRET_LENGTH: incomingWebhookSecretMinLength,

        normalizeSecret(value) {
            return normalizeIncomingWebhookSecret(value);
        },

        isValidSecret(value, validationOptions = {}) {
            const minLength = parsePositiveInteger(validationOptions?.minLength, incomingWebhookSecretMinLength)
                || incomingWebhookSecretMinLength;
            return normalizeIncomingWebhookSecret(value).length >= minLength;
        },

        generateSecret() {
            return generateIncomingWebhookSecret();
        },

        async hasAny() {
            const row = await queryOne('SELECT id FROM incoming_webhook_credentials LIMIT 1');
            return !!row;
        },

        async findByOwnerUserId(ownerUserId) {
            const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
            if (!normalizedOwnerUserId) return null;

            return await queryOne(`
                SELECT
                    id,
                    owner_user_id,
                    secret_prefix,
                    secret_suffix,
                    created_by,
                    last_rotated_at,
                    last_used_at,
                    created_at,
                    updated_at
                FROM incoming_webhook_credentials
                WHERE owner_user_id = ?
                LIMIT 1
            `, [normalizedOwnerUserId]);
        },

        async findOwnerBySecret(secret) {
            const normalizedSecret = normalizeIncomingWebhookSecret(secret);
            if (!normalizedSecret) return null;

            const secretHash = hashIncomingWebhookSecret(normalizedSecret);
            if (!secretHash) return null;

            const credential = await queryOne(`
                SELECT
                    id,
                    owner_user_id,
                    secret_prefix,
                    secret_suffix,
                    created_by,
                    last_rotated_at,
                    last_used_at,
                    created_at,
                    updated_at
                FROM incoming_webhook_credentials
                WHERE secret_hash = ?
                LIMIT 1
            `, [secretHash]);

            if (!credential) {
                return null;
            }

            await run(`
                UPDATE incoming_webhook_credentials
                SET last_used_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [credential.id]);

            return credential;
        },

        async upsertForOwner(ownerUserId, upsertOptions = {}) {
            const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
            if (!normalizedOwnerUserId) {
                throw new Error('owner_user_id invalido');
            }

            const providedSecret = normalizeIncomingWebhookSecret(upsertOptions?.secret);
            const secret = providedSecret || generateIncomingWebhookSecret();
            if (!model.isValidSecret(secret)) {
                throw new Error(`Secret invalido (minimo ${incomingWebhookSecretMinLength} caracteres)`);
            }

            const secretHash = hashIncomingWebhookSecret(secret);
            if (!secretHash) {
                throw new Error('Secret invalido');
            }

            const { prefix, suffix } = buildIncomingWebhookSecretPreview(secret);
            const createdBy = parsePositiveInteger(upsertOptions?.created_by ?? upsertOptions?.createdBy, null);

            let credential;
            try {
                credential = await queryOne(`
                    INSERT INTO incoming_webhook_credentials (
                        owner_user_id,
                        secret_hash,
                        secret_prefix,
                        secret_suffix,
                        created_by,
                        last_rotated_at
                    )
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (owner_user_id) DO UPDATE SET
                        secret_hash = EXCLUDED.secret_hash,
                        secret_prefix = EXCLUDED.secret_prefix,
                        secret_suffix = EXCLUDED.secret_suffix,
                        created_by = COALESCE(EXCLUDED.created_by, incoming_webhook_credentials.created_by),
                        last_rotated_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING
                        id,
                        owner_user_id,
                        secret_prefix,
                        secret_suffix,
                        created_by,
                        last_rotated_at,
                        last_used_at,
                        created_at,
                        updated_at
                `, [
                    normalizedOwnerUserId,
                    secretHash,
                    prefix,
                    suffix,
                    createdBy
                ]);
            } catch (error) {
                const message = String(error?.message || '').toLowerCase();
                if (message.includes('secret_hash') && message.includes('duplicate')) {
                    throw new Error('Secret informado ja esta em uso');
                }
                throw error;
            }

            return {
                secret,
                credential
            };
        }
    };

    return model;
}

module.exports = {
    createIncomingWebhookCredentialModel
};
