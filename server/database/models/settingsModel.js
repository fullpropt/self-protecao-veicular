function createSettingsModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;

    return {
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
}

module.exports = {
    createSettingsModel
};
