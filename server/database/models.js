/**
 * SELF PROTECAO VEICULAR - Modelos de Dados
 * Funcoes CRUD para todas as entidades do sistema
 */

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
const {
    createLeadModelHelpers
} = require('./models/helpers/leadModelHelpers');
const {
    normalizeFlowSessionScope,
    resolvePersistedFlowBuilderMode,
    hydrateFlowRecord,
    normalizeFlowKeywordText,
    extractFlowKeywords,
    includesFlowKeyword,
    scoreFlowKeywordMatch,
    compareFlowKeywordScoreDesc
} = require('./models/helpers/flowModelHelpers');
const {
    toJsonStringOrNull,
    parseNonNegativeInteger,
    parsePositiveInteger,
    normalizeBooleanFlag,
    normalizeSessionScopeList,
    parsePlainObject
} = require('./models/helpers/scalarHelpers');
const {
    INCOMING_WEBHOOK_SECRET_MIN_LENGTH,
    normalizeIncomingWebhookSecret,
    hashIncomingWebhookSecret,
    generateIncomingWebhookSecret,
    buildIncomingWebhookSecretPreview
} = require('./models/helpers/incomingWebhookSecretHelpers');

const {
    normalizeDigits,
    normalizeLeadPhoneForStorage,
    buildLeadJidFromPhone,
    sanitizeLeadName,
    parseLeadCustomFields,
    lockLeadNameAsManual,
    parseLeadOwnerScopeOption,
    resolveLeadOwnerUserIdInput,
    appendLeadOwnerScopeFilter,
    isLeadNameManuallyLocked,
    shouldReplaceLeadName,
    executeLeadCleanupQuery
} = createLeadModelHelpers({
    queryOne,
    parsePositiveInteger
});

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
