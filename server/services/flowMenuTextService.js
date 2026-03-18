function createFlowMenuTextService(options = {}) {
    const normalizeText = typeof options.normalizeText === 'function'
        ? options.normalizeText
        : (value) => value;
    const applyLeadTemplate = typeof options.applyLeadTemplate === 'function'
        ? options.applyLeadTemplate
        : (template = '') => String(template || '');

    function normalizeListSectionsForSend(rawSections, lead, messageText = '') {
        const sourceSections = Array.isArray(rawSections) ? rawSections : [];
        if (sourceSections.length === 0) return [];

        const normalizedSections = [];
        let totalRows = 0;

        for (const section of sourceSections) {
            if (totalRows >= 10) break;

            const rawRows = Array.isArray(section?.rows) ? section.rows : [];
            const rows = [];

            for (const row of rawRows) {
                if (totalRows >= 10) break;

                const rowId = normalizeText(row?.rowId || row?.id || '');
                const rawTitle = String(row?.title || row?.text || '').trim();
                if (!rawTitle) continue;

                const title = normalizeText(applyLeadTemplate(rawTitle, lead, { mensagem: messageText || rawTitle }));
                if (!title) continue;

                const rawDescription = String(row?.description || '').trim();
                const description = rawDescription
                    ? normalizeText(applyLeadTemplate(rawDescription, lead, { mensagem: rawDescription }))
                    : '';

                rows.push({
                    rowId: rowId || `option-${totalRows + 1}`,
                    title,
                    description: description || undefined
                });
                totalRows += 1;
            }

            if (rows.length === 0) continue;

            const rawSectionTitle = String(section?.title || '').trim();
            const sectionTitle = rawSectionTitle
                ? normalizeText(applyLeadTemplate(rawSectionTitle, lead, { mensagem: messageText || rawSectionTitle }))
                : '';

            normalizedSections.push({
                title: sectionTitle || `Opções ${normalizedSections.length + 1}`,
                rows
            });
        }

        return normalizedSections;
    }

    function normalizeButtonUrlForSend(value) {
        const raw = normalizeText(String(value || '').trim());
        if (!raw) return '';

        const normalized = /^https?:\/\//i.test(raw)
            ? raw
            : `https://${raw}`;

        try {
            const parsed = new URL(normalized);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return parsed.toString();
        } catch (_) {
            return '';
        }
    }

    function buildInlineListFallbackText(description = '', sections = []) {
        const prompt = String(description || '').trim() || 'Escolha uma opção no menu abaixo:';
        const numberedLines = [];
        let index = 1;

        for (const section of (Array.isArray(sections) ? sections : [])) {
            const rows = Array.isArray(section?.rows) ? section.rows : [];
            for (const row of rows) {
                const title = String(row?.title || '').trim();
                if (!title) continue;
                numberedLines.push(`${index}. ${title}`);
                index += 1;
            }
        }

        const lines = [prompt];
        if (numberedLines.length > 0) {
            lines.push('');
            lines.push(...numberedLines);
            lines.push('');
            lines.push('_Responda com o número da opção desejada._');
        }

        return lines.join('\n').trim();
    }

    return {
        normalizeListSectionsForSend,
        normalizeButtonUrlForSend,
        buildInlineListFallbackText
    };
}

module.exports = {
    createFlowMenuTextService
};
