const express = require('express');
const { createAutomationController } = require('../controllers/automationController');

function createAutomationRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createAutomationController(options);

    router.get('/api/automations', authenticate, async (req, res) => {
        await controller.listAutomations(req, res);
    });

    router.get('/api/automations/:id', authenticate, async (req, res) => {
        await controller.getAutomationById(req, res);
    });

    router.post('/api/automations', authenticate, async (req, res) => {
        await controller.createAutomation(req, res);
    });

    router.put('/api/automations/:id', authenticate, async (req, res) => {
        await controller.updateAutomation(req, res);
    });

    router.delete('/api/automations/:id', authenticate, async (req, res) => {
        await controller.deleteAutomation(req, res);
    });

    return router;
}

module.exports = {
    createAutomationRoutes
};
