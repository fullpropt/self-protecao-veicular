/**
 * SELF PROTEÃ‡ÃƒO VEICULAR - Modelos de Dados
 * FunÃ§Ãµes CRUD para todas as entidades do sistema
 */

const crypto = require('crypto');
const { query, queryOne, run, transaction, generateUUID } = require('./connection');
const { createLeadModel } = require('./models/leadModel');
const { createConversationModel } = require('./models/conversationModel');
const { createMessageModel } = require('./models/messageModel');
const { createAutomationModel } = require('./models/automationModel');
const { createFlowModel } = require('./models/flowModel');
const { createCustomEventModel } = require('./models/customEventModel');
const { createMessageQueueModel } = require('./models/messageQueueModel');
const { createTagModel } = require('./models/tagModel');
const { createIncomingWebhookCredentialModel } = require('./models/incomingWebhookCredentialModel');
const { createWebhookModel } = require('./models/webhookModel');
const { createWebhookDeliveryQueueModel } = require('./models/webhookDeliveryQueueModel');
const {
    normalizeTagLabel: sharedNormalizeTagLabel,
    normalizeTagKey: sharedNormalizeTagKey,
    parseTagList: sharedParseTagList,
    uniqueTagLabels: sharedUniqueTagLabels
} = require('../utils/tagUtils');
const { normalizeLeadStatus } = require('../utils/leadStatus');
const {
    assertOwnerCanCreateLead,
    assertOwnerCanCreateWhatsAppSession
} = require('../services/planLimitsService');

function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeLeadPhoneForStorage(value) {
    let digits = normalizeDigits(value);
    if (!digits) return '';

    while (digits.startsWith('55') && digits.length > 13) {
        digits = digits.slice(2);
    }

    return digits;
}

function buildLeadJidFromPhone(phone) {
    const digits = normalizeLeadPhoneForStorage(phone);
    if (!digits) return '';
    const waNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `${waNumber}@s.whatsapp.net`;
}

function sanitizeLeadName(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if (
        lower === 'sem nome' ||
        lower === 'unknown' ||
        lower === 'undefined' ||
        lower === 'null' ||
        value.includes('@s.whatsapp.net') ||
        value.includes('@lid')
    ) {
        return '';
    }
    if (/^\d+$/.test(value)) return '';
    return value;
}

function parseLeadCustomFields(value) {
    if (!value) return {};

    if (typeof value === 'object') {
        return Array.isArray(value) ? {} : { ...value };
    }

    if (typeof value !== 'string') return {};

    let current = value;
    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof current !== 'string') break;
        const trimmed = current.trim();
        if (!trimmed) return {};
        try {
            current = JSON.parse(trimmed);
        } catch (_) {
            return {};
        }
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return {};
    }

    return { ...current };
}

function mergeLeadCustomFields(baseValue, overrideValue) {
    const base = parseLeadCustomFields(baseValue);
    const override = parseLeadCustomFields(overrideValue);
    const merged = { ...base, ...override };

    const baseSystem = base.__system && typeof base.__system === 'object' && !Array.isArray(base.__system)
        ? base.__system
        : {};
    const overrideSystem = override.__system && typeof override.__system === 'object' && !Array.isArray(override.__system)
        ? override.__system
        : {};

    if (Object.keys(baseSystem).length > 0 || Object.keys(overrideSystem).length > 0) {
        merged.__system = { ...baseSystem, ...overrideSystem };
    }

    return merged;
}

function lockLeadNameAsManual(customFields, manualName = '') {
    const merged = mergeLeadCustomFields(customFields);
    const currentSystem = merged.__system && typeof merged.__system === 'object' && !Array.isArray(merged.__system)
        ? merged.__system
        : {};
    const sanitizedManualName = sanitizeLeadName(manualName);

    merged.__system = {
        ...currentSystem,
        manual_name_locked: true,
        manual_name_source: 'manual',
        manual_name_updated_at: new Date().toISOString(),
        ...(sanitizedManualName ? { manual_name_value: sanitizedManualName } : {})
    };

    return merged;
}

function isLeadNameManuallyLocked(customFields) {
    const parsed = parseLeadCustomFields(customFields);
    return parsed?.__system?.manual_name_locked === true;
}

function shouldReplaceLeadName(currentName, incomingName, phone, options = {}) {
    if (options.manualNameLocked) return false;
    const source = String(options.source || '').trim().toLowerCase();
    if (source && source !== 'whatsapp') return false;

    const next = sanitizeLeadName(incomingName);
    if (!next) return false;

    const current = String(currentName || '').trim();
    if (!current) return true;

    const currentLower = current.toLowerCase();
    if (
        currentLower === 'sem nome' ||
        currentLower === 'unknown' ||
        currentLower === 'undefined' ||
        currentLower === 'null' ||
        currentLower === 'vocÃª' ||
        currentLower === 'voce' ||
        currentLower === 'usuÃ¡rio (vocÃª)' ||
        currentLower === 'usuario (voce)' ||
        currentLower === 'usuario (vocÃª)'
    ) {
        return true;
    }

    const phoneDigits = normalizeDigits(phone);
    const currentDigits = normalizeDigits(current);
    if (phoneDigits && currentDigits && currentDigits === phoneDigits) return true;
    if (/^\d+$/.test(current)) return true;

    return false;
}

