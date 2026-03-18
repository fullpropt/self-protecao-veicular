function createLeadModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const transaction = options.transaction;
    const generateUUID = options.generateUUID;
    const normalizeLeadPhoneForStorage = options.normalizeLeadPhoneForStorage;
    const buildLeadJidFromPhone = options.buildLeadJidFromPhone;
    const sanitizeLeadName = options.sanitizeLeadName;
    const parseLeadCustomFields = options.parseLeadCustomFields;
    const lockLeadNameAsManual = options.lockLeadNameAsManual;
    const normalizeLeadStatus = options.normalizeLeadStatus;
    const resolveLeadOwnerUserIdInput = options.resolveLeadOwnerUserIdInput;
    const appendLeadOwnerScopeFilter = options.appendLeadOwnerScopeFilter;
    const assertOwnerCanCreateLead = options.assertOwnerCanCreateLead;
    const normalizeDigits = options.normalizeDigits;
    const parseLeadOwnerScopeOption = options.parseLeadOwnerScopeOption;
    const isLeadNameManuallyLocked = options.isLeadNameManuallyLocked;
    const shouldReplaceLeadName = options.shouldReplaceLeadName;
    const parsePositiveInteger = options.parsePositiveInteger;
    const executeLeadCleanupQuery = options.executeLeadCleanupQuery;

    const model = {
        async create(data) {
            const uuid = generateUUID();
            const normalizedPhone = normalizeLeadPhoneForStorage(data.phone);
            if (!normalizedPhone) {
                throw new Error('Telefone invalido');
            }
            const jid = String(data.jid || buildLeadJidFromPhone(normalizedPhone)).trim() || buildLeadJidFromPhone(normalizedPhone);
            const source = String(data.source || 'manual');
            const normalizedSource = source.toLowerCase();
            const sanitizedName = sanitizeLeadName(data.name);
            const incomingName = sanitizedName || normalizedPhone;
            const initialCustomFields = parseLeadCustomFields(data.custom_fields);
            const customFields = normalizedSource !== 'whatsapp' && sanitizedName
                ? lockLeadNameAsManual(initialCustomFields, sanitizedName)
                : initialCustomFields;
            const hasExplicitStatus = Object.prototype.hasOwnProperty.call(data || {}, 'status');
            const normalizedStatus = normalizeLeadStatus(data.status, hasExplicitStatus ? null : 1);
            if (normalizedStatus === null) {
                throw new Error('Status invalido. Use 1, 2, 3 ou 4.');
            }
            const ownerUserId = await resolveLeadOwnerUserIdInput(data);

            if (ownerUserId) {
                let duplicateSql = 'SELECT id FROM leads WHERE phone = ?';
                const duplicateParams = [normalizedPhone];
                duplicateSql = appendLeadOwnerScopeFilter(duplicateSql, duplicateParams, ownerUserId, 'leads');
                duplicateSql += ' LIMIT 1';
                const existingLead = await queryOne(duplicateSql, duplicateParams);
                if (existingLead?.id) {
                    const duplicateError = new Error('Contato ja cadastrado para esta conta.');
                    duplicateError.code = 'LEAD_ALREADY_EXISTS';
                    throw duplicateError;
                }

                await assertOwnerCanCreateLead(ownerUserId, 1);
            }

            const result = await run(`
                INSERT INTO leads (uuid, phone, phone_formatted, jid, name, email, vehicle, plate, status, tags, custom_fields, source, assigned_to, owner_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                normalizedPhone,
                data.phone_formatted || normalizedPhone,
                jid,
                incomingName,
                data.email,
                data.vehicle,
                data.plate,
                normalizedStatus,
                JSON.stringify(data.tags || []),
                JSON.stringify(customFields),
                source,
                data.assigned_to,
                ownerUserId
            ]);

            return { id: result.lastInsertRowid, uuid };
        },

        async findById(id) {
            return await queryOne('SELECT * FROM leads WHERE id = ?', [id]);
        },

        async findByUuid(uuid) {
            return await queryOne('SELECT * FROM leads WHERE uuid = ?', [uuid]);
        },

        async findByPhone(phone, options = {}) {
            const cleaned = normalizeDigits(phone);
            if (!cleaned) return null;
            const ownerUserId = parseLeadOwnerScopeOption(options);

            const suffixLength = Math.min(cleaned.length, 11);
            const suffix = cleaned.slice(-suffixLength);

            let sql = `
                SELECT *
                FROM leads
                WHERE (
                    phone = ?
                    OR phone LIKE ?
                    OR (? <> '' AND substr(phone, length(phone) - ${suffixLength} + 1) = ?)
                )
            `;
            const params = [cleaned, `%${cleaned}`, suffix, suffix];
            sql = appendLeadOwnerScopeFilter(sql, params, ownerUserId, 'leads');
            sql += `
                ORDER BY
                    CASE
                        WHEN phone = ? THEN 0
                        WHEN phone LIKE ? THEN 1
                        WHEN (? <> '' AND substr(phone, length(phone) - ${suffixLength} + 1) = ?) THEN 2
                        ELSE 3
                    END,
                    CASE WHEN jid LIKE '%@s.whatsapp.net' THEN 0 ELSE 1 END,
                    COALESCE(last_message_at, updated_at, created_at) DESC,
                    id DESC
                LIMIT 1
            `;
            params.push(cleaned, `%${cleaned}`, suffix, suffix);

            return await queryOne(sql, params);
        },

        async findByJid(jid, options = {}) {
            const normalizedJid = String(jid || '').trim();
            if (!normalizedJid) return null;

            const ownerUserId = parseLeadOwnerScopeOption(options);
            let sql = 'SELECT * FROM leads WHERE jid = ?';
            const params = [normalizedJid];
            sql = appendLeadOwnerScopeFilter(sql, params, ownerUserId, 'leads');
            sql += ' ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC LIMIT 1';
            return await queryOne(sql, params);
        },

        async findOrCreate(data, options = {}) {
            const ownerUserId = await resolveLeadOwnerUserIdInput({
                ...data,
                owner_user_id: data?.owner_user_id ?? options?.owner_user_id
            });
            let lead = null;
            if (data.jid) {
                lead = await model.findByJid(data.jid, { owner_user_id: ownerUserId });
            }
            if (!lead) {
                lead = await model.findByPhone(data.phone, { owner_user_id: ownerUserId });
            }

            if (lead) {
                const nextName = sanitizeLeadName(data.name);
                const manualNameLocked = isLeadNameManuallyLocked(lead.custom_fields);
                if (shouldReplaceLeadName(lead.name, nextName, lead.phone || data.phone, {
                    manualNameLocked,
                    source: lead.source || data.source
                })) {
                    await model.update(lead.id, { name: nextName });
                    lead.name = nextName;
                }

                const requestedAssignee = Number(data?.assigned_to);
                if (
                    Number.isInteger(requestedAssignee)
                    && requestedAssignee > 0
                    && (!Number.isInteger(Number(lead.assigned_to)) || Number(lead.assigned_to) <= 0)
                ) {
                    await model.update(lead.id, { assigned_to: requestedAssignee });
                    lead.assigned_to = requestedAssignee;
                }
                if (ownerUserId && !parsePositiveInteger(lead.owner_user_id, null)) {
                    await run(
                        'UPDATE leads SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id IS NULL',
                        [ownerUserId, lead.id]
                    );
                    lead.owner_user_id = ownerUserId;
                }
                return { lead, created: false };
            }

            const result = await model.create({
                ...data,
                owner_user_id: ownerUserId || data?.owner_user_id
            });
            return { lead: await model.findById(result.id), created: true };
        },

        async update(id, data) {
            const currentLead = await model.findById(id);
            if (!currentLead) return null;

            const fields = [];
            const values = [];

            const allowedFields = ['name', 'email', 'vehicle', 'plate', 'status', 'tags', 'custom_fields', 'assigned_to', 'is_blocked', 'last_message_at'];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key)) {
                    if (key === 'name') {
                        const sanitizedName = sanitizeLeadName(value);
                        if (!sanitizedName) continue;
                        fields.push('name = ?');
                        values.push(sanitizedName);
                        continue;
                    }

                    if (key === 'status') {
                        const normalizedStatus = normalizeLeadStatus(value, null);
                        if (normalizedStatus === null) {
                            throw new Error('Status invalido. Use 1, 2, 3 ou 4.');
                        }
                        fields.push('status = ?');
                        values.push(normalizedStatus);
                        continue;
                    }

                    if (key === 'custom_fields') {
                        const incomingCustomFields = parseLeadCustomFields(value);
                        const currentCustomFields = parseLeadCustomFields(currentLead.custom_fields);
                        const currentSystem = currentCustomFields.__system
                            && typeof currentCustomFields.__system === 'object'
                            && !Array.isArray(currentCustomFields.__system)
                            ? currentCustomFields.__system
                            : {};
                        const incomingSystem = incomingCustomFields.__system
                            && typeof incomingCustomFields.__system === 'object'
                            && !Array.isArray(incomingCustomFields.__system)
                            ? incomingCustomFields.__system
                            : {};

                        if (currentSystem.manual_name_locked === true) {
                            const preservedSystem = {
                                ...incomingSystem,
                                manual_name_locked: true,
                                manual_name_source: incomingSystem.manual_name_source || currentSystem.manual_name_source || 'manual',
                                manual_name_updated_at: incomingSystem.manual_name_updated_at || currentSystem.manual_name_updated_at || new Date().toISOString()
                            };

                            const preservedManualName = sanitizeLeadName(
                                incomingSystem.manual_name_value || currentSystem.manual_name_value || currentLead.name || ''
                            );
                            if (preservedManualName) {
                                preservedSystem.manual_name_value = preservedManualName;
                            }

                            incomingCustomFields.__system = preservedSystem;
                        }

                        fields.push('custom_fields = ?');
                        values.push(JSON.stringify(incomingCustomFields));
                        continue;
                    }

                    fields.push(`${key} = ?`);
                    values.push(typeof value === 'object' ? JSON.stringify(value) : value);
                }
            }

            if (fields.length === 0) return null;

            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            return await run(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, values);
        },

        async delete(id) {
            return await transaction(async (client) => {
                const leadId = Number(id);
                const cleanupStatements = [
                    'DELETE FROM message_queue WHERE lead_id = $1',
                    'DELETE FROM flow_executions WHERE lead_id = $1',
                    'DELETE FROM messages WHERE lead_id = $1',
                    'DELETE FROM automation_lead_runs WHERE lead_id = $1',
                    'UPDATE custom_event_logs SET lead_id = NULL WHERE lead_id = $1',
                    'DELETE FROM conversations WHERE lead_id = $1'
                ];

                for (const statement of cleanupStatements) {
                    await executeLeadCleanupQuery(client, statement, leadId);
                }

                const result = await client.query('DELETE FROM leads WHERE id = $1', [leadId]);
                return {
                    lastInsertRowid: null,
                    changes: result.rowCount
                };
            });
        },

        async bulkDelete(ids = []) {
            const leadIds = Array.from(
                new Set(
                    (Array.isArray(ids) ? ids : [])
                        .map((value) => parseInt(value, 10))
                        .filter((value) => Number.isInteger(value) && value > 0)
                )
            );

            if (!leadIds.length) {
                return {
                    lastInsertRowid: null,
                    changes: 0
                };
            }

            return await transaction(async (client) => {
                const cleanupStatements = [
                    'DELETE FROM message_queue WHERE lead_id = ANY($1::int[])',
                    'DELETE FROM flow_executions WHERE lead_id = ANY($1::int[])',
                    'DELETE FROM messages WHERE lead_id = ANY($1::int[])',
                    'DELETE FROM automation_lead_runs WHERE lead_id = ANY($1::int[])',
                    'UPDATE custom_event_logs SET lead_id = NULL WHERE lead_id = ANY($1::int[])',
                    'DELETE FROM conversations WHERE lead_id = ANY($1::int[])'
                ];

                for (const statement of cleanupStatements) {
                    await executeLeadCleanupQuery(client, statement, leadIds);
                }

                const result = await client.query('DELETE FROM leads WHERE id = ANY($1::int[])', [leadIds]);
                return {
                    lastInsertRowid: null,
                    changes: result.rowCount
                };
            });
        },

        async list(options = {}) {
            let sql = `
                SELECT
                    leads.*,
                    latest_conversation.session_id,
                    latest_conversation.session_label
                FROM leads
                LEFT JOIN LATERAL (
                    SELECT
                        c.session_id,
                        COALESCE(NULLIF(TRIM(ws.name), ''), NULLIF(TRIM(ws.phone), ''), c.session_id) AS session_label
                    FROM conversations c
                    LEFT JOIN whatsapp_sessions ws ON ws.session_id = c.session_id
                    WHERE c.lead_id = leads.id
                    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
                    LIMIT 1
                ) latest_conversation ON TRUE
                WHERE 1=1
            `;
            const params = [];

            if (options.status) {
                sql += ' AND leads.status = ?';
                params.push(options.status);
            }

            if (options.assigned_to) {
                sql += ' AND leads.assigned_to = ?';
                params.push(options.assigned_to);
            }

            sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');

            if (options.search) {
                sql += ' AND (leads.name LIKE ? OR leads.phone LIKE ?)';
                params.push(`%${options.search}%`, `%${options.search}%`);
            }

            if (options.session_id) {
                sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
                params.push(String(options.session_id).trim());
            }

            sql += ' ORDER BY leads.updated_at DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            if (options.offset) {
                sql += ' OFFSET ?';
                params.push(options.offset);
            }

            return await query(sql, params);
        },

        async count(options = {}) {
            let sql = 'SELECT COUNT(*) as total FROM leads WHERE 1=1';
            const params = [];

            if (options.status) {
                sql += ' AND status = ?';
                params.push(options.status);
            }

            if (options.assigned_to) {
                sql += ' AND assigned_to = ?';
                params.push(options.assigned_to);
            }

            sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');

            if (options.session_id) {
                sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
                params.push(String(options.session_id).trim());
            }

            const row = await queryOne(sql, params);
            const total = Number(row?.total || 0);
            return Number.isFinite(total) && total >= 0 ? total : 0;
        },

        async summary(options = {}) {
            let sql = `
                SELECT leads.status AS status, COUNT(*)::int AS total
                FROM leads
                WHERE 1=1
            `;
            const params = [];

            if (options.assigned_to) {
                sql += ' AND assigned_to = ?';
                params.push(options.assigned_to);
            }

            sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');

            if (options.session_id) {
                sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
                params.push(String(options.session_id).trim());
            }

            sql += ' GROUP BY leads.status';

            const rows = await query(sql, params);
            const byStatus = { 1: 0, 2: 0, 3: 0, 4: 0 };
            let total = 0;

            for (const row of rows || []) {
                const status = Number(row?.status);
                const amount = Number(row?.total || 0);
                if (!Number.isFinite(amount) || amount <= 0) continue;
                total += amount;
                if (status === 1 || status === 2 || status === 3 || status === 4) {
                    byStatus[status] = amount;
                }
            }

            return {
                total,
                by_status: byStatus,
                pending: byStatus[1] + byStatus[2],
                completed: byStatus[3]
            };
        }
    };

    return model;
}

module.exports = {
    createLeadModel
};
