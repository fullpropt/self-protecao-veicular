const express = require('express');
const { createQueueController } = require('../controllers/queueController');

function createQueueRoutes(options = {}) {
    const authenticate = options.authenticate;
    const validateQueueBulkRequest = options.validateQueueBulkRequest;
    const router = express.Router();
    const controller = createQueueController(options);

    router.get('/api/queue/status', authenticate, async (req, res) => {
        await controller.getQueueStatus(req, res);
    });

    router.post('/api/queue/add', authenticate, async (req, res) => {
        await controller.addQueueItem(req, res);
    });

    router.post('/api/queue/bulk', authenticate, validateQueueBulkRequest, async (req, res) => {
        await controller.addQueueBulk(req, res);
    });

    router.delete('/api/queue/:id', authenticate, async (req, res) => {
        await controller.deleteQueueItem(req, res);
    });

    router.delete('/api/queue', authenticate, async (req, res) => {
        await controller.clearQueue(req, res);
    });

    return router;
}

module.exports = {
    createQueueRoutes
};