function deriveUserName(name, email) {
    const provided = String(name || '').trim();
    if (provided) return provided;

    const localPart = String(email || '').split('@')[0] || 'Usuario';
    const normalized = localPart.replace(/[._-]+/g, ' ').trim();
    if (!normalized) return 'Usuario';

    return normalized
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeTagValue(value) {
    return sharedNormalizeTagLabel(value);
}

function normalizeTagKey(value) {
    return sharedNormalizeTagKey(value);
}

function normalizeCustomEventName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function normalizeCustomEventKey(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 80);
}

function normalizeFlowSessionScope(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeFlowBuilderMode(value) {
    return String(value || '').trim().toLowerCase() === 'menu' ? 'menu' : 'humanized';
}

function parseFlowGraphList(value) {
    if (Array.isArray(value)) return [...value];

    if (typeof value === 'string') {
        const rawValue = value.trim();
        if (!rawValue) return [];
        try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    return [];
}

function isIntentRoutingFlowNode(node) {
    const nodeType = String(node?.type || '').trim().toLowerCase();
    if (nodeType === 'intent') return true;
    if (nodeType !== 'trigger') return false;

    const subtype = String(node?.subtype || '').trim().toLowerCase();
    return subtype === 'keyword' || subtype === 'intent';
}

function inferFlowBuilderModeFromNodes(nodeList = []) {
    const nodes = parseFlowGraphList(nodeList);
    const hasMenuIntentNode = nodes.some((node) => {
        if (!isIntentRoutingFlowNode(node)) return false;
        return String(node?.data?.responseMode || '').trim().toLowerCase() === 'menu';
    });

    return hasMenuIntentNode ? 'menu' : 'humanized';
}

function resolvePersistedFlowBuilderMode(value, nodeList = []) {
    const rawValue = String(value || '').trim();
    if (rawValue) {
        return normalizeFlowBuilderMode(rawValue);
    }

    return inferFlowBuilderModeFromNodes(nodeList);
}

function hydrateFlowRecord(flow) {
    if (!flow) return null;

    const nodes = parseFlowGraphList(flow.nodes);
    const edges = parseFlowGraphList(flow.edges);

    return {
        ...flow,
        nodes,
        edges,
        flow_builder_mode: resolvePersistedFlowBuilderMode(
            flow.flow_builder_mode || flow.flowBuilderMode,
            nodes
        )
    };
}

function normalizeSessionScopeList(value) {
    let parsed = value;

    if (typeof parsed === 'string') {
        const rawValue = parsed.trim();
        if (!rawValue) return [];
        try {
            parsed = JSON.parse(rawValue);
        } catch (_) {
            parsed = rawValue.split(',');
        }
    }

    if (!Array.isArray(parsed)) return [];

    const normalized = [];
    const seen = new Set();
    for (const item of parsed) {
        const sessionId = String(item || '').trim();
        if (!sessionId || seen.has(sessionId)) continue;
        seen.add(sessionId);
        normalized.push(sessionId);
    }

    return normalized;
}

function parsePlainObject(value) {
    let parsed = value;

    if (typeof parsed === 'string') {
        const rawValue = parsed.trim();
        if (!rawValue) return {};
        try {
            parsed = JSON.parse(rawValue);
        } catch (_) {
            return {};
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
    }

    return { ...parsed };
}

function buildCustomEventKey(name) {
    const fromName = normalizeCustomEventKey(name);
    if (fromName) return fromName;
    return `evento_${Date.now()}`;
}

function parseTagList(rawValue) {
    return sharedParseTagList(rawValue);
}

function uniqueTags(list) {
    return sharedUniqueTagLabels(list);
}

function normalizeFlowKeywordText(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractFlowKeywords(value = '') {
    return String(value || '')
        .split(',')
        .map((keyword) => normalizeFlowKeywordText(keyword))
        .filter(Boolean);
}

function includesFlowKeyword(normalizedMessage, normalizedKeyword) {
    if (!normalizedMessage || !normalizedKeyword) return false;
    return ` ${normalizedMessage} `.includes(` ${normalizedKeyword} `);
}

function scoreFlowKeywordMatch(matchedKeywords = [], priority = 0) {
    const longestMatchWords = matchedKeywords.reduce((max, keyword) => {
        return Math.max(max, keyword.split(' ').length);
    }, 0);

    const longestMatchLength = matchedKeywords.reduce((max, keyword) => {
        return Math.max(max, keyword.length);
    }, 0);

    return {
        longestMatchWords,
        longestMatchLength,
        matchedCount: matchedKeywords.length,
        priority: Number(priority) || 0
    };
}

function compareFlowKeywordScoreDesc(a, b) {
    if (a.longestMatchWords !== b.longestMatchWords) {
        return b.longestMatchWords - a.longestMatchWords;
    }

    if (a.longestMatchLength !== b.longestMatchLength) {
        return b.longestMatchLength - a.longestMatchLength;
    }

    if (a.matchedCount !== b.matchedCount) {
        return b.matchedCount - a.matchedCount;
    }

    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }

    return 0;
}

function toJsonStringOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    try {
        return JSON.stringify(value);
    } catch (_) {
        return null;
    }
}

function parseNonNegativeInteger(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized >= 0 ? normalized : fallback;
}

function parsePositiveInteger(value, fallback = null) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized > 0 ? normalized : fallback;
}

function appendOwnerCreatedByFilters(filters, params, options = {}, config = {}) {
    if (!Array.isArray(filters) || !Array.isArray(params)) {
        return { ownerUserId: null, createdBy: null };
    }

    const ownerUserId = parsePositiveInteger(options?.owner_user_id, null);
    const createdBy = parsePositiveInteger(options?.created_by, null);
    const tableAlias = normalizeTagValue(config?.tableAlias || '');
    const createdByColumn = normalizeTagValue(config?.createdByColumn || 'created_by') || 'created_by';
    const columnRef = tableAlias ? `${tableAlias}.${createdByColumn}` : createdByColumn;

    if (ownerUserId) {
        filters.push(`(
            ${columnRef} = ?
            OR EXISTS (
                SELECT 1
                FROM users owner_scope
                WHERE owner_scope.id = ${columnRef}
                  AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
            )
        )`);
        params.push(ownerUserId, ownerUserId, ownerUserId);
    }

    if (createdBy) {
        filters.push(`${columnRef} = ?`);
        params.push(createdBy);
    }

    return { ownerUserId, createdBy };
}

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

function parseLeadOwnerScopeOption(options) {
    if (typeof options === 'number') {
        return parsePositiveInteger(options, null);
    }
    if (!options || typeof options !== 'object') return null;
    return parsePositiveInteger(
        options.owner_user_id !== undefined ? options.owner_user_id : options.ownerUserId,
        null
    );
}

async function resolveLeadOwnerUserIdInput(data = {}) {
    const explicitOwnerUserId = parsePositiveInteger(data?.owner_user_id, null);
    if (explicitOwnerUserId) return explicitOwnerUserId;

    const assignedUserId = parsePositiveInteger(data?.assigned_to, null);
    if (!assignedUserId) return null;

    const assignedUser = await queryOne(
        'SELECT id, owner_user_id FROM users WHERE id = ?',
        [assignedUserId]
    );
    if (!assignedUser) return null;

    return parsePositiveInteger(assignedUser.owner_user_id, null)
        || parsePositiveInteger(assignedUser.id, null)
        || null;
}

function appendLeadOwnerScopeFilter(sql, params, ownerUserId, tableAlias = 'leads') {
    const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
    if (!normalizedOwnerUserId) return sql;

    sql += `
        AND (
            ${tableAlias}.owner_user_id = ?
            OR (
                ${tableAlias}.owner_user_id IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM users owner_scope
                    WHERE owner_scope.id = ${tableAlias}.assigned_to
                      AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                )
            )
        )
    `;
    params.push(normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId);
    return sql;
}

function normalizeBooleanFlag(value, fallback = 1) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return 1;
        if (['0', 'false', 'no', 'nao', 'nÃ£o', 'off'].includes(normalized)) return 0;
    }
    return fallback;
}

