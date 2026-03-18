const express = require('express');
const { createSettingsController } = require('../controllers/settingsController');

function createSettingsRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createSettingsController(options);

    router.get('/api/plan/status', authenticate, async (req, res) => {
        await controller.getPlanStatus(req, res);
    });

    router.post('/api/plan/status/refresh', authenticate, async (req, res) => {
        await controller.refreshPlanStatus(req, res);
    });

    router.get('/api/settings', authenticate, async (req, res) => {
        await controller.getSettings(req, res);
    });

    router.put('/api/settings', authenticate, async (req, res) => {
        await controller.updateSettings(req, res);
    });

    return router;
}

module.exports = {
    createSettingsRoutes
};
