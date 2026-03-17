function createUserModel(options = {}) {
    const query = options.query;
    const queryOne = options.queryOne;
    const run = options.run;
    const generateUUID = options.generateUUID;
    const deriveUserName = options.deriveUserName;

    return {
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
            return await run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
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
}

module.exports = {
    createUserModel
};