async function executeLeadCleanupQuery(client, statement, leadId) {
    try {
        await client.query(statement, [leadId]);
    } catch (error) {
        // Em ambientes com migraÃ§Ã£o parcial, algumas tabelas podem nÃ£o existir.
        if (error && error.code === '42P01') return;
        throw error;
    }
}

// ============================================
// LEADS
// ============================================

const Lead = createLeadModel({
    query,
    queryOne,
    run,
    transaction,
    generateUUID,
    normalizeLeadPhoneForStorage,
    buildLeadJidFromPhone,
    sanitizeLeadName,
    parseLeadCustomFields,
    lockLeadNameAsManual,
    normalizeLeadStatus,
    resolveLeadOwnerUserIdInput,
    appendLeadOwnerScopeFilter,
    assertOwnerCanCreateLead,
    normalizeDigits,
    parseLeadOwnerScopeOption,
    isLeadNameManuallyLocked,
    shouldReplaceLeadName,
    parsePositiveInteger,
    executeLeadCleanupQuery
});

// ============================================
// CONVERSATIONS
// ============================================

const Conversation = createConversationModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger,
    resolveLeadById: async (leadId) => await Lead.findById(leadId)
});

// ============================================
// MESSAGES
// ============================================

const Message = createMessageModel({
    query,
    queryOne,
    run,
    generateUUID
});

// ============================================
// TEMPLATES
// ============================================

const Template = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
            INSERT INTO templates (uuid, name, category, content, variables, media_url, media_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.category || 'general',
            data.content,
            JSON.stringify(data.variables || ['nome', 'telefone', 'email']),
            data.media_url,
            data.media_type,
            data.created_by
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);
        const params = [id];
        let filters = '';

        if (ownerUserId) {
            filters += `
                AND (
                    templates.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = templates.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            filters += ' AND templates.created_by = ?';
            params.push(createdBy);
        }

        return await queryOne(`
            SELECT templates.*
            FROM templates
            WHERE templates.id = ?
            ${filters}
        `, params);
    },
    
    async list(options = {}) {
        let sql = 'SELECT templates.* FROM templates WHERE templates.is_active = 1';
        const params = [];
        
        if (options.category) {
            sql += ' AND templates.category = ?';
            params.push(options.category);
        }

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);

        if (ownerUserId) {
            sql += `
                AND (
                    templates.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = templates.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            sql += ' AND templates.created_by = ?';
            params.push(createdBy);
        }
        
        sql += ' ORDER BY usage_count DESC, name ASC';
        
        return await query(sql, params);
    },
    
    async incrementUsage(id) {
        return await run('UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?', [id]);
    },
    
    async update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'category', 'content', 'variables', 'media_url', 'media_type', 'is_active'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async delete(id) {
        return await run('UPDATE templates SET is_active = 0 WHERE id = ?', [id]);
    }
};

// ============================================
// CAMPAIGNS
// ============================================

