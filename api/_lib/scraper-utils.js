// Configuración y utilidades para el scraper de Beatport

const path = require('path');

const IS_VERCEL = !!process.env.VERCEL;

const CONFIG = {
    // Configuración de Puppeteer
    PUPPETEER: {
        headless: true,
        timeout: 60000,
        waitTimeout: 30000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },

    // User agents para rotación (Chrome 131 — 2024)
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ],

    // Delays para evitar detección
    DELAYS: {
        between_requests: 2000,
        page_load: 5000,
        scroll_delay: 1000
    },

    // Selectores CSS para elementos de Beatport
    SELECTORS: {
        // Selectores principales para tracks
        track_items: '.track-grid-item, .bucket-item, .track-item',
        
        // Selectores para información del track
        title: '.buk-track-title, .track-title, [data-track-title]',
        artist: '.buk-track-artists, .track-artists, [data-track-artists]',
        remixer: '.buk-track-remixers, .track-remixers, [data-track-remixers]',
        label: '.buk-track-label, .track-label, [data-track-label]',
        release_date: '.buk-track-released, .track-released, [data-track-released]',
        genre: '.buk-track-genre, .track-genre, [data-track-genre]',
        bpm: '.buk-track-bpm, .track-bpm, [data-track-bpm]',
        key: '.buk-track-key, .track-key, [data-track-key]',
        length: '.buk-track-length, .track-length, [data-track-length]',
        
        // Selectores alternativos
        title_alt: 'a[href*="/track/"], .track-link',
        artist_alt: '.track-artist, a[href*="/artist/"]',
        label_alt: 'a[href*="/label/"]',
        release_date_alt: '.release-date',
        genre_alt: '.genre',
        bpm_alt: '.bpm',
        key_alt: '.key',
        length_alt: '.length'
    }
};

// Función para obtener un user agent aleatorio
function getRandomUserAgent() {
    return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
}

// Función para esperar un tiempo fijo (reemplazo de page.waitForTimeout)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para esperar un tiempo aleatorio
function randomDelay(min = 1000, max = 3000) {
    const d = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, d));
}

// Función para limpiar texto extraído
function cleanText(text) {
    if (!text) return 'N/A';
    return text.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
}

// Función para validar BPM
function validateBPM(bpm) {
    if (!bpm || bpm === 'N/A') return 'N/A';
    const numBPM = parseInt(bpm.replace(/\D/g, ''));
    return (numBPM >= 60 && numBPM <= 200) ? numBPM.toString() : 'N/A';
}

