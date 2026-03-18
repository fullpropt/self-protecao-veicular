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

module.exports = {
    normalizeFlowSessionScope,
    resolvePersistedFlowBuilderMode,
    hydrateFlowRecord,
    normalizeFlowKeywordText,
    extractFlowKeywords,
    includesFlowKeyword,
    scoreFlowKeywordMatch,
    compareFlowKeywordScoreDesc
};
