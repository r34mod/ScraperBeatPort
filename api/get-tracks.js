const express = require('express');
const router = express.Router();

// Este archivo puede ser usado para endpoints adicionales de tracks
// Por ahora redirige al scraper principal

router.get('/', (req, res) => {
    res.json({
        message: 'API de tracks disponible',
        endpoints: {
            genres: '/api/genres',
            scrape: '/api/scrape/:genre',
            download: '/api/download/:filename',
            scrapeMultiple: '/api/scrape-multiple'
        }
    });
});

module.exports = router;