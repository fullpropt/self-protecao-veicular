const express = require('express');

function createAdminDashboardManagementRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const ensureApplicationAdmin = options.ensureApplicationAdmin;
    const User = options.User;
    const normalizeOwnerUserId = options.normalizeOwnerUserId;
    const isPrimaryOwnerAdminUser = options.isPrimaryOwnerAdminUser;
    const normalizeUserRoleInput = options.normalizeUserRoleInput;
    const isUserAdminRole = options.isUserAdminRole;
    const countActiveAdminsByOwner = options.countActiveAdminsByOwner;
    const normalizeUserActiveInput = options.normalizeUserActiveInput;
    const isValidEmailAddress = options.isValidEmailAddress;
    const Settings = options.Settings;
    const buildScopedSettingsKey = options.buildScopedSettingsKey;
    const markUserPresenceOffline = options.markUserPresenceOffline;
    const run = options.run;
    const normalizePlanStatusForApi = options.normalizePlanStatusForApi;
    const normalizeOptionalIsoDate = options.normalizeOptionalIsoDate;
    const buildApplicationAdminOverview = options.buildApplicationAdminOverview;
    const sanitizeUserPayload = options.sanitizeUserPayload;

    router.put('/api/admin/dashboard/users/:id', authenticate, async (req, res) => {
        if (!ensureApplicationAdmin(req, res)) return;
    
        try {
            const targetId = parseInt(String(req.params?.id || ''), 10);
            if (!Number.isInteger(targetId) || targetId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Usuario invalido'
                });
            }
    
            const current = await User.findById(targetId);
            if (!current) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario nao encontrado'
                });
            }
    
            const ownerUserId = normalizeOwnerUserId(current.owner_user_id) || Number(current.id || 0);
            const isPrimaryOwnerAdmin = isPrimaryOwnerAdminUser(current, ownerUserId);
            const requesterId = Number(req.user?.id || 0);
            const payload = {};
            const body = req.body && typeof req.body === 'object' ? req.body : {};
    
            if (Object.prototype.hasOwnProperty.call(body, 'name')) {
                const name = String(body.name || '').trim();
                if (!name) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nome e obrigatorio'
                    });
                }
                payload.name = name;
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'email')) {
                const email = String(body.email || '').trim().toLowerCase();
                if (!email || !isValidEmailAddress(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Informe um e-mail valido'
                    });
                }
    
                const existing = await User.findActiveByEmail(email);
                if (existing && Number(existing.id) !== targetId) {
                    return res.status(409).json({
                        success: false,
                        error: 'E-mail ja cadastrado para outro usuario'
                    });
                }
    
                payload.email = email;
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'role')) {
                payload.role = normalizeUserRoleInput(body.role);
                if (isPrimaryOwnerAdmin && !isUserAdminRole(payload.role)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nao e permitido rebaixar o admin principal da conta'
                    });
                }
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
                payload.is_active = normalizeUserActiveInput(body.is_active, Number(current.is_active) > 0 ? 1 : 0);
                if (isPrimaryOwnerAdmin && Number(payload.is_active) === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nao e permitido desativar o admin principal da conta'
                    });
                }
                if (requesterId === targetId && Number(payload.is_active) === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nao e possivel desativar o proprio usuario'
                    });
                }
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'email_confirmed')) {
                const confirmed = Number(body.email_confirmed) > 0;
                payload.email_confirmed = confirmed ? 1 : 0;
                payload.email_confirmed_at = confirmed ? new Date().toISOString() : null;
                payload.email_confirmation_token_hash = null;
                payload.email_confirmation_expires_at = null;
            }
    
            if (!Object.keys(payload).length) {
                return res.json({
                    success: true,
                    user: sanitizeUserPayload(current, ownerUserId)
                });
            }
    
            await User.update(targetId, payload);
            if (Object.prototype.hasOwnProperty.call(payload, 'is_active') && Number(payload.is_active) === 0) {
                markUserPresenceOffline(targetId);
            }
    
            const updated = await User.findById(targetId);
            return res.json({
                success: true,
                user: sanitizeUserPayload(updated, ownerUserId)
            });
        } catch (error) {
            console.error('[admin/dashboard/users:put] falha:', error);
            return res.status(500).json({
                success: false,
                error: 'Falha ao atualizar usuario'
            });
        }
    });
    
    router.delete('/api/admin/dashboard/users/:id', authenticate, async (req, res) => {
        if (!ensureApplicationAdmin(req, res)) return;
    
        try {
            const targetId = parseInt(String(req.params?.id || ''), 10);
            if (!Number.isInteger(targetId) || targetId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Usuario invalido'
                });
            }
    
            const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
            const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);
    
            const requesterId = Number(req.user?.id || 0);
            if (requesterId === targetId) {
                return res.status(400).json({
                    success: false,
                    error: hardDelete
                        ? 'Nao e possivel excluir o proprio usuario'
                        : 'Nao e possivel desativar o proprio usuario'
                });
            }
    
            const current = await User.findById(targetId);
            if (!current) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario nao encontrado'
                });
            }
    
            const ownerUserId = normalizeOwnerUserId(current.owner_user_id) || Number(current.id || 0);
            if (isPrimaryOwnerAdminUser(current, ownerUserId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Use a acao de desativar conta para remover o admin principal'
                });
            }
    
            if (!hardDelete) {
                await User.update(targetId, { is_active: 0 });
                markUserPresenceOffline(targetId);
                const updated = await User.findById(targetId);
                return res.json({
                    success: true,
                    user: sanitizeUserPayload(updated, ownerUserId)
                });
            }
    
            const fallbackOwnerUserId = ownerUserId && ownerUserId !== targetId ? ownerUserId : null;
            const fallbackAssignedUserId = Number.isInteger(fallbackOwnerUserId) && fallbackOwnerUserId > 0
                ? fallbackOwnerUserId
                : null;
    
            const runSafeReferenceUpdate = async (sql, params = []) => {
                try {
                    await run(sql, params);
                } catch (error) {
                    const message = String(error?.message || '').toLowerCase();
                    if (
                        message.includes('does not exist') ||
                        message.includes('undefined table') ||
                        message.includes('undefined column')
                    ) {
                        return;
                    }
                    throw error;
                }
            };
    
            await run('BEGIN');
            try {
                await run(
                    'UPDATE users SET owner_user_id = ? WHERE owner_user_id = ? AND id <> ?',
                    [fallbackAssignedUserId, targetId, targetId]
                );
                await run(
                    'UPDATE leads SET assigned_to = ? WHERE assigned_to = ?',
                    [fallbackAssignedUserId, targetId]
                );
                await run(
                    'UPDATE leads SET owner_user_id = ? WHERE owner_user_id = ?',
                    [fallbackAssignedUserId, targetId]
                );
                await run(
                    'UPDATE conversations SET assigned_to = ? WHERE assigned_to = ?',
                    [fallbackAssignedUserId, targetId]
                );
    
                const createdByTables = [
                    'flows',
                    'templates',
                    'campaigns',
                    'automations',
                    'custom_events',
                    'webhooks',
                    'whatsapp_sessions',
                    'tags'
                ];
    
                for (const tableName of createdByTables) {
                    await runSafeReferenceUpdate(
                        `UPDATE ${tableName} SET created_by = ? WHERE created_by = ?`,
                        [fallbackAssignedUserId, targetId]
                    );
                }
    
                await runSafeReferenceUpdate(
                    'UPDATE tenant_integrity_audit_runs SET owner_user_id = ? WHERE owner_user_id = ?',
                    [fallbackAssignedUserId, targetId]
                );
                await runSafeReferenceUpdate(
                    'UPDATE audit_logs SET user_id = NULL WHERE user_id = ?',
                    [targetId]
                );
    
                await run('DELETE FROM users WHERE id = ?', [targetId]);
                await run('COMMIT');
            } catch (error) {
                try {
                    await run('ROLLBACK');
                } catch (_) {
                    // ignore rollback failure
                }
                throw error;
            }
    
            markUserPresenceOffline(targetId);
            return res.json({
                success: true,
                deleted: true,
                user_id: targetId
            });
        } catch (error) {
            console.error('[admin/dashboard/users:delete] falha:', error);
            return res.status(500).json({
                success: false,
                error: 'Falha ao remover usuario'
            });
        }
    });
    
    router.put('/api/admin/dashboard/accounts/:ownerUserId', authenticate, async (req, res) => {
        if (!ensureApplicationAdmin(req, res)) return;
    
        try {
            const ownerUserId = parseInt(String(req.params?.ownerUserId || ''), 10);
            if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Conta invalida'
                });
            }
    
            const ownerUser = await User.findById(ownerUserId);
            if (!ownerUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Conta nao encontrada'
                });
            }
    
            const requesterId = Number(req.user?.id || 0);
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const userPayload = {};
            const shouldReactivateAllUsers = normalizeUserActiveInput(
                body.reactivate_all_users ?? body.reactivateAllUsers,
                0
            ) === 1;
    
            if (Object.prototype.hasOwnProperty.call(body, 'name')) {
                const name = String(body.name || '').trim();
                if (!name) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nome do admin principal e obrigatorio'
                    });
                }
                userPayload.name = name;
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'email')) {
                const email = String(body.email || '').trim().toLowerCase();
                if (!email || !isValidEmailAddress(email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Informe um e-mail valido'
                    });
                }
    
                const existing = await User.findActiveByEmail(email);
                if (existing && Number(existing.id) !== ownerUserId) {
                    return res.status(409).json({
                        success: false,
                        error: 'E-mail ja cadastrado para outra conta'
                    });
                }
                userPayload.email = email;
            }
    
            if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
                userPayload.is_active = normalizeUserActiveInput(body.is_active, Number(ownerUser.is_active) > 0 ? 1 : 0);
                if (requesterId === ownerUserId && Number(userPayload.is_active) === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nao e possivel desativar a propria conta de administrador'
                    });
                }
            }
    
            const hasCompanyNamePayload =
                Object.prototype.hasOwnProperty.call(body, 'company_name')
                || Object.prototype.hasOwnProperty.call(body, 'companyName');
            if (hasCompanyNamePayload) {
                const companyName = String(body.company_name ?? body.companyName ?? '').trim();
                if (!companyName) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nome da empresa Ã© obrigatÃ³rio'
                    });
                }
                await Settings.set(buildScopedSettingsKey('company_name', ownerUserId), companyName, 'string');
            }
    
            userPayload.role = 'admin';
            userPayload.owner_user_id = ownerUserId;
            await User.update(ownerUserId, userPayload);
            if (Number(userPayload.is_active) === 0) {
                markUserPresenceOffline(ownerUserId);
            }
            let reactivatedUsers = 0;
            if (Number(userPayload.is_active) === 1 && shouldReactivateAllUsers) {
                const usersInAccount = await User.listByOwner(ownerUserId, { includeInactive: true });
                const usersById = new Map();
    
                for (const user of Array.isArray(usersInAccount) ? usersInAccount : []) {
                    const userId = Number(user?.id || 0);
                    if (userId > 0) usersById.set(userId, user);
                }
                if (!usersById.has(ownerUserId)) {
                    usersById.set(ownerUserId, ownerUser);
                }
    
                for (const user of usersById.values()) {
                    const userId = Number(user?.id || 0);
                    if (!userId) continue;
                    await User.update(userId, { is_active: 1 });
                    reactivatedUsers += 1;
                }
    
                await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), 'active', 'string');
                await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), 'Conta reativada pelo administrador da aplicacao.', 'string');
                await Settings.set(buildScopedSettingsKey('plan_last_verified_at', ownerUserId), new Date().toISOString(), 'string');
            }
    
            const hasPlanPayload = Object.prototype.hasOwnProperty.call(body, 'plan') && body.plan && typeof body.plan === 'object';
            if (hasPlanPayload) {
                const plan = body.plan;
                if (Object.prototype.hasOwnProperty.call(plan, 'name')) {
                    await Settings.set(buildScopedSettingsKey('plan_name', ownerUserId), String(plan.name || '').trim(), 'string');
                }
                if (Object.prototype.hasOwnProperty.call(plan, 'code')) {
                    await Settings.set(buildScopedSettingsKey('plan_code', ownerUserId), String(plan.code || '').trim(), 'string');
                }
                if (Object.prototype.hasOwnProperty.call(plan, 'status')) {
                    const normalizedStatus = normalizePlanStatusForApi(plan.status);
                    await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), normalizedStatus, 'string');
                }
                if (Object.prototype.hasOwnProperty.call(plan, 'provider')) {
                    await Settings.set(buildScopedSettingsKey('plan_provider', ownerUserId), String(plan.provider || '').trim(), 'string');
                }
                if (Object.prototype.hasOwnProperty.call(plan, 'message')) {
                    await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), String(plan.message || '').trim(), 'string');
                }
                if (Object.prototype.hasOwnProperty.call(plan, 'renewal_date')) {
                    const renewalDate = normalizeOptionalIsoDate(plan.renewal_date);
                    await Settings.set(buildScopedSettingsKey('plan_renewal_date', ownerUserId), renewalDate || '', 'string');
                }
            }
    
            const overview = await buildApplicationAdminOverview();
            const account = (Array.isArray(overview.accounts) ? overview.accounts : [])
                .find((item) => Number(item.owner_user_id || 0) === ownerUserId) || null;
    
            return res.json({
                success: true,
                account,
                reactivated_users: reactivatedUsers
            });
        } catch (error) {
            console.error('[admin/dashboard/accounts:put] falha:', error);
            return res.status(500).json({
                success: false,
                error: 'Falha ao atualizar conta'
            });
        }
    });
    
    router.delete('/api/admin/dashboard/accounts/:ownerUserId', authenticate, async (req, res) => {
        if (!ensureApplicationAdmin(req, res)) return;
    
        try {
            const ownerUserId = parseInt(String(req.params?.ownerUserId || ''), 10);
            if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Conta invalida'
                });
            }
    
            const ownerUser = await User.findById(ownerUserId);
            if (!ownerUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Conta nao encontrada'
                });
            }
    
            const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
            const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);
            const users = await User.listByOwner(ownerUserId, { includeInactive: true });
            const usersById = new Map();
    
            for (const user of Array.isArray(users) ? users : []) {
                const userId = Number(user?.id || 0);
                if (userId > 0) {
                    usersById.set(userId, user);
                }
            }
    
            // Fallback para contas legadas em que owner_user_id ainda nao foi preenchido corretamente.
            if (!usersById.has(ownerUserId)) {
                usersById.set(ownerUserId, ownerUser);
            }
    
            const usersInAccount = Array.from(usersById.values());
            if (usersInAccount.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Conta nao encontrada'
                });
            }
    
            if (hardDelete) {
                const userIds = usersInAccount
                    .map((user) => Number(user?.id || 0))
                    .filter((id) => Number.isInteger(id) && id > 0);
    
                const runSafeReferenceUpdate = async (sql, params = []) => {
                    try {
                        await run(sql, params);
                    } catch (error) {
                        const message = String(error?.message || '').toLowerCase();
                        if (
                            message.includes('does not exist')
                            || message.includes('undefined table')
                            || message.includes('undefined column')
                        ) {
                            return;
                        }
                        throw error;
                    }
                };
    
                await run('BEGIN');
                try {
                    if (userIds.length > 0) {
                        const placeholders = userIds.map(() => '?').join(', ');
                        await runSafeReferenceUpdate(
                            `UPDATE users SET owner_user_id = NULL WHERE owner_user_id IN (${placeholders})`,
                            userIds
                        );
                        await runSafeReferenceUpdate(
                            `UPDATE leads SET assigned_to = NULL WHERE assigned_to IN (${placeholders})`,
                            userIds
                        );
                        await runSafeReferenceUpdate(
                            `UPDATE leads SET owner_user_id = NULL WHERE owner_user_id IN (${placeholders})`,
                            userIds
                        );
                        await runSafeReferenceUpdate(
                            `UPDATE conversations SET assigned_to = NULL WHERE assigned_to IN (${placeholders})`,
                            userIds
                        );
    
                        const createdByTables = [
                            'flows',
                            'templates',
                            'campaigns',
                            'automations',
                            'custom_events',
                            'webhooks',
                            'whatsapp_sessions',
                            'tags'
                        ];
    
                        for (const tableName of createdByTables) {
                            await runSafeReferenceUpdate(
                                `UPDATE ${tableName} SET created_by = NULL WHERE created_by IN (${placeholders})`,
                                userIds
                            );
                        }
    
                        await runSafeReferenceUpdate(
                            `UPDATE audit_logs SET user_id = NULL WHERE user_id IN (${placeholders})`,
                            userIds
                        );
                    }
    
                    const ownerScopedTables = [
                        'flows',
                        'templates',
                        'campaigns',
                        'automations',
                        'custom_events',
                        'webhooks',
                        'whatsapp_sessions',
                        'tags',
                        'tenant_integrity_audit_runs'
                    ];
    
                    for (const tableName of ownerScopedTables) {
                        await runSafeReferenceUpdate(
                            `DELETE FROM ${tableName} WHERE owner_user_id = ?`,
                            [ownerUserId]
                        );
                    }
    
                    await runSafeReferenceUpdate(
                        'DELETE FROM settings WHERE key LIKE ?',
                        [`user:${ownerUserId}:%`]
                    );
    
                    if (userIds.length > 0) {
                        const placeholders = userIds.map(() => '?').join(', ');
                        await runSafeReferenceUpdate(
                            `DELETE FROM users WHERE id IN (${placeholders})`,
                            userIds
                        );
                    }
    
                    await run('COMMIT');
                } catch (error) {
                    try {
                        await run('ROLLBACK');
                    } catch (_) {
                        // ignore rollback failure
                    }
                    throw error;
                }
    
                for (const userId of userIds) {
                    markUserPresenceOffline(userId);
                }
    
                return res.json({
                    success: true,
                    owner_user_id: ownerUserId,
                    deleted_account: true,
                    deleted_users: userIds.length
                });
            }
    
            let disabledUsers = 0;
            for (const user of usersInAccount) {
                const userId = Number(user?.id || 0);
                if (!userId) continue;
                await User.update(userId, { is_active: 0 });
                markUserPresenceOffline(userId);
                disabledUsers += 1;
            }
    
            await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), 'canceled', 'string');
            await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), 'Conta desativada pelo administrador da aplicacao.', 'string');
            await Settings.set(buildScopedSettingsKey('plan_last_verified_at', ownerUserId), new Date().toISOString(), 'string');
    
            return res.json({
                success: true,
                owner_user_id: ownerUserId,
                disabled_users: disabledUsers
            });
        } catch (error) {
            console.error('[admin/dashboard/accounts:delete] falha:', error);
            const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
            const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);
            return res.status(500).json({
                success: false,
                error: hardDelete
                    ? `Falha ao excluir conta: ${String(error?.message || 'erro interno')}`
                    : 'Falha ao desativar conta'
            });
        }
    });
    return router;
}

module.exports = {
    createAdminDashboardManagementRoutes
};