const Campaign = {
    async create(data) {
        const uuid = generateUUID();
        const sendWindowEnabled = normalizeBooleanFlag(data.send_window_enabled, 0);
        const sendWindowStart = String(data.send_window_start || '').trim() || null;
        const sendWindowEnd = String(data.send_window_end || '').trim() || null;

        const result = await run(`
            INSERT INTO campaigns (
                uuid, name, description, type, distribution_strategy, distribution_config,
                status, segment, tag_filter, message, delay, delay_min, delay_max, start_at,
                send_window_enabled, send_window_start, send_window_end, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.description,
            data.type || 'broadcast',
            String(data.distribution_strategy || 'single').trim() || 'single',
            toJsonStringOrNull(data.distribution_config),
            data.status || 'draft',
            data.segment,
            data.tag_filter || null,
            data.message,
            data.delay || data.delay_min || 0,
            data.delay_min || data.delay || 0,
            data.delay_max || data.delay_min || data.delay || 0,
            data.start_at,
            sendWindowEnabled,
            sendWindowStart,
            sendWindowEnd,
            data.created_by
        ]);

        return { id: result.lastInsertRowid, uuid };
    },

    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);
        const params = [id];
        let filters = '';

        if (ownerUserId) {
            filters += `
                AND (
                    campaigns.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = campaigns.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            filters += ' AND campaigns.created_by = ?';
            params.push(createdBy);
        }

        return await queryOne(`
            SELECT campaigns.*
            FROM campaigns
            WHERE campaigns.id = ?
            ${filters}
        `, params);
    },

    async list(options = {}) {
        let sql = 'SELECT campaigns.* FROM campaigns WHERE 1=1';
        const params = [];
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);

        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }

        if (options.type) {
            sql += ' AND type = ?';
            params.push(options.type);
        }

        if (ownerUserId) {
            sql += `
                AND (
                    campaigns.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = campaigns.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            sql += ' AND campaigns.created_by = ?';
            params.push(createdBy);
        }

        if (options.search) {
            sql += ' AND (campaigns.name LIKE ? OR campaigns.description LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }

        sql += ' ORDER BY campaigns.created_at DESC';

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

    async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'name', 'description', 'type', 'status', 'segment', 'tag_filter',
            'message', 'delay', 'delay_min', 'delay_max', 'start_at', 'sent', 'delivered', 'read', 'replied',
            'distribution_strategy', 'distribution_config',
            'send_window_enabled', 'send_window_start', 'send_window_end'
        ];

        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                if (key === 'distribution_strategy') {
                    values.push(String(value || '').trim() || 'single');
                } else if (key === 'distribution_config') {
                    values.push(toJsonStringOrNull(value));
                } else if (key === 'send_window_enabled') {
                    values.push(normalizeBooleanFlag(value, 0));
                } else if (key === 'send_window_start' || key === 'send_window_end') {
                    values.push(String(value || '').trim() || null);
                } else {
                    values.push(value);
                }
            }
        }

        if (fields.length === 0) return null;

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        return await run(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values);
    },

    async refreshMetrics(id) {
        const sentStats = await queryOne(`
            SELECT
                COUNT(*) as sent,
                SUM(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read
            FROM messages
            WHERE campaign_id = ?
        `, [id]);

        const repliedStats = await queryOne(`
            SELECT COUNT(DISTINCT incoming.lead_id) as replied
            FROM messages incoming
            WHERE incoming.is_from_me = 0
              AND EXISTS (
                SELECT 1
                FROM messages outgoing
                WHERE outgoing.campaign_id = ?
                  AND outgoing.is_from_me = 1
                  AND outgoing.lead_id = incoming.lead_id
                  AND COALESCE(outgoing.sent_at, outgoing.created_at) <= COALESCE(incoming.sent_at, incoming.created_at)
              )
        `, [id]);

        const metrics = {
            sent: Number(sentStats?.sent || 0),
            delivered: Number(sentStats?.delivered || 0),
            read: Number(sentStats?.read || 0),
            replied: Number(repliedStats?.replied || 0)
        };

        await run(`
            UPDATE campaigns
            SET sent = ?, delivered = ?, read = ?, replied = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [metrics.sent, metrics.delivered, metrics.read, metrics.replied, id]);

        return metrics;
    },

    async refreshMetricsByLead(leadId) {
        const rows = await query(`
            SELECT DISTINCT campaign_id
            FROM messages
            WHERE lead_id = ? AND campaign_id IS NOT NULL
        `, [leadId]);

        for (const row of rows) {
            await this.refreshMetrics(row.campaign_id);
        }
    },

    async delete(id) {
        return await run('DELETE FROM campaigns WHERE id = ?', [id]);
    }
};

