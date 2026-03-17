function createCheckoutRegistrationModel(options = {}) {
    const queryOne = options.queryOne;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const parseLeadCustomFields = options.parseLeadCustomFields;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    function normalizeCheckoutRegistrationStatus(value, fallback = 'pending_email_confirmation') {
        const normalized = String(value || '').trim().toLowerCase();
        const allowed = new Set([
            'pending_email_confirmation',
            'email_confirmed',
            'completed',
            'linked_existing_account',
            'email_delivery_failed',
            'expired'
        ]);
        return allowed.has(normalized) ? normalized : fallback;
    }

    function normalizeCheckoutRegistrationRow(row) {
        if (!row) return null;
        return {
            ...row,
            email: String(row.email || '').trim().toLowerCase(),
            stripe_checkout_session_id: String(row.stripe_checkout_session_id || '').trim(),
            stripe_customer_id: String(row.stripe_customer_id || '').trim() || null,
            stripe_subscription_id: String(row.stripe_subscription_id || '').trim() || null,
            stripe_price_id: String(row.stripe_price_id || '').trim() || null,
            stripe_plan_key: String(row.stripe_plan_key || '').trim() || null,
            stripe_plan_code: String(row.stripe_plan_code || '').trim() || null,
            stripe_plan_name: String(row.stripe_plan_name || '').trim() || null,
            status: normalizeCheckoutRegistrationStatus(row.status),
            email_confirmed: Number(row.email_confirmed) > 0 ? 1 : 0,
            linked_user_id: parsePositiveInteger(row.linked_user_id, null),
            owner_user_id: parsePositiveInteger(row.owner_user_id, null),
            metadata: parseLeadCustomFields(row.metadata)
        };
    }

    return {
        async upsertBySession(data = {}) {
            const sessionId = String(data?.stripe_checkout_session_id || data?.session_id || '').trim();
            if (!sessionId) {
                throw new Error('stripe_checkout_session_id e obrigatorio');
            }

            const email = String(data?.email || '').trim().toLowerCase();
            if (!email) {
                throw new Error('email e obrigatorio');
            }

            const statusFallback = Number(data?.linked_user_id || 0) > 0
                ? 'completed'
                : (Number(data?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation');
            const metadataJson = toJsonStringOrNull(data?.metadata || null);

            const row = await queryOne(`
                INSERT INTO checkout_registrations (
                    uuid,
                    email,
                    stripe_checkout_session_id,
                    stripe_customer_id,
                    stripe_subscription_id,
                    stripe_price_id,
                    stripe_plan_key,
                    stripe_plan_code,
                    stripe_plan_name,
                    status,
                    email_confirmed,
                    email_confirmed_at,
                    email_confirmation_token_hash,
                    email_confirmation_expires_at,
                    linked_user_id,
                    owner_user_id,
                    metadata,
                    completed_at,
                    last_email_sent_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (stripe_checkout_session_id) DO UPDATE SET
                    email = EXCLUDED.email,
                    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, checkout_registrations.stripe_customer_id),
                    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, checkout_registrations.stripe_subscription_id),
                    stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, checkout_registrations.stripe_price_id),
                    stripe_plan_key = COALESCE(EXCLUDED.stripe_plan_key, checkout_registrations.stripe_plan_key),
                    stripe_plan_code = COALESCE(EXCLUDED.stripe_plan_code, checkout_registrations.stripe_plan_code),
                    stripe_plan_name = COALESCE(EXCLUDED.stripe_plan_name, checkout_registrations.stripe_plan_name),
                    status = COALESCE(EXCLUDED.status, checkout_registrations.status),
                    email_confirmed = COALESCE(EXCLUDED.email_confirmed, checkout_registrations.email_confirmed),
                    email_confirmed_at = COALESCE(EXCLUDED.email_confirmed_at, checkout_registrations.email_confirmed_at),
                    email_confirmation_token_hash = COALESCE(EXCLUDED.email_confirmation_token_hash, checkout_registrations.email_confirmation_token_hash),
                    email_confirmation_expires_at = COALESCE(EXCLUDED.email_confirmation_expires_at, checkout_registrations.email_confirmation_expires_at),
                    linked_user_id = COALESCE(EXCLUDED.linked_user_id, checkout_registrations.linked_user_id),
                    owner_user_id = COALESCE(EXCLUDED.owner_user_id, checkout_registrations.owner_user_id),
                    metadata = COALESCE(EXCLUDED.metadata, checkout_registrations.metadata),
                    completed_at = COALESCE(EXCLUDED.completed_at, checkout_registrations.completed_at),
                    last_email_sent_at = COALESCE(EXCLUDED.last_email_sent_at, checkout_registrations.last_email_sent_at),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                generateUUID(),
                email,
                sessionId,
                String(data?.stripe_customer_id || '').trim() || null,
                String(data?.stripe_subscription_id || '').trim() || null,
                String(data?.stripe_price_id || '').trim() || null,
                String(data?.stripe_plan_key || '').trim() || null,
                String(data?.stripe_plan_code || '').trim() || null,
                String(data?.stripe_plan_name || '').trim() || null,
                normalizeCheckoutRegistrationStatus(data?.status, statusFallback),
                Number(data?.email_confirmed) > 0 ? 1 : 0,
                data?.email_confirmed_at || null,
                String(data?.email_confirmation_token_hash || '').trim() || null,
                data?.email_confirmation_expires_at || null,
                parsePositiveInteger(data?.linked_user_id, null),
                parsePositiveInteger(data?.owner_user_id, null),
                metadataJson,
                data?.completed_at || null,
                data?.last_email_sent_at || null
            ]);

            return normalizeCheckoutRegistrationRow(row);
        },

        async findBySessionId(sessionId) {
            const normalizedSessionId = String(sessionId || '').trim();
            if (!normalizedSessionId) return null;
            const row = await queryOne(
                'SELECT * FROM checkout_registrations WHERE stripe_checkout_session_id = ? LIMIT 1',
                [normalizedSessionId]
            );
            return normalizeCheckoutRegistrationRow(row);
        },

        async findByStripeSubscriptionId(subscriptionId) {
            const normalizedSubscriptionId = String(subscriptionId || '').trim();
            if (!normalizedSubscriptionId) return null;
            const row = await queryOne(
                'SELECT * FROM checkout_registrations WHERE stripe_subscription_id = ? ORDER BY id DESC LIMIT 1',
                [normalizedSubscriptionId]
            );
            return normalizeCheckoutRegistrationRow(row);
        },

        async findByStripeCustomerId(customerId) {
            const normalizedCustomerId = String(customerId || '').trim();
            if (!normalizedCustomerId) return null;
            const row = await queryOne(
                'SELECT * FROM checkout_registrations WHERE stripe_customer_id = ? ORDER BY id DESC LIMIT 1',
                [normalizedCustomerId]
            );
            return normalizeCheckoutRegistrationRow(row);
        },

        async findByEmailConfirmationTokenHash(tokenHash) {
            const normalizedHash = String(tokenHash || '').trim().toLowerCase();
            if (!normalizedHash) return null;
            const row = await queryOne(
                'SELECT * FROM checkout_registrations WHERE email_confirmation_token_hash = ? ORDER BY id DESC LIMIT 1',
                [normalizedHash]
            );
            return normalizeCheckoutRegistrationRow(row);
        },

        async findLatestByEmail(email, options = {}) {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            if (!normalizedEmail) return null;

            let sql = 'SELECT * FROM checkout_registrations WHERE email = ?';
            const params = [normalizedEmail];

            if (options?.onlyIncomplete === true) {
                sql += " AND (linked_user_id IS NULL AND completed_at IS NULL AND status <> 'linked_existing_account')";
            }

            sql += ' ORDER BY id DESC LIMIT 1';
            const row = await queryOne(sql, params);
            return normalizeCheckoutRegistrationRow(row);
        },

        async update(id, data = {}) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) {
                throw new Error('id invalido');
            }

            const fields = [];
            const values = [];

            const pushField = (fieldName, value) => {
                fields.push(`${fieldName} = ?`);
                values.push(value);
            };

            if (Object.prototype.hasOwnProperty.call(data, 'email')) {
                pushField('email', String(data.email || '').trim().toLowerCase());
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_customer_id')) {
                pushField('stripe_customer_id', String(data.stripe_customer_id || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_subscription_id')) {
                pushField('stripe_subscription_id', String(data.stripe_subscription_id || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_price_id')) {
                pushField('stripe_price_id', String(data.stripe_price_id || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_plan_key')) {
                pushField('stripe_plan_key', String(data.stripe_plan_key || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_plan_code')) {
                pushField('stripe_plan_code', String(data.stripe_plan_code || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'stripe_plan_name')) {
                pushField('stripe_plan_name', String(data.stripe_plan_name || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'status')) {
                pushField('status', normalizeCheckoutRegistrationStatus(data.status));
            }
            if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed')) {
                pushField('email_confirmed', Number(data.email_confirmed) > 0 ? 1 : 0);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed_at')) {
                pushField('email_confirmed_at', data.email_confirmed_at || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_token_hash')) {
                pushField('email_confirmation_token_hash', String(data.email_confirmation_token_hash || '').trim() || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_expires_at')) {
                pushField('email_confirmation_expires_at', data.email_confirmation_expires_at || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'linked_user_id')) {
                pushField('linked_user_id', parsePositiveInteger(data.linked_user_id, null));
            }
            if (Object.prototype.hasOwnProperty.call(data, 'owner_user_id')) {
                pushField('owner_user_id', parsePositiveInteger(data.owner_user_id, null));
            }
            if (Object.prototype.hasOwnProperty.call(data, 'metadata')) {
                pushField('metadata', toJsonStringOrNull(data.metadata || null));
            }
            if (Object.prototype.hasOwnProperty.call(data, 'completed_at')) {
                pushField('completed_at', data.completed_at || null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'last_email_sent_at')) {
                pushField('last_email_sent_at', data.last_email_sent_at || null);
            }

            if (!fields.length) {
                return this.findBySessionId(data?.stripe_checkout_session_id || '');
            }

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(normalizedId);

            const row = await queryOne(
                `UPDATE checkout_registrations SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
                values
            );
            return normalizeCheckoutRegistrationRow(row);
        },

        async markEmailConfirmed(id) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) {
                throw new Error('id invalido');
            }

            const row = await queryOne(`
                UPDATE checkout_registrations
                SET email_confirmed = 1,
                    email_confirmed_at = CURRENT_TIMESTAMP,
                    status = CASE
                        WHEN linked_user_id IS NOT NULL OR completed_at IS NOT NULL THEN 'completed'
                        ELSE 'email_confirmed'
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                RETURNING *
            `, [normalizedId]);

            return normalizeCheckoutRegistrationRow(row);
        }
    };
}

module.exports = {
    createCheckoutRegistrationModel
};
