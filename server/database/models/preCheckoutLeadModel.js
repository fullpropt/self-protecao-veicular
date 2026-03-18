function createPreCheckoutLeadModel(options = {}) {
    const queryOne = options.queryOne;
    const generateUUID = options.generateUUID;
    const parsePositiveInteger = options.parsePositiveInteger;
    const parseLeadCustomFields = options.parseLeadCustomFields;
    const toJsonStringOrNull = options.toJsonStringOrNull;

    function normalizePreCheckoutLeadStatus(value, fallback = 'captured') {
        const normalized = String(value || '').trim().toLowerCase();
        const allowed = new Set([
            'captured',
            'checkout_started',
            'checkout_completed',
            'discarded'
        ]);
        return allowed.has(normalized) ? normalized : fallback;
    }

    function normalizePreCheckoutLeadRow(row) {
        if (!row) return null;
        return {
            ...row,
            full_name: String(row.full_name || '').trim(),
            email: String(row.email || '').trim().toLowerCase(),
            whatsapp: String(row.whatsapp || '').trim(),
            company_name: String(row.company_name || '').trim() || null,
            primary_objective: String(row.primary_objective || '').trim() || null,
            plan_key: String(row.plan_key || '').trim().toLowerCase(),
            status: normalizePreCheckoutLeadStatus(row.status),
            stripe_checkout_session_id: String(row.stripe_checkout_session_id || '').trim() || null,
            source_url: String(row.source_url || '').trim() || null,
            utm_source: String(row.utm_source || '').trim() || null,
            utm_medium: String(row.utm_medium || '').trim() || null,
            utm_campaign: String(row.utm_campaign || '').trim() || null,
            utm_term: String(row.utm_term || '').trim() || null,
            utm_content: String(row.utm_content || '').trim() || null,
            metadata: parseLeadCustomFields(row.metadata)
        };
    }

    return {
        async create(data = {}) {
            const fullName = String(data?.full_name || data?.name || '').trim();
            const email = String(data?.email || '').trim().toLowerCase();
            const whatsapp = String(data?.whatsapp || '').trim();
            const companyName = String(data?.company_name || data?.companyName || '').trim();
            const primaryObjective = String(data?.primary_objective || data?.primaryObjective || '').trim();
            const planKey = String(data?.plan_key || data?.planKey || '').trim().toLowerCase();

            if (!fullName) {
                throw new Error('full_name e obrigatorio');
            }
            if (!email) {
                throw new Error('email e obrigatorio');
            }
            if (!whatsapp) {
                throw new Error('whatsapp e obrigatorio');
            }
            if (!planKey) {
                throw new Error('plan_key e obrigatorio');
            }

            const row = await queryOne(`
                INSERT INTO pre_checkout_leads (
                    uuid,
                    full_name,
                    email,
                    whatsapp,
                    company_name,
                    primary_objective,
                    plan_key,
                    status,
                    stripe_checkout_session_id,
                    checkout_started_at,
                    source_url,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    utm_term,
                    utm_content,
                    metadata,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            `, [
                generateUUID(),
                fullName,
                email,
                whatsapp,
                companyName || null,
                primaryObjective || null,
                planKey,
                normalizePreCheckoutLeadStatus(data?.status, 'captured'),
                String(data?.stripe_checkout_session_id || '').trim() || null,
                data?.checkout_started_at || null,
                String(data?.source_url || '').trim() || null,
                String(data?.utm_source || '').trim() || null,
                String(data?.utm_medium || '').trim() || null,
                String(data?.utm_campaign || '').trim() || null,
                String(data?.utm_term || '').trim() || null,
                String(data?.utm_content || '').trim() || null,
                toJsonStringOrNull(data?.metadata || null)
            ]);

            return normalizePreCheckoutLeadRow(row);
        },

        async findById(id) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) return null;
            const row = await queryOne(
                'SELECT * FROM pre_checkout_leads WHERE id = ? LIMIT 1',
                [normalizedId]
            );
            return normalizePreCheckoutLeadRow(row);
        },

        async markCheckoutStarted(id, data = {}) {
            const normalizedId = parsePositiveInteger(id, null);
            if (!normalizedId) return null;

            const fields = [
                "status = 'checkout_started'",
                'checkout_started_at = COALESCE(checkout_started_at, CURRENT_TIMESTAMP)',
                'updated_at = CURRENT_TIMESTAMP'
            ];
            const values = [];

            if (Object.prototype.hasOwnProperty.call(data, 'stripe_checkout_session_id')) {
                fields.push('stripe_checkout_session_id = ?');
                values.push(String(data.stripe_checkout_session_id || '').trim() || null);
            }

            if (Object.prototype.hasOwnProperty.call(data, 'metadata')) {
                const current = await this.findById(normalizedId);
                const currentMetadata = current?.metadata && typeof current.metadata === 'object' && !Array.isArray(current.metadata)
                    ? current.metadata
                    : {};
                const nextMetadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
                    ? data.metadata
                    : {};
                fields.push('metadata = ?');
                values.push(toJsonStringOrNull({ ...currentMetadata, ...nextMetadata }));
            }

            values.push(normalizedId);

            const row = await queryOne(
                `UPDATE pre_checkout_leads SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
                values
            );
            return normalizePreCheckoutLeadRow(row);
        }
    };
}

module.exports = {
    createPreCheckoutLeadModel
};
