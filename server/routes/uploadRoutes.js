const express = require('express');

function createUploadRoutes(options = {}) {
    const router = express.Router();
    const authenticate = options.authenticate;
    const upload = options.upload;
    const sanitizeUploadBaseName = options.sanitizeUploadBaseName;
    const normalizeUploadExtension = options.normalizeUploadExtension;

    router.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        return res.json({
            success: true,
            file: {
                filename: req.file.filename,
                originalname: `${sanitizeUploadBaseName(req.file.originalname || '')}${normalizeUploadExtension(req.file.originalname || '')}`,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/${req.file.filename}`
            }
        });
    });

    return router;
}

module.exports = {
    createUploadRoutes
};
