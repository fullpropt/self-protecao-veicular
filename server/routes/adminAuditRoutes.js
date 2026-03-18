const express = require('express');
const { createAdminAuditController } = require('../controllers/adminAuditController');

function createAdminAuditRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createAdminAuditController(options);

    router.get('/api/admin/audits/tenant-integrity', authenticate, async (req, res) => {
        await controller.getTenantIntegrityAuditStatus(req, res);
    });

    router.get('/api/admin/audits/tenant-integrity/history', authenticate, async (req, res) => {
        await controller.listTenantIntegrityAuditHistory(req, res);
    });

    router.post('/api/admin/audits/tenant-integrity/run', authenticate, async (req, res) => {
        await controller.runTenantIntegrityAuditManual(req, res);
    });

    return router;
}

module.exports = {
    createAdminAuditRoutes
};
