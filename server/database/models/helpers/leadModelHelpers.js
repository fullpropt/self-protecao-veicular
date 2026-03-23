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
        currentLower === 'voc\u00ea' ||
        currentLower === 'voce' ||
        currentLower === 'usu\u00e1rio (voc\u00ea)' ||
        currentLower === 'usuario (voce)' ||
        currentLower === 'usuario (voc\u00ea)'
    ) {
        return true;
    }

    const phoneDigits = normalizeDigits(phone);
    const currentDigits = normalizeDigits(current);
    if (phoneDigits && currentDigits && currentDigits === phoneDigits) return true;
    if (/^\d+$/.test(current)) return true;

    return false;
}

function parseLeadOwnerScopeOption(options, parsePositiveInteger) {
    if (typeof options === 'number') {
        return parsePositiveInteger(options, null);
    }
    if (!options || typeof options !== 'object') return null;
    return parsePositiveInteger(
        options.owner_user_id !== undefined ? options.owner_user_id : options.ownerUserId,
        null
    );
}

async function resolveLeadOwnerUserIdInput(data = {}, queryOne, parsePositiveInteger) {
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

function appendLeadOwnerScopeFilter(sql, params, ownerUserId, parsePositiveInteger, tableAlias = 'leads') {
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

async function executeLeadCleanupQuery(client, statement, leadId) {
    try {
        await client.query(statement, [leadId]);
    } catch (error) {
        // In partially migrated environments, some tables or columns may not exist yet.
        if (error && (error.code === '42P01' || error.code === '42703')) return;
        throw error;
    }
}

function createLeadModelHelpers(options = {}) {
    const queryOne = options.queryOne;
    const parsePositiveInteger = options.parsePositiveInteger;

    if (typeof queryOne !== 'function') {
        throw new Error('createLeadModelHelpers requires queryOne');
    }
    if (typeof parsePositiveInteger !== 'function') {
        throw new Error('createLeadModelHelpers requires parsePositiveInteger');
    }

    return {
        normalizeDigits,
        normalizeLeadPhoneForStorage,
        buildLeadJidFromPhone,
        sanitizeLeadName,
        parseLeadCustomFields,
        mergeLeadCustomFields,
        lockLeadNameAsManual,
        isLeadNameManuallyLocked,
        shouldReplaceLeadName,
        parseLeadOwnerScopeOption: (scope) => parseLeadOwnerScopeOption(scope, parsePositiveInteger),
        resolveLeadOwnerUserIdInput: (data) => resolveLeadOwnerUserIdInput(data, queryOne, parsePositiveInteger),
        appendLeadOwnerScopeFilter: (sql, params, ownerUserId, tableAlias) => (
            appendLeadOwnerScopeFilter(sql, params, ownerUserId, parsePositiveInteger, tableAlias)
        ),
        executeLeadCleanupQuery
    };
}

module.exports = {
    createLeadModelHelpers
};