// Función para validar clave musical
function validateKey(key) {
    if (!key || key === 'N/A') return 'N/A';
    const validKeys = /^[A-G](#|b)?\s*(maj|min|major|minor)?$/i;
    return validKeys.test(key.trim()) ? key.trim() : 'N/A';
}

// Función para formatear duración
function formatDuration(duration) {
    if (!duration || duration === 'N/A') return 'N/A';
    // Formato típico: "6:32" o "06:32"
    const timePattern = /^\d{1,2}:\d{2}$/;
    return timePattern.test(duration.trim()) ? duration.trim() : 'N/A';
}

// Función para extraer número de track de la URL
function extractTrackId(url) {
    if (!url) return null;
    const match = url.match(/\/track\/([^\/]+)/);
    return match ? match[1] : null;
}

// Función para generar nombre de archivo seguro
function generateSafeFileName(genre, date = new Date()) {
    const safeGenre = genre.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = date.toISOString().split('T')[0];
    return `beatport_${safeGenre}_top100_${dateStr}.csv`;
}

// Función para validar datos del track
function validateTrackData(track) {
    return {
        position: track.position || 0,
        title: cleanText(track.title),
        artist: cleanText(track.artist),
        remixer: cleanText(track.remixer),
        label: cleanText(track.label),
        releaseDate: cleanText(track.releaseDate),
        genre: cleanText(track.genre),
        bpm: validateBPM(track.bpm),
        key: validateKey(track.key),
        length: formatDuration(track.length)
    };
}

// Función para detectar cambios en la estructura de la página
function detectPageStructure(page) {
    return page.evaluate(() => {
        const structures = {
            'grid-layout': document.querySelector('.track-grid-item') !== null,
            'list-layout': document.querySelector('.bucket-item') !== null,
            'table-layout': document.querySelector('.track-item') !== null,
            'new-layout': document.querySelector('[data-track-title]') !== null
        };
        
        return structures;
    });
}

// Función para scroll suave en la página
async function smoothScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// Función para manejar cookies de consentimiento
async function handleCookieConsent(page) {
    // Lista de selectores comunes en el orden de preferencia
    const selectors = [
        // UserCentrics (usado por Beatport)
        'button[data-testid="uc-accept-all-button"]',
        '#usercentrics-root button[data-testid="uc-accept-all-button"]',
        // OneTrust
        '#onetrust-accept-btn-handler',
        '.onetrust-accept-btn-handler',
        // Genéricos
        '.cookie-accept',
        '#accept-cookies',
        'button[aria-label*="accept" i]',
        'button[aria-label*="agree" i]',
    ];
    try {
        for (const sel of selectors) {
            const btn = await page.$(sel);
            if (btn) {
                await btn.click();
                await delay(800);
                console.log(`🍪 Cookie consent aceptado con: ${sel}`);
                return;
            }
        }
    } catch (error) {
        // No fatal: continuar si no hay banner o ya fue aceptado
    }
}

// Función para retry con backoff exponencial
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            
            const delay = baseDelay * Math.pow(2, i);
            console.log(`Intento ${i + 1} falló, reintentando en ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Crea una página con timeouts seguros pre-configurados para evitar browsers colgados
async function createPage(browser) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(30000);
    return page;
}

// Función para lanzar el navegador según el entorno
async function launchBrowser() {
    if (IS_VERCEL) {
        const chromium = require('@sparticuz/chromium');
        const puppeteerCore = require('puppeteer-core');

        let execPath;
        try {
            execPath = await chromium.executablePath();
        } catch (e) {
            throw new Error(`chromium.executablePath() falló: ${e.message}. Verifica que includeFiles esté configurado en vercel.json.`);
        }
        if (!execPath) {
            throw new Error('No se encontró el ejecutable de Chromium. Verifica que @sparticuz/chromium esté correctamente instalado y que includeFiles esté configurado en vercel.json.');
        }

        const extraArgs = [
            // Required for AWS Lambda / Vercel serverless environments
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            // Anti-detection
            '--disable-blink-features=AutomationControlled',
            '--lang=en-US,en',
            '--window-size=1280,900',
        ];

        // chromium.args already includes many Lambda-specific flags; merge without duplicates
        const baseArgs = chromium.args || [];
        const extraArgsFiltered = extraArgs.filter(a => !baseArgs.includes(a));

        try {
            return await puppeteerCore.launch({
                args: [...baseArgs, ...extraArgsFiltered],
                defaultViewport: chromium.defaultViewport,
                executablePath: execPath,
                headless: chromium.headless,
            });
        } catch (e) {
            throw new Error(`puppeteer-core.launch() falló (executablePath="${execPath}"): ${e.message}`);
        }
    } else {
        const puppeteer = require('puppeteer');
        return puppeteer.launch({
            headless: true,
            args: [
                ...CONFIG.PUPPETEER.args,
                '--disable-blink-features=AutomationControlled',
                '--lang=en-US,en',
            ],
        });
    }
}

// Devuelve el directorio de descargas según el entorno
function getDownloadsDir(genre = '') {
    const base = IS_VERCEL ? '/tmp' : path.join(__dirname, '..', 'downloads');
    return genre ? path.join(base, genre.toLowerCase()) : base;
}

// ─── Supabase Storage helper ──────────────────────────────────────────────────
const SCRAPED_CSVS_BUCKET = 'scraped-csvs';
let _scraperBucketEnsured = false;

async function _ensureScraperBucket(client) {
    if (_scraperBucketEnsured) return;
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) { console.warn('⚠️ No se pudo listar buckets:', error.message); return; }
    const exists = (buckets || []).some(b => b.name === SCRAPED_CSVS_BUCKET);
    if (!exists) {
        const { error: createErr } = await client.storage.createBucket(SCRAPED_CSVS_BUCKET, { public: false });
        if (createErr) { console.error('❌ No se pudo crear bucket', SCRAPED_CSVS_BUCKET, ':', createErr.message); return; }
        console.log(`✅ Bucket "${SCRAPED_CSVS_BUCKET}" creado.`);
    }
    _scraperBucketEnsured = true;
}

/**
 * Sube contenido CSV a Supabase Storage y devuelve una URL firmada (válida 1 hora).
 * Devuelve null si Supabase no está configurado (modo local).
 * @param {string|Buffer} csvContent
 * @param {string} storagePath  Ruta dentro del bucket (ej. 'beatport/house/file.csv')
 * @returns {Promise<string|null>}
 */
async function uploadCsvToStorage(csvContent, storagePath) {
    const { supabaseAdmin, supabase: supabaseClient } = require('./supabase');
    const client = supabaseAdmin || supabaseClient;
    if (!client) return null;

    await _ensureScraperBucket(client);

    const buffer = Buffer.isBuffer(csvContent) ? csvContent : Buffer.from(csvContent, 'utf-8');
    const { error: uploadErr } = await client.storage
        .from(SCRAPED_CSVS_BUCKET)
        .upload(storagePath, buffer, { contentType: 'text/csv; charset=utf-8', upsert: true });

    if (uploadErr) throw new Error(`Storage upload error: ${uploadErr.message}`);

    const { data, error: signedErr } = await client.storage
        .from(SCRAPED_CSVS_BUCKET)
        .createSignedUrl(storagePath, 3600);

    if (signedErr) throw new Error(`Signed URL error: ${signedErr.message}`);
    return data.signedUrl;
}

module.exports = {
    CONFIG,
    IS_VERCEL,
    delay,
    getRandomUserAgent,
    randomDelay,
    cleanText,
    validateBPM,
    validateKey,
    formatDuration,
    extractTrackId,
    generateSafeFileName,
    validateTrackData,
    detectPageStructure,
    smoothScroll,
    handleCookieConsent,
    retryWithBackoff,
    createPage,
    launchBrowser,
    getDownloadsDir,
    uploadCsvToStorage,
};