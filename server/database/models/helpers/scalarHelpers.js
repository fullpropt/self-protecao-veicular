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

function normalizeBooleanFlag(value, fallback = 1) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return 1;
        if (['0', 'false', 'no', 'nao', 'n\u00e3o', 'off'].includes(normalized)) return 0;
    }
    return fallback;
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

module.exports = {
    toJsonStringOrNull,
    parseNonNegativeInteger,
    parsePositiveInteger,
    normalizeBooleanFlag,
    normalizeSessionScopeList,
    parsePlainObject
};
