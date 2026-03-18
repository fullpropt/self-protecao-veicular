const express = require('express');
const { createFlowController } = require('../controllers/flowController');

function createFlowRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createFlowController(options);

    router.post('/api/ai/flows/generate', authenticate, async (req, res) => {
        await controller.generateAiFlowDraft(req, res);
    });

    router.get('/api/flows', authenticate, async (req, res) => {
        await controller.listFlows(req, res);
    });

    router.get('/api/flows/:id', authenticate, async (req, res) => {
        await controller.getFlowById(req, res);
    });

    router.post('/api/flows', authenticate, async (req, res) => {
        await controller.createFlow(req, res);
    });

    router.put('/api/flows/:id', authenticate, async (req, res) => {
        await controller.updateFlow(req, res);
    });

    router.delete('/api/flows/:id', authenticate, async (req, res) => {
        await controller.deleteFlow(req, res);
    });

    return router;
}

module.exports = {
    createFlowRoutes
};
