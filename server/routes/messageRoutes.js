const express = require('express');
const { createMessageController } = require('../controllers/messageController');

function createMessageRoutes(options = {}) {
    const authenticate = options.authenticate;
    const validateApiSendRequest = options.validateApiSendRequest;
    const router = express.Router();
    const controller = createMessageController(options);

    router.get('/api/conversations', authenticate, async (req, res) => {
        await controller.listConversations(req, res);
    });

    router.post('/api/conversations/:id/read', authenticate, async (req, res) => {
        await controller.markConversationRead(req, res);
    });

    router.post('/api/send', authenticate, validateApiSendRequest, async (req, res) => {
        await controller.sendLegacyApiMessage(req, res);
    });

    router.post('/api/messages/send', authenticate, async (req, res) => {
        await controller.sendMessageByLeadOrPhone(req, res);
    });

    router.get('/api/messages/:leadId', authenticate, async (req, res) => {
        await controller.listMessages(req, res);
    });

    router.post('/api/messages/:leadId/rehydrate-missing-media', authenticate, async (req, res) => {
        await controller.rehydrateMissingMedia(req, res);
    });

    return router;
}

module.exports = {
    createMessageRoutes
};
