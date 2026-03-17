const express = require('express');
const { createWebhookController } = require('../controllers/webhookController');

function createWebhookRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createWebhookController(options);

    router.get('/api/webhooks', authenticate, async (req, res) => {
        await controller.listWebhooks(req, res);
    });

    router.post('/api/webhooks', authenticate, async (req, res) => {
        await controller.createWebhook(req, res);
    });

    router.put('/api/webhooks/:id', authenticate, async (req, res) => {
        await controller.updateWebhook(req, res);
    });

    router.delete('/api/webhooks/:id', authenticate, async (req, res) => {
        await controller.deleteWebhook(req, res);
    });

    return router;
}

module.exports = {
    createWebhookRoutes
};
