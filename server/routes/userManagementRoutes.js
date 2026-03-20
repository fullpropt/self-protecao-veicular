const express = require('express');

function createUserManagementRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const normalizeUserRoleInput = options.normalizeUserRoleInput;
    const normalizeUserActiveInput = options.normalizeUserActiveInput;
    const isSameUserOwner = options.isSameUserOwner;
    const isUserActive = options.isUserActive;
    const isUserAdminRole = options.isUserAdminRole;
    const isPrimaryOwnerAdminUser = options.isPrimaryOwnerAdminUser;
    const countActiveAdminsByOwner = options.countActiveAdminsByOwner;
    const sanitizeUserPayload = options.sanitizeUserPayload;
    const markUserPresenceOffline = options.markUserPresenceOffline;
    const User = options.User;
    const hashPassword = options.hashPassword;

    router.post('/api/users', authenticate, async (req, res) => {
        try {
            const requesterRole = String(req.user?.role || '').toLowerCase();
            if (requesterRole !== 'admin') {
                return res.status(403).json({ success: false, error: 'Sem permissÃ£o para criar usuÃ¡rios' });
            }

            const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
            if (!requesterOwnerUserId) {
                return res.status(400).json({ success: false, error: 'Conta administradora invalida' });
            }

            const name = String(req.body?.name || '').trim();
            const email = String(req.body?.email || '').trim().toLowerCase();
            const password = String(req.body?.password || '');
            const role = normalizeUserRoleInput(req.body?.role);

            if (!name || !email || !password) {
                return res.status(400).json({ success: false, error: 'Nome, e-mail e senha sÃ£o obrigatÃ³rios' });
            }

            if (password.length < 6) {
                return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' });
            }

            const existing = await User.findActiveByEmail(email);
            if (existing) {
                return res.status(409).json({ success: false, error: 'E-mail jÃ¡ cadastrado' });
            }

            const created = await User.create({
                name,
                email,
                password_hash: hashPassword(password),
                role,
                owner_user_id: requesterOwnerUserId
            });

            const user = await User.findById(created.id);
            return res.json({ success: true, user: sanitizeUserPayload(user, requesterOwnerUserId) });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Erro ao criar usuÃ¡rio' });
        }
    });

    router.put('/api/users/:id', authenticate, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id, 10);
            if (!Number.isInteger(targetId) || targetId <= 0) {
                return res.status(400).json({ success: false, error: 'Usuário inválido' });
            }

            const requesterRole = String(req.user?.role || '').toLowerCase();
            const requesterId = Number(req.user?.id || 0);
            const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
            const isAdmin = requesterRole === 'admin';
            const isSelf = requesterId === targetId;

            if (!isAdmin && !isSelf) {
                return res.status(403).json({ success: false, error: 'Sem permissão para editar este usuário' });
            }

            const current = await User.findById(targetId);
            if (!current) {
                return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
            }

            if (isAdmin && !isSameUserOwner(current, requesterOwnerUserId)) {
                return res.status(403).json({ success: false, error: 'Sem permissao para editar este usuario' });
            }

            const currentIsActiveAdmin = isUserActive(current) && isUserAdminRole(current.role);
            const isPrimaryOwnerAdmin = isPrimaryOwnerAdminUser(current, requesterOwnerUserId);
            const payload = {};

            if (isPrimaryOwnerAdmin && requesterId !== targetId) {
                return res.status(403).json({ success: false, error: 'Somente o admin principal pode editar os proprios dados' });
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
                const name = String(req.body?.name || '').trim();
                if (!name) {
                    return res.status(400).json({ success: false, error: 'Nome Ã© obrigatÃ³rio' });
                }
                payload.name = name;
            }

            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
                const email = String(req.body?.email || '').trim().toLowerCase();
                const currentEmail = String(current.email || '').trim().toLowerCase();
                if (email && email !== currentEmail) {
                    return res.status(400).json({ success: false, error: 'Nao e permitido alterar o e-mail neste cadastro' });
                }
            }

            if (isAdmin && Object.prototype.hasOwnProperty.call(req.body || {}, 'role')) {
                payload.role = normalizeUserRoleInput(req.body?.role);
                if (isPrimaryOwnerAdmin && !isUserAdminRole(payload.role)) {
                    return res.status(400).json({ success: false, error: 'Nao e permitido rebaixar o admin principal da conta' });
                }
            }

            if (isAdmin && Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
                payload.is_active = normalizeUserActiveInput(req.body?.is_active, Number(current.is_active) > 0 ? 1 : 0);
                if (isPrimaryOwnerAdmin && Number(payload.is_active) === 0) {
                    return res.status(400).json({ success: false, error: 'Nao e permitido desativar o admin principal da conta' });
                }
                if (Number(current.id) === requesterId && Number(payload.is_active) === 0) {
                    return res.status(400).json({ success: false, error: 'NÃ£o Ã© possÃ­vel desativar o prÃ³prio usuÃ¡rio' });
                }
            }

            const nextRole = Object.prototype.hasOwnProperty.call(payload, 'role') ? payload.role : current.role;
            const nextIsActive = Object.prototype.hasOwnProperty.call(payload, 'is_active')
                ? (Number(payload.is_active) > 0 ? 1 : 0)
                : (isUserActive(current) ? 1 : 0);
            const willStopBeingActiveAdmin = currentIsActiveAdmin && (!isUserAdminRole(nextRole) || Number(nextIsActive) === 0);

            if (isPrimaryOwnerAdmin && willStopBeingActiveAdmin) {
                return res.status(400).json({ success: false, error: 'O admin principal da conta deve permanecer ativo como admin' });
            }

            if (willStopBeingActiveAdmin) {
                const activeAdminCount = await countActiveAdminsByOwner(requesterOwnerUserId);
                if (activeAdminCount <= 1) {
                    return res.status(400).json({ success: false, error: 'E necessario manter pelo menos um administrador ativo' });
                }
            }
            await User.update(targetId, payload);
            if (Object.prototype.hasOwnProperty.call(payload, 'is_active') && Number(payload.is_active) === 0) {
                markUserPresenceOffline(targetId);
            }
            const updated = await User.findById(targetId);
            return res.json({ success: true, user: sanitizeUserPayload(updated, requesterOwnerUserId) });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Erro ao atualizar usuÃ¡rio' });
        }
    });

    router.delete('/api/users/:id', authenticate, async (req, res) => {
        try {
            const requesterRole = String(req.user?.role || '').toLowerCase();
            const requesterId = Number(req.user?.id || 0);
            const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
            if (requesterRole !== 'admin') {
                return res.status(403).json({ success: false, error: 'Sem permissao para remover usuarios' });
            }

            const targetId = parseInt(req.params.id, 10);
            if (!Number.isInteger(targetId) || targetId <= 0) {
                return res.status(400).json({ success: false, error: 'Usuario invalido' });
            }

            if (targetId === requesterId) {
                return res.status(400).json({ success: false, error: 'Nao e possivel remover o proprio usuario' });
            }

            const current = await User.findById(targetId);
            if (!current) {
                return res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
            }
            if (!isSameUserOwner(current, requesterOwnerUserId)) {
                return res.status(403).json({ success: false, error: 'Sem permissao para remover este usuario' });
            }
            if (isPrimaryOwnerAdminUser(current, requesterOwnerUserId)) {
                return res.status(400).json({ success: false, error: 'Nao e permitido remover o admin principal da conta' });
            }

            const isTargetActiveAdmin = isUserActive(current) && isUserAdminRole(current.role);
            if (isTargetActiveAdmin) {
                const activeAdminCount = await countActiveAdminsByOwner(requesterOwnerUserId);
                if (activeAdminCount <= 1) {
                    return res.status(400).json({ success: false, error: 'E necessario manter pelo menos um administrador ativo' });
                }
            }

            await User.update(targetId, { is_active: 0 });
            markUserPresenceOffline(targetId);
            const updated = await User.findById(targetId);
            return res.json({ success: true, user: sanitizeUserPayload(updated, requesterOwnerUserId) });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Erro ao remover usuario' });
        }
    });

    return router;
}

module.exports = {
    createUserManagementRoutes
};
