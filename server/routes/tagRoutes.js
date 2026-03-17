const express = require('express');
const { createTagController } = require('../controllers/tagController');

function createTagRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createTagController(options);

    router.get('/api/tags', authenticate, async (req, res) => {
        await controller.listTags(req, res);
    });

    router.post('/api/tags', authenticate, async (req, res) => {
        await controller.createTag(req, res);
    });

    router.put('/api/tags/:id', authenticate, async (req, res) => {
        await controller.updateTag(req, res);
    });

    router.delete('/api/tags/:id', authenticate, async (req, res) => {
        await controller.deleteTag(req, res);
    });

    return router;
}

module.exports = {
    createTagRoutes
};
