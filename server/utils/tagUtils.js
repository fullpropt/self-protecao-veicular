function normalizeTagLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTagKey(value) {
    return normalizeTagLabel(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function splitLegacyTagString(raw = '') {
    return String(raw || '')
        .split(/[,;|]/)
        .map((item) => normalizeTagLabel(item))
        .filter(Boolean);
}

function parseTagList(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return [];

    if (Array.isArray(rawValue)) {
        return rawValue
            .map((item) => normalizeTagLabel(item))
            .filter(Boolean);
    }

    let parsed = rawValue;
    if (typeof parsed === 'string') {
        const raw = parsed.trim();
        if (!raw) return [];

        try {
            parsed = JSON.parse(raw);
        } catch (_) {
            return splitLegacyTagString(raw);
        }
    }

    if (!Array.isArray(parsed)) {
        parsed = [parsed];
    }

    return parsed
        .map((item) => normalizeTagLabel(item))
        .filter(Boolean);
}

function uniqueTagLabels(values = []) {
    const seen = new Set();
    const output = [];

    for (const value of parseTagList(values)) {
        const key = normalizeTagKey(value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        output.push(value);
    }

    return output;
}

function normalizeTagFilterInput(value) {
    if (value === undefined) return undefined;
    const tags = uniqueTagLabels(value);
    if (!tags.length) return null;
    return JSON.stringify(tags);
}

module.exports = {
    normalizeTagLabel,
    normalizeTagKey,
    parseTagList,
    uniqueTagLabels,
    normalizeTagFilterInput
};
