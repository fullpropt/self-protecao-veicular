const express = require('express');
const { createTemplateController } = require('../controllers/templateController');

function createTemplateRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createTemplateController(options);

    router.get('/api/templates', authenticate, async (req, res) => {
        await controller.listTemplates(req, res);
    });

    router.post('/api/templates', authenticate, async (req, res) => {
        await controller.createTemplate(req, res);
    });

    router.put('/api/templates/:id', authenticate, async (req, res) => {
        await controller.updateTemplate(req, res);
    });

    router.delete('/api/templates/:id', authenticate, async (req, res) => {
        await controller.deleteTemplate(req, res);
    });

    return router;
}

module.exports = {
    createTemplateRoutes
};
