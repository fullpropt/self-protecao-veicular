function createCampaignSenderAccountModel(options = {}) {
    const query = options.query;
    const run = options.run;
    const parseNonNegativeInteger = options.parseNonNegativeInteger;
    const normalizeBooleanFlag = options.normalizeBooleanFlag;

    const model = {
        normalizeRows(rows = []) {
            return rows.map((row) => ({
                ...row,
                weight: parseNonNegativeInteger(row.weight, 1) || 1,
                daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
                is_active: normalizeBooleanFlag(row.is_active, 1)
            }));
        },

        async listByCampaignId(campaignId, options = {}) {
            const onlyActive = options.onlyActive !== false;
            const rows = await query(`
                SELECT id, campaign_id, session_id, weight, daily_limit, is_active, created_at, updated_at
                FROM campaign_sender_accounts
                WHERE campaign_id = ?
                  ${onlyActive ? 'AND is_active = 1' : ''}
                ORDER BY id ASC
            `, [campaignId]);
            return this.normalizeRows(rows);
        },

        async replaceForCampaign(campaignId, accounts = []) {
            await run('DELETE FROM campaign_sender_accounts WHERE campaign_id = ?', [campaignId]);

            const normalized = [];
            const seen = new Set();

            for (const entry of accounts || []) {
                const sessionId = String(entry?.session_id || entry?.sessionId || '').trim();
                if (!sessionId || seen.has(sessionId)) continue;
                seen.add(sessionId);

                const payload = {
                    session_id: sessionId,
                    weight: Math.max(1, parseNonNegativeInteger(entry?.weight, 1)),
                    daily_limit: parseNonNegativeInteger(entry?.daily_limit ?? entry?.dailyLimit, 0),
                    is_active: normalizeBooleanFlag(entry?.is_active ?? entry?.isActive, 1)
                };
                normalized.push(payload);
            }

            for (const account of normalized) {
                await run(`
                    INSERT INTO campaign_sender_accounts (campaign_id, session_id, weight, daily_limit, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [campaignId, account.session_id, account.weight, account.daily_limit, account.is_active]);
            }

            return this.listByCampaignId(campaignId, { onlyActive: false });
        }
    };

    return model;
}

module.exports = {
    createCampaignSenderAccountModel
};
