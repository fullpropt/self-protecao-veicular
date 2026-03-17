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

    router.get('/api/webhooks/incoming/credential', authenticate, async (req, res) => {
        await controller.getIncomingWebhookCredential(req, res);
    });

    router.post('/api/webhooks/incoming/credential/regenerate', authenticate, async (req, res) => {
        await controller.regenerateIncomingWebhookCredential(req, res);
    });

    router.post('/api/webhook/incoming', async (req, res) => {
        await controller.handleIncomingWebhook(req, res);
    });

    return router;
}

module.exports = {
    createWebhookRoutes
};
