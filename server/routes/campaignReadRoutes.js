const express = require('express');

function createCampaignReadRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const getScopedUserId = options.getScopedUserId;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const Campaign = options.Campaign;
    const canAccessCreatedRecord = options.canAccessCreatedRecord;
    const attachCampaignSenderAccountsList = options.attachCampaignSenderAccountsList;
    const attachCampaignQueueStateList = options.attachCampaignQueueStateList;
    const attachCampaignSenderAccounts = options.attachCampaignSenderAccounts;
    const attachCampaignQueueState = options.attachCampaignQueueState;
    const resolveCampaignLeadIds = options.resolveCampaignLeadIds;
    const parseCampaignTagFilters = options.parseCampaignTagFilters;
    const query = options.query;

    router.get('/api/campaigns', authenticate, async (req, res) => {
        const { status, type, limit, offset, search } = req.query;
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const campaigns = await Campaign.list({
            status,
            type,
            search,
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });

        const campaignsWithSenders = await attachCampaignSenderAccountsList(campaigns);
        const campaignsWithQueueState = await attachCampaignQueueStateList(campaignsWithSenders);

        return res.json({ success: true, campaigns: campaignsWithQueueState });
    });

    router.get('/api/campaigns/:id', authenticate, async (req, res) => {
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const campaign = await Campaign.findById(req.params.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
        }

        if (!canAccessCreatedRecord(req, campaign.created_by)) {
            return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
        }

        const campaignWithSenders = await attachCampaignSenderAccounts(campaign);
        const campaignWithQueueState = await attachCampaignQueueState(campaignWithSenders);

        return res.json({ success: true, campaign: campaignWithQueueState });
    });

    router.get('/api/campaigns/:id/recipients', authenticate, async (req, res) => {
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const campaign = await Campaign.findById(req.params.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
        }

        if (!canAccessCreatedRecord(req, campaign.created_by)) {
            return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
        }

        const requestedLimit = parseInt(String(req.query.limit || '200'), 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.max(1, Math.min(requestedLimit, 1000))
            : 200;

        const leadIds = await resolveCampaignLeadIds({
            segment: campaign.segment || 'all',
            tagFilter: campaign.tag_filter || '',
            assignedTo: scopedUserId || undefined,
            ownerUserId: ownerScopeUserId || undefined
        });

        if (!leadIds.length) {
            return res.json({
                success: true,
                total: 0,
                segment: campaign.segment || 'all',
                tag_filter: campaign.tag_filter || null,
                tag_filters: parseCampaignTagFilters(campaign.tag_filter),
                recipients: []
            });
        }

        const limitedIds = leadIds.slice(0, limit);
        const placeholders = limitedIds.map(() => '?').join(', ');
        const recipients = await query(
            `SELECT id, name, phone, status, tags, vehicle, plate, last_message_at
             FROM leads
             WHERE id IN (${placeholders})
             ORDER BY updated_at DESC`,
            limitedIds
        );

        const messageStatusRows = await query(
            `SELECT
                lead_id,
                MAX(CASE WHEN status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) AS campaign_sent,
                MAX(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) AS campaign_delivered,
                MAX(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS campaign_read,
                MAX(COALESCE(sent_at, created_at)) AS campaign_sent_at
             FROM messages
             WHERE campaign_id = ?
               AND is_from_me = 1
               AND lead_id IN (${placeholders})
             GROUP BY lead_id`,
            [campaign.id, ...limitedIds]
        );

        const latestQueueRows = await query(
            `SELECT q.lead_id, q.status AS campaign_queue_status, q.error_message AS campaign_queue_error
             FROM message_queue q
             INNER JOIN (
                 SELECT lead_id, MAX(id) AS latest_id
                 FROM message_queue
                 WHERE campaign_id = ?
                   AND lead_id IN (${placeholders})
                 GROUP BY lead_id
             ) latest ON latest.latest_id = q.id`,
            [campaign.id, ...limitedIds]
        );

        const messageStatusByLeadId = new Map(
            (messageStatusRows || []).map((row) => [Number(row.lead_id || 0), row])
        );
        const queueStatusByLeadId = new Map(
            (latestQueueRows || []).map((row) => [Number(row.lead_id || 0), row])
        );

        const recipientsWithCampaignStatus = (recipients || []).map((lead) => {
            const leadId = Number(lead?.id || 0);
            const messageStatus = messageStatusByLeadId.get(leadId) || null;
            const queueStatus = queueStatusByLeadId.get(leadId) || null;

            return {
                ...lead,
                campaign_sent: Number(messageStatus?.campaign_sent || 0) > 0,
                campaign_delivered: Number(messageStatus?.campaign_delivered || 0) > 0,
                campaign_read: Number(messageStatus?.campaign_read || 0) > 0,
                campaign_sent_at: messageStatus?.campaign_sent_at || null,
                campaign_queue_status: queueStatus?.campaign_queue_status || null,
                campaign_queue_error: queueStatus?.campaign_queue_error || null
            };
        });

        return res.json({
            success: true,
            total: leadIds.length,
            segment: campaign.segment || 'all',
            tag_filter: campaign.tag_filter || null,
            tag_filters: parseCampaignTagFilters(campaign.tag_filter),
            recipients: recipientsWithCampaignStatus
        });
    });

    return router;
}

module.exports = {
    createCampaignReadRoutes
};
