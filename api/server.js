// Cargar variables de entorno desde .env en desarrollo
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const pino = require('pino');

// Importar rutas de los scrapers
const beatportScraper = require('./_lib/beatport-scraper-fixed');
const beatportScraperLegacy = require('./_lib/beatport-scraper');
const traxsourceScraper = require('./_lib/traxsource-scraper');
const tracklistsScraper = require('./_lib/1001tracklists-scraper');
const youtubeSearch = require('./_lib/youtube-search');
const tracksApi = require('./_lib/tracks-api');
const authApi = require('./_lib/auth-api');
const tidalDownloader = require('./_lib/tidal-downloader');
const youtubeDownloader = require('./_lib/youtube-downloader');
const spotifyApi = require('./_lib/spotify-api');
const communityApi = require('./_lib/community-api');
const scrapeJobs = require('./_lib/scrape-jobs');
const subscriptionApi = require('./_lib/subscription-api');
const likesApi = require('./_lib/likes-api');

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

// --- CORS ---
// Allowlist de orígenes autorizados. En producción, añade aquí tus dominios de Vercel.
// Puedes ampliarla con la variable de entorno ALLOWED_ORIGINS (valores separados por coma).
const STATIC_ALLOWED_ORIGINS = [
    'https://scraper-beat-port.vercel.app',
    // Previews de Vercel: cualquier rama del mismo proyecto
    /^https:\/\/scraper-beat-port-[a-z0-9-]+-r34mod\.vercel\.app$/,
];

function buildAllowedOrigins() {
    const origins = [...STATIC_ALLOWED_ORIGINS];
    if (process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS.split(',')
            .map(o => o.trim())
            .filter(Boolean)
            .forEach(o => origins.push(o));
    }
    return origins;
}

const corsOptions = {
    origin(origin, callback) {
        // Permitir peticiones sin Origin (curl, Postman, SSR, llamadas server-to-server)
        // y el propio localhost en desarrollo.
        if (!origin || !IS_PRODUCTION) return callback(null, true);

        const allowed = buildAllowedOrigins();
        const isAllowed = allowed.some(entry =>
            typeof entry === 'string' ? entry === origin : entry.test(origin)
        );

        if (isAllowed) return callback(null, true);

        logger.warn({ origin }, 'CORS: origen no autorizado bloqueado');
        callback(new Error(`CORS: el origen "${origin}" no está autorizado.`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Pre-flight explícito para todas las rutas
app.options('*', cors(corsOptions));
// Stripe webhook necesita el body sin parsear (debe ir ANTES de express.json)
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' })); // Aumentado para permitir subida de CSVs grandes

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
app.use('/api/community', communityApi);
app.use('/api/jobs', scrapeJobs);
app.use('/api/subscription', subscriptionApi);
app.use('/api/likes', likesApi);
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