const CampaignSenderAccount = {
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

const WhatsAppSession = {
    async list(options = {}) {
        const includeDisabled = options.includeDisabled !== false;
        const createdBy = parsePositiveInteger(options.created_by);
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const filters = [];
        const params = [];

        if (ownerUserId) {
            filters.push(`
                (
                    whatsapp_sessions.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = whatsapp_sessions.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `);
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            filters.push('created_by = ?');
            params.push(createdBy);
        }

        if (!includeDisabled) {
            filters.push('COALESCE(campaign_enabled, 1) = 1');
        }

        const rows = await query(`
            SELECT
                id,
                session_id,
                phone,
                name,
                status,
                COALESCE(campaign_enabled, 1) AS campaign_enabled,
                COALESCE(daily_limit, 0) AS daily_limit,
                COALESCE(dispatch_weight, 1) AS dispatch_weight,
                COALESCE(hourly_limit, 0) AS hourly_limit,
                cooldown_until,
                qr_code,
                last_connected_at,
                created_by,
                created_at,
                updated_at
            FROM whatsapp_sessions
            ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
            ORDER BY updated_at DESC, id DESC
        `, params);
        return rows.map((row) => ({
            ...row,
            campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
            daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
            dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
            hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
            created_by: parsePositiveInteger(row.created_by)
        }));
    },

    async findBySessionId(sessionId, options = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) return null;
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [normalizedSessionId];
        let ownerFilter = '';
        if (ownerUserId) {
            ownerFilter = `
                AND (
                    whatsapp_sessions.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = whatsapp_sessions.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            ownerFilter = ' AND created_by = ?';
            params.push(createdBy);
        }

        const row = await queryOne(`
            SELECT
                id,
                session_id,
                phone,
                name,
                status,
                COALESCE(campaign_enabled, 1) AS campaign_enabled,
                COALESCE(daily_limit, 0) AS daily_limit,
                COALESCE(dispatch_weight, 1) AS dispatch_weight,
                COALESCE(hourly_limit, 0) AS hourly_limit,
                cooldown_until,
                qr_code,
                last_connected_at,
                created_by,
                created_at,
                updated_at
            FROM whatsapp_sessions
            WHERE session_id = ?
            ${ownerFilter}
        `, params);

        if (!row) return null;

        return {
            ...row,
            campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
            daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
            dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
            hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
            created_by: parsePositiveInteger(row.created_by)
        };
    },

    async upsertDispatchConfig(sessionId, data = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) {
            throw new Error('session_id e obrigatorio');
        }

        const existing = await this.findBySessionId(normalizedSessionId);
        const existingCreatedBy = parsePositiveInteger(existing?.created_by);
        const requestedOwnerUserId = parsePositiveInteger(data.owner_user_id);
        const requestedCreatedBy = parsePositiveInteger(data.created_by);
        if (requestedOwnerUserId && existing) {
            const ownedExisting = await this.findBySessionId(normalizedSessionId, {
                owner_user_id: requestedOwnerUserId
            });
            if (!ownedExisting) {
                throw new Error('Sem permissao para atualizar esta sessao');
            }
        } else if (existingCreatedBy && requestedCreatedBy && existingCreatedBy !== requestedCreatedBy) {
            throw new Error('Sem permissao para atualizar esta sessao');
        }
        const resolvedCreatedBy = requestedOwnerUserId || requestedCreatedBy || existingCreatedBy || null;
        if (!existing && resolvedCreatedBy) {
            await assertOwnerCanCreateWhatsAppSession(resolvedCreatedBy, 1);
        }
        const resolvedName = Object.prototype.hasOwnProperty.call(data, 'name')
            ? (data.name ? String(data.name).trim().slice(0, 120) : null)
            : (existing?.name || null);
        const campaignEnabled = Object.prototype.hasOwnProperty.call(data, 'campaign_enabled')
            ? normalizeBooleanFlag(data.campaign_enabled, existing?.campaign_enabled ?? 1)
            : (existing?.campaign_enabled ?? 1);
        const dailyLimit = Object.prototype.hasOwnProperty.call(data, 'daily_limit')
            ? parseNonNegativeInteger(data.daily_limit, existing?.daily_limit ?? 0)
            : (existing?.daily_limit ?? 0);
        const dispatchWeight = Object.prototype.hasOwnProperty.call(data, 'dispatch_weight')
            ? Math.max(1, parseNonNegativeInteger(data.dispatch_weight, existing?.dispatch_weight ?? 1) || 1)
            : Math.max(1, parseNonNegativeInteger(existing?.dispatch_weight, 1) || 1);
        const hourlyLimit = Object.prototype.hasOwnProperty.call(data, 'hourly_limit')
            ? parseNonNegativeInteger(data.hourly_limit, existing?.hourly_limit ?? 0)
            : (existing?.hourly_limit ?? 0);
        const cooldownUntil = Object.prototype.hasOwnProperty.call(data, 'cooldown_until')
            ? (data.cooldown_until ? String(data.cooldown_until) : null)
            : (existing?.cooldown_until || null);

        await run(`
            INSERT INTO whatsapp_sessions (
                session_id, name, status, campaign_enabled, daily_limit, dispatch_weight, hourly_limit, cooldown_until, created_by, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (session_id) DO UPDATE SET
                name = EXCLUDED.name,
                campaign_enabled = EXCLUDED.campaign_enabled,
                daily_limit = EXCLUDED.daily_limit,
                dispatch_weight = EXCLUDED.dispatch_weight,
                hourly_limit = EXCLUDED.hourly_limit,
                cooldown_until = EXCLUDED.cooldown_until,
                created_by = COALESCE(EXCLUDED.created_by, whatsapp_sessions.created_by),
                updated_at = CURRENT_TIMESTAMP
        `, [
            normalizedSessionId,
            resolvedName,
            existing?.status || 'disconnected',
            campaignEnabled,
            dailyLimit,
            dispatchWeight,
            hourlyLimit,
            cooldownUntil,
            resolvedCreatedBy
        ]);

        return this.findBySessionId(normalizedSessionId);
    },

    async deleteBySessionId(sessionId, options = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) {
            throw new Error('session_id e obrigatorio');
        }

        const requesterOwnerUserId = parsePositiveInteger(options.owner_user_id);
        const requesterCreatedBy = parsePositiveInteger(options.created_by);
        const existing = await this.findBySessionId(normalizedSessionId);

        if (requesterOwnerUserId && existing) {
            const ownedSession = await this.findBySessionId(normalizedSessionId, {
                owner_user_id: requesterOwnerUserId
            });
            if (!ownedSession) {
                throw new Error('Sem permissao para remover esta sessao');
            }
        } else if (requesterCreatedBy && existing) {
            const ownedSession = await this.findBySessionId(normalizedSessionId, {
                created_by: requesterCreatedBy
            });
            if (!ownedSession) {
                throw new Error('Sem permissao para remover esta sessao');
            }
        }

        const campaignCleanup = await run('DELETE FROM campaign_sender_accounts WHERE session_id = ?', [normalizedSessionId]);
        const flowCleanup = await run(`
            UPDATE flows
            SET session_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        `, [normalizedSessionId]);

        let automationCleanupCount = 0;
        const automationRows = await query(`
            SELECT id, session_scope
            FROM automations
            WHERE session_scope IS NOT NULL
              AND TRIM(session_scope) <> ''
              AND session_scope LIKE ?
        `, [`%${normalizedSessionId}%`]);
        for (const automation of automationRows) {
            const sessionScope = normalizeSessionScopeList(automation?.session_scope);
            if (!sessionScope.includes(normalizedSessionId)) continue;

            const nextSessionScope = sessionScope.filter((sessionId) => sessionId !== normalizedSessionId);
            const result = await Automation.update(automation.id, {
                session_scope: nextSessionScope.length ? JSON.stringify(nextSessionScope) : null
            });
            automationCleanupCount += Number(result?.changes || 0) || 0;
        }

        let businessHoursCleanupCount = 0;
        const businessHoursSettingRows = await query(`
            SELECT key
            FROM settings
            WHERE key = ?
               OR key LIKE ?
        `, ['business_hours_by_session', 'user:%:business_hours_by_session']);
        for (const settingRow of businessHoursSettingRows) {
            const settingsKey = String(settingRow?.key || '').trim();
            if (!settingsKey) continue;

            const currentValue = parsePlainObject(await Settings.get(settingsKey));
            if (!Object.prototype.hasOwnProperty.call(currentValue, normalizedSessionId)) {
                continue;
            }

            delete currentValue[normalizedSessionId];
            if (Object.keys(currentValue).length > 0) {
                await Settings.set(settingsKey, currentValue, 'json');
            } else {
                await run('DELETE FROM settings WHERE key = ?', [settingsKey]);
            }
            businessHoursCleanupCount += 1;
        }

        const sessionCleanup = await run('DELETE FROM whatsapp_sessions WHERE session_id = ?', [normalizedSessionId]);
        return {
            session_id: normalizedSessionId,
            removed: Number(sessionCleanup?.changes || 0) > 0,
            cleanup: {
                campaign_sender_accounts: Number(campaignCleanup?.changes || 0) || 0,
                flows: Number(flowCleanup?.changes || 0) || 0,
                automations: automationCleanupCount,
                business_hours_settings: businessHoursCleanupCount
            }
        };
    }
};

// ============================================
// AUTOMATIONS
// ============================================

const Automation = createAutomationModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger
});

// ============================================
// FLOWS
// ============================================

const Flow = createFlowModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger,
    normalizeFlowSessionScope,
    resolvePersistedFlowBuilderMode,
    hydrateFlowRecord,
    normalizeFlowKeywordText,
    extractFlowKeywords,
    includesFlowKeyword,
    scoreFlowKeywordMatch,
    compareFlowKeywordScoreDesc
});

// ============================================
// CUSTOM EVENTS
// ============================================

const CustomEvent = createCustomEventModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger,
    normalizeCustomEventName,
    normalizeCustomEventKey,
    buildCustomEventKey,
    normalizeBooleanFlag,
    toJsonStringOrNull
});

// ============================================
// MESSAGE QUEUE
// ============================================

const MessageQueue = createMessageQueueModel({
    query,
    queryOne,
    run,
    generateUUID,
    normalizeBooleanFlag,
    toJsonStringOrNull,
    parsePositiveInteger
});

// ============================================
// TAGS
// ============================================

const Tag = createTagModel({
    query,
    queryOne,
    run,
    parsePositiveInteger,
    normalizeTagValue,
    normalizeTagKey,
    parseTagList,
    uniqueTags
});

// ============================================
// WEBHOOKS
// ============================================

const IncomingWebhookCredential = createIncomingWebhookCredentialModel({
    queryOne,
    run,
    parsePositiveInteger,
    normalizeIncomingWebhookSecret,
    hashIncomingWebhookSecret,
    generateIncomingWebhookSecret,
    buildIncomingWebhookSecretPreview,
    incomingWebhookSecretMinLength: INCOMING_WEBHOOK_SECRET_MIN_LENGTH
});

const Webhook = createWebhookModel({
    query,
    queryOne,
    run,
    generateUUID,
    appendOwnerCreatedByFilters
});

const WebhookDeliveryQueue = createWebhookDeliveryQueueModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger,
    parseNonNegativeInteger,
    toJsonStringOrNull
});

const SupportInboxMessage = {
    async upsert(data = {}) {
        const externalMessageId = String((data?.external_message_id ?? data?.externalMessageId) || '').trim().slice(0, 255) || null;
        const provider = String(data?.provider || 'unknown').trim().toLowerCase().slice(0, 40) || 'unknown';
        const fromName = String((data?.from_name ?? data?.fromName) || '').trim().slice(0, 255) || null;
        const fromEmail = String((data?.from_email ?? data?.fromEmail) || '').trim().toLowerCase().slice(0, 255);
        const toEmail = String((data?.to_email ?? data?.toEmail) || 'support@zapvender.com').trim().toLowerCase().slice(0, 255) || 'support@zapvender.com';
        const subject = String(data?.subject || '').trim().slice(0, 500) || '(Sem assunto)';
        const bodyText = String((data?.body_text ?? data?.bodyText) || '').slice(0, 25000) || null;
        const bodyHtml = String((data?.body_html ?? data?.bodyHtml) || '').slice(0, 150000) || null;
        const rawPayload = toJsonStringOrNull(data?.raw_payload ?? data?.rawPayload);
        const receivedAt = data?.received_at ?? data?.receivedAt ?? new Date().toISOString();

        if (!fromEmail) {
            throw new Error('from_email invalido');
        }

        if (externalMessageId) {
            const existing = await queryOne(
                'SELECT id FROM support_inbox_messages WHERE external_message_id = ? LIMIT 1',
                [externalMessageId]
            );

            if (existing?.id) {
                await run(`
                    UPDATE support_inbox_messages
                    SET provider = ?,
                        from_name = ?,
                        from_email = ?,
                        to_email = ?,
                        subject = ?,
                        body_text = ?,
                        body_html = ?,
                        raw_payload = ?,
                        received_at = ?,
                        is_read = 0
                    WHERE id = ?
                `, [
                    provider,
                    fromName,
                    fromEmail,
                    toEmail,
                    subject,
                    bodyText,
                    bodyHtml,
                    rawPayload,
                    receivedAt,
                    existing.id
                ]);

                return { id: Number(existing.id), created: false };
            }
        }

        const result = await run(`
            INSERT INTO support_inbox_messages (
                external_message_id, provider, from_name, from_email, to_email, subject,
                body_text, body_html, raw_payload, received_at, is_read
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            externalMessageId,
            provider,
            fromName,
            fromEmail,
            toEmail,
            subject,
            bodyText,
            bodyHtml,
            rawPayload,
            receivedAt,
            0
        ]);

        return { id: result.lastInsertRowid, created: true };
    },

    async list(options = {}) {
        const limit = Math.max(1, Math.min(100, parsePositiveInteger(options?.limit, 30) || 30));
        const offset = Math.max(0, parseNonNegativeInteger(options?.offset, 0));
        const unreadOnly = options?.unread_only === true || options?.unreadOnly === true;
        const params = [];

        let sql = `
            SELECT *
            FROM support_inbox_messages
            WHERE 1 = 1
        `;

        if (unreadOnly) {
            sql += ' AND COALESCE(is_read, 0) = 0';
        }

        sql += `
            ORDER BY COALESCE(received_at, created_at) DESC, id DESC
            LIMIT ?
            OFFSET ?
        `;
        params.push(limit, offset);

        return await query(sql, params);
    },

    async count(options = {}) {
        const unreadOnly = options?.unread_only === true || options?.unreadOnly === true;
        let sql = 'SELECT COUNT(*) AS total FROM support_inbox_messages WHERE 1 = 1';
        const params = [];

        if (unreadOnly) {
            sql += ' AND COALESCE(is_read, 0) = 0';
        }

        const row = await queryOne(sql, params);
        return Number(row?.total || 0);
    },

    async markRead(id, isRead = true) {
        const normalizedId = parsePositiveInteger(id, null);
        if (!normalizedId) {
            throw new Error('id invalido');
        }

        return await run(
            'UPDATE support_inbox_messages SET is_read = ? WHERE id = ?',
            [isRead ? 1 : 0, normalizedId]
        );
    },

    async findById(id) {
        const normalizedId = parsePositiveInteger(id, null);
        if (!normalizedId) return null;
        return await queryOne('SELECT * FROM support_inbox_messages WHERE id = ? LIMIT 1', [normalizedId]);
    }
};

// ============================================
// CHECKOUT REGISTRATIONS
// ============================================

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

const CheckoutRegistration = {
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

const PreCheckoutLead = {
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

// ============================================
// SETTINGS
// ============================================

const Settings = {
    async get(key) {
        const setting = await queryOne('SELECT * FROM settings WHERE key = ?', [key]);
        if (!setting) return null;
        
        switch (setting.type) {
            case 'number':
                return parseFloat(setting.value);
            case 'boolean':
                return setting.value === 'true';
            case 'json':
                return JSON.parse(setting.value);
            default:
                return setting.value;
        }
    },
    
    async set(key, value, type = 'string') {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        return await run(`
            INSERT INTO settings (key, value, type, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, updated_at = CURRENT_TIMESTAMP
        `, [key, stringValue, type, stringValue, type]);
    },
    
    async getAll() {
        const settings = await query('SELECT * FROM settings');
        const result = {};
        
        for (const setting of settings) {
            switch (setting.type) {
                case 'number':
                    result[setting.key] = parseFloat(setting.value);
                    break;
                case 'boolean':
                    result[setting.key] = setting.value === 'true';
                    break;
                case 'json':
                    result[setting.key] = JSON.parse(setting.value);
                    break;
                default:
                    result[setting.key] = setting.value;
            }
        }
        
        return result;
    }
};

// ============================================
// USERS
// ============================================

const User = {
    async create(data) {
        const uuid = generateUUID();
        const safeName = deriveUserName(data.name, data.email);
        const ownerUserId = Number(data.owner_user_id);
        const normalizedOwnerUserId = Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : null;
        const hasEmailConfirmed = Object.prototype.hasOwnProperty.call(data, 'email_confirmed');
        const hasEmailConfirmedAt = Object.prototype.hasOwnProperty.call(data, 'email_confirmed_at');
        const hasEmailConfirmationTokenHash = Object.prototype.hasOwnProperty.call(data, 'email_confirmation_token_hash');
        const hasEmailConfirmationExpiresAt = Object.prototype.hasOwnProperty.call(data, 'email_confirmation_expires_at');
        
        const result = await run(`
            INSERT INTO users (
                uuid,
                name,
                email,
                password_hash,
                email_confirmed,
                email_confirmed_at,
                email_confirmation_token_hash,
                email_confirmation_expires_at,
                role,
                avatar_url,
                owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            safeName,
            data.email,
            data.password_hash,
            hasEmailConfirmed ? (Number(data.email_confirmed) > 0 ? 1 : 0) : 1,
            hasEmailConfirmedAt ? (data.email_confirmed_at || null) : null,
            hasEmailConfirmationTokenHash ? (String(data.email_confirmation_token_hash || '').trim() || null) : null,
            hasEmailConfirmationExpiresAt ? (data.email_confirmation_expires_at || null) : null,
            data.role || 'agent',
            data.avatar_url,
            normalizedOwnerUserId
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne(
            'SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users WHERE id = ?',
            [id]
        );
    },

    async findByIdWithPassword(id) {
        return await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    },
    
    async findByEmail(email, options = {}) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) return null;

        const includeInactive = options?.includeInactive !== false;
        const whereActive = includeInactive ? '' : ' AND is_active = 1';
        return await queryOne(
            `SELECT *
             FROM users
             WHERE email = ?${whereActive}
             ORDER BY is_active DESC, id DESC
             LIMIT 1`,
            [normalizedEmail]
        );
    },

    async findActiveByEmail(email) {
        return await this.findByEmail(email, { includeInactive: false });
    },

    async findByEmailConfirmationTokenHash(tokenHash) {
        const normalizedHash = String(tokenHash || '').trim().toLowerCase();
        if (!normalizedHash) return null;
        return await queryOne(
            `SELECT *
             FROM users
             WHERE email_confirmation_token_hash = ?
             ORDER BY id DESC
             LIMIT 1`,
            [normalizedHash]
        );
    },

    async consumeEmailConfirmationToken(tokenHash) {
        const normalizedHash = String(tokenHash || '').trim().toLowerCase();
        if (!normalizedHash) return null;
        return await queryOne(
            `UPDATE users
             SET email_confirmed = 1,
                 email_confirmed_at = CURRENT_TIMESTAMP,
                 email_confirmation_token_hash = NULL,
                 email_confirmation_expires_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE email_confirmation_token_hash = ?
               AND COALESCE(email_confirmed, 1) = 0
               AND (
                    email_confirmation_expires_at IS NULL
                    OR email_confirmation_expires_at >= CURRENT_TIMESTAMP
               )
             RETURNING id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at`,
            [normalizedHash]
        );
    },
    
    async updateLastLogin(id) {
        return await run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    },
    
    async list() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users WHERE is_active = 1 ORDER BY name ASC');
    },

    async listAll() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users ORDER BY name ASC');
    },

    async listByOwner(ownerUserId, options = {}) {
        const ownerId = Number(ownerUserId);
        if (!Number.isInteger(ownerId) || ownerId <= 0) return [];

        const includeInactive = options?.includeInactive === true;
        const whereActive = includeInactive ? '' : ' AND is_active = 1';
        return await query(
            `SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at
             FROM users
             WHERE owner_user_id = ?${whereActive}
             ORDER BY name ASC`,
            [ownerId]
        );
    },

    async update(id, data) {
        const updates = [];
        const params = [];

        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            const nextName = deriveUserName(data.name, data.email);
            updates.push('name = ?');
            params.push(nextName);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email')) {
            updates.push('email = ?');
            params.push(String(data.email || '').trim().toLowerCase());
        }

        if (Object.prototype.hasOwnProperty.call(data, 'role')) {
            updates.push('role = ?');
            params.push(String(data.role || '').trim().toLowerCase() || 'agent');
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed')) {
            updates.push('email_confirmed = ?');
            params.push(Number(data.email_confirmed) > 0 ? 1 : 0);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed_at')) {
            updates.push('email_confirmed_at = ?');
            params.push(data.email_confirmed_at || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_token_hash')) {
            updates.push('email_confirmation_token_hash = ?');
            params.push(String(data.email_confirmation_token_hash || '').trim() || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_expires_at')) {
            updates.push('email_confirmation_expires_at = ?');
            params.push(data.email_confirmation_expires_at || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
            updates.push('is_active = ?');
            params.push(Number(data.is_active) > 0 ? 1 : 0);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'owner_user_id')) {
            const ownerUserId = Number(data.owner_user_id);
            const normalizedOwnerUserId = Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : null;
            updates.push('owner_user_id = ?');
            params.push(normalizedOwnerUserId);
        }

        if (!updates.length) {
            return { changes: 0 };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        return await run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
    },

    async updatePassword(id, passwordHash) {
        return await run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, id]
        );
    }
};

module.exports = {
    Lead,
    Conversation,
    Message,
    Template,
    Campaign,
    CampaignSenderAccount,
    Automation,
    Flow,
    CustomEvent,
    MessageQueue,
    Tag,
    IncomingWebhookCredential,
    Webhook,
    WebhookDeliveryQueue,
    SupportInboxMessage,
    PreCheckoutLead,
    CheckoutRegistration,
    WhatsAppSession,
    Settings,
    User
};






