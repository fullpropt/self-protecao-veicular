const express = require('express');
const { createAdminDashboardController } = require('../controllers/adminDashboardController');

function createAdminDashboardRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createAdminDashboardController(options);

    router.get('/api/admin/dashboard/email-settings', authenticate, async (req, res) => {
        await controller.getEmailSettings(req, res);
    });

    router.put('/api/admin/dashboard/email-settings', authenticate, async (req, res) => {
        await controller.updateEmailSettings(req, res);
    });

    router.post('/api/admin/dashboard/email-settings/preview', authenticate, async (req, res) => {
        await controller.previewEmailSettings(req, res);
    });

    router.post('/api/admin/dashboard/email-settings/test', authenticate, async (req, res) => {
        await controller.sendTestEmail(req, res);
    });

    router.get('/api/admin/dashboard/email-support-inbox', authenticate, async (req, res) => {
        await controller.listEmailSupportInbox(req, res);
    });

    router.post('/api/admin/dashboard/email-support-inbox/:id/read', authenticate, async (req, res) => {
        await controller.markEmailSupportInboxRead(req, res);
    });

    return router;
}

module.exports = {
    createAdminDashboardRoutes
};
