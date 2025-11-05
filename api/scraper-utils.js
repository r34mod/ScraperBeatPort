// Configuración y utilidades para el scraper de Beatport

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

    // User agents para rotación
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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

// Función para esperar un tiempo aleatorio
function randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
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
    try {
        const cookieButton = await page.$('button[data-testid="uc-accept-all-button"], .cookie-accept, #accept-cookies');
        if (cookieButton) {
            await cookieButton.click();
            await page.waitForTimeout(1000);
        }
    } catch (error) {
        console.log('No se encontró banner de cookies o ya fue aceptado');
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

module.exports = {
    CONFIG,
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
    retryWithBackoff
};