// Cargar variables de entorno desde .env en desarrollo
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const pino = require('pino');

// Importar rutas de los scrapers
const beatportScraper = require('./beatport-scraper-fixed');
const beatportScraperLegacy = require('./beatport-scraper');
const traxsourceScraper = require('./traxsource-scraper');
const tracklistsScraper = require('./1001tracklists-scraper');
const youtubeSearch = require('./youtube-search');
const tracksApi = require('./tracks-api');
const authApi = require('./auth-api');
const tidalDownloader = require('./tidal-downloader');
const youtubeDownloader = require('./youtube-downloader');
const spotifyApi = require('./spotify-api');

// --- CONFIGURACIÓN ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Configurar logger (pino)
const logger = pino({
    level: IS_PRODUCTION ? 'info' : 'debug',
    // En desarrollo, usar pino-pretty para logs más legibles
    transport: IS_PRODUCTION ? undefined : { target: 'pino-pretty' },
});

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Middleware de logging para cada petición
app.use((req, res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Petición recibida');
    next();
});


// --- RUTAS API (unificadas) ---
// Se definen de manera incondicional para que la estructura de la app sea consistente.
// Vercel gestionará los archivos en /api como serverless functions automáticamente.
app.use('/api/beatport', beatportScraperLegacy);
app.use('/api/traxsource', traxsourceScraper);
app.use('/api/1001tracklists', tracklistsScraper);
app.use('/api/youtube', youtubeSearch);
app.use('/api/auth', authApi);
app.use('/api/tracks', tracksApi);
app.use('/api/tidal', tidalDownloader);
app.use('/api/youtube-dl', youtubeDownloader);
app.use('/api/spotify', spotifyApi);
app.use('/api', beatportScraper);

// Ruta de health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});


// --- LÓGICA ESPECIAL PARA ENTORNO LOCAL ---
if (!IS_PRODUCTION) {
    // Servir archivos estáticos desde la carpeta 'public'
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Ruta para servir el HTML principal en la raíz
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });
    
    logger.info('🏠 Configuración de desarrollo local activa');
} else {
    logger.info('☁️ Configuración de producción (Vercel) activa');
}


// --- MANEJO DE ERRORES ---

// Manejador para rutas no encontradas (404)
// Se ejecuta si ninguna ruta anterior coincide
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
    });
});

// Manejador de errores global
// Express lo identifica por tener 4 argumentos
app.use((error, req, res, next) => {
    logger.error(error, 'Ha ocurrido un error en el servidor');
    
    // Evitar filtrar detalles internos en producción
    const message = IS_PRODUCTION ? 'Ha ocurrido un error interno' : error.message;

    res.status(error.statusCode || 500).json({
        error: 'Error interno del servidor',
        message: message,
    });
});


// --- INICIO DEL SERVIDOR (solo en local) ---
// Vercel se encarga de ejecutar el servidor, por lo que este bloque
// solo debe ejecutarse en un entorno de desarrollo.
if (!IS_PRODUCTION) {
    const server = app.listen(PORT, () => {
        logger.info(`🎵 Beatport Scraper Server iniciado`);
        logger.info(`🌐 Servidor ejecutándose en http://localhost:${PORT}`);
        logger.info(`📁 Sirviendo archivos estáticos desde: ${path.join(__dirname, '..', 'public')}`);
        logger.info(`💾 Las descargas se guardarán en: ${path.join(__dirname, '..', 'downloads')}`);
    });

    // Manejo de cierre "graceful" para limpiar recursos
    const gracefulShutdown = (signal) => {
        logger.warn(`Señal ${signal} recibida, cerrando servidor...`);
        server.close(() => {
            logger.info('✅ Servidor cerrado exitosamente');
            process.exit(0);
        });
    };

    // Escuchar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // ej. 'kill'
    process.on('SIGINT', () => gracefulShutdown('SIGINT')); // ej. Ctrl+C
}

// Exportar la app para que Vercel pueda usarla
module.exports = app;