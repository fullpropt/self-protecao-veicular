function createContactFieldController(options = {}) {
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const buildScopedSettingsKey = options.buildScopedSettingsKey;
    const Settings = options.Settings;

    const DEFAULT_CONTACT_FIELDS = Object.freeze([
        {
            key: 'nome',
            label: 'Nome',
            source: 'name',
            is_default: true,
            required: true,
            placeholder: 'Nome completo'
        },
        {
            key: 'telefone',
            label: 'Telefone',
            source: 'phone',
            is_default: true,
            required: true,
            placeholder: 'Somente n\u00FAmeros com DDD'
        },
        {
            key: 'email',
            label: 'Email',
            source: 'email',
            is_default: true,
            required: false,
            placeholder: 'email@exemplo.com'
        }
    ]);

    function normalizeContactFieldLabelInput(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    }

    function normalizeContactFieldPlaceholderInput(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function normalizeContactFieldKey(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40);
    }

    function sanitizeContactFieldDefinition(rawField) {
        if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) return null;

        const label = normalizeContactFieldLabelInput(rawField.label || rawField.name || rawField.key);
        const key = normalizeContactFieldKey(rawField.key || label);
        if (!label || !key || key === '__system') return null;
        if (DEFAULT_CONTACT_FIELDS.some((field) => field.key === key)) return null;

        return {
            key,
            label,
            placeholder: normalizeContactFieldPlaceholderInput(rawField.placeholder)
        };
    }

    function sanitizeStoredContactFields(rawValue) {
        const sourceList = Array.isArray(rawValue)
            ? rawValue
            : (rawValue && typeof rawValue === 'object' && Array.isArray(rawValue.fields) ? rawValue.fields : []);

        const dedupe = new Set();
        const result = [];

        for (const item of sourceList) {
            const sanitized = sanitizeContactFieldDefinition(item);
            if (!sanitized) continue;
            if (dedupe.has(sanitized.key)) continue;
            dedupe.add(sanitized.key);
            result.push(sanitized);
        }

        return result;
    }

    async function getContactFieldConfig(ownerUserId = null) {
        const settingsKey = buildScopedSettingsKey('contact_data_fields', ownerUserId);
        const raw = await Settings.get(settingsKey);
        const customFields = sanitizeStoredContactFields(raw);
        const defaultFields = DEFAULT_CONTACT_FIELDS.map((field) => ({ ...field }));
        const fields = [
            ...defaultFields,
            ...customFields.map((field) => ({
                ...field,
                source: 'custom',
                is_default: false,
                required: false
            }))
        ];

        return { fields, defaultFields, customFields };
    }

    return {
        async listContactFields(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const payload = await getContactFieldConfig(ownerScopeUserId);
                return res.json({ success: true, ...payload });
            } catch (error) {
                console.error('Falha ao carregar campos de contato:', error);
                return res.status(500).json({ success: false, error: 'Erro ao carregar campos de contato' });
            }
        },

        async updateContactFields(req, res) {
            try {
                const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
                const settingsKey = buildScopedSettingsKey('contact_data_fields', ownerScopeUserId);
                const incoming = Array.isArray(req.body?.fields) ? req.body.fields : [];
                const customFields = sanitizeStoredContactFields(incoming);
                await Settings.set(settingsKey, customFields, 'json');
                const payload = await getContactFieldConfig(ownerScopeUserId);
                return res.json({ success: true, ...payload });
            } catch (error) {
                console.error('Falha ao salvar campos de contato:', error);
                return res.status(500).json({ success: false, error: 'Erro ao salvar campos de contato' });
            }
        }
    };
}

module.exports = {
    createContactFieldController
};
