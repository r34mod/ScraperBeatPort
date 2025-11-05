const express = require('express');
const cors = require('cors');
const path = require('path');
const beatportScraper = require('./api/beatport-scraper-fixed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rutas API
app.use('/api', beatportScraper);

// Ruta para servir el HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Manejo de errores 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        path: req.originalUrl 
    });
});

// Manejo global de errores
app.use((error, req, res, next) => {
    console.error('Error del servidor:', error);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Ha ocurrido un error'
    });
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('Cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado exitosamente');
        process.exit(0);
    });
});

const server = app.listen(PORT, () => {
    console.log(`🎵 Beatport Scraper Server iniciado`);
    console.log(`🌐 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📁 Archivos estáticos servidos desde: ${path.join(__dirname, 'public')}`);
    console.log(`💾 Descargas guardadas en: ${path.join(__dirname, 'downloads')}`);
    console.log(`⏰ Iniciado en: ${new Date().toISOString()}`);
});

module.exports = app;