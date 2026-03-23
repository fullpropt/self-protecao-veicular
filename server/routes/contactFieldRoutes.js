const express = require('express');
const { createContactFieldController } = require('../controllers/contactFieldController');

function createContactFieldRoutes(options = {}) {
    const authenticate = options.authenticate;
    const router = express.Router();
    const controller = createContactFieldController(options);

    router.get('/api/contact-fields', authenticate, async (req, res) => {
        await controller.listContactFields(req, res);
    });

    router.put('/api/contact-fields', authenticate, async (req, res) => {
        await controller.updateContactFields(req, res);
    });

    return router;
}

module.exports = {
    createContactFieldRoutes
};
