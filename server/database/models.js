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
const { createTemplateModel } = require('./models/templateModel');
const { createCampaignModel } = require('./models/campaignModel');
const { createCampaignSenderAccountModel } = require('./models/campaignSenderAccountModel');
const { createWhatsAppSessionModel } = require('./models/whatsappSessionModel');
const { createSupportInboxMessageModel } = require('./models/supportInboxMessageModel');
const { createCheckoutRegistrationModel } = require('./models/checkoutRegistrationModel');
const { createPreCheckoutLeadModel } = require('./models/preCheckoutLeadModel');
const { createSettingsModel } = require('./models/settingsModel');
const { createUserModel } = require('./models/userModel');
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

const Template = createTemplateModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger
});

// ============================================
// CAMPAIGNS
// ============================================

const Campaign = createCampaignModel({
    query,
    queryOne,
    run,
    generateUUID,
    parsePositiveInteger,
    normalizeBooleanFlag,
    toJsonStringOrNull
});

const CampaignSenderAccount = createCampaignSenderAccountModel({
    query,
    run,
    parseNonNegativeInteger,
    normalizeBooleanFlag
});

const WhatsAppSession = createWhatsAppSessionModel({
    query,
    queryOne,
    run,
    parsePositiveInteger,
    parseNonNegativeInteger,
    normalizeBooleanFlag,
    assertOwnerCanCreateWhatsAppSession,
    normalizeSessionScopeList,
    parsePlainObject,
    updateAutomation: async (id, payload) => await Automation.update(id, payload),
    settingsGet: async (key) => await Settings.get(key),
    settingsSet: async (key, value, type) => await Settings.set(key, value, type)
});

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

const SupportInboxMessage = createSupportInboxMessageModel({
    query,
    queryOne,
    run,
    parsePositiveInteger,
    parseNonNegativeInteger,
    toJsonStringOrNull
});

// ============================================
// CHECKOUT REGISTRATIONS
// ============================================

const CheckoutRegistration = createCheckoutRegistrationModel({
    queryOne,
    generateUUID,
    parsePositiveInteger,
    parseLeadCustomFields,
    toJsonStringOrNull
});

const PreCheckoutLead = createPreCheckoutLeadModel({
    queryOne,
    generateUUID,
    parsePositiveInteger,
    parseLeadCustomFields,
    toJsonStringOrNull
});

// ============================================
// SETTINGS
// ============================================

const Settings = createSettingsModel({
    query,
    queryOne,
    run
});

// ============================================
// USERS
// ============================================

const User = createUserModel({
    query,
    queryOne,
    run,
    generateUUID,
    deriveUserName
});

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






