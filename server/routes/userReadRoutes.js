const express = require('express');

function createUserReadRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const resolveRequesterOwnerUserId = options.resolveRequesterOwnerUserId;
    const User = options.User;
    const isUserActive = options.isUserActive;
    const sanitizeUserPayload = options.sanitizeUserPayload;

    router.get('/api/users', authenticate, async (req, res) => {
        try {
            const requesterRole = String(req.user?.role || '').toLowerCase();
            const requesterId = Number(req.user?.id || 0);
            const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
            const isAdmin = requesterRole === 'admin';

            let users = [];
            if (isAdmin) {
                users = requesterOwnerUserId
                    ? await User.listByOwner(requesterOwnerUserId, { includeInactive: false })
                    : [];
            } else {
                const me = await User.findById(requesterId);
                users = me && isUserActive(me) ? [me] : [];
            }

            return res.json({
                success: true,
                users: (users || [])
                    .map((user) => sanitizeUserPayload(user, requesterOwnerUserId))
                    .filter(Boolean)
            });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Erro ao carregar usuÃ¡rios' });
        }
    });

    return router;
}

module.exports = {
    createUserReadRoutes
};
