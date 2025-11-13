const puppeteer = require('puppeteer');

// Importar la función de scraping desde el archivo principal
const { scrapeBeatport } = require('./scrape');

// Géneros disponibles
const BEATPORT_GENRES = {
    'house': 'https://www.beatport.com/genre/house/5/top-100',
    'deep-house': 'https://www.beatport.com/genre/deep-house/12/top-100',
    'tech-house': 'https://www.beatport.com/genre/tech-house/11/top-100',
    'progressive-house': 'https://www.beatport.com/genre/progressive-house/15/top-100',
    'afro-house': 'https://www.beatport.com/genre/afro-house/89/top-100',
    'bass-house': 'https://www.beatport.com/genre/bass-house/91/top-100',
    'funky-house': 'https://www.beatport.com/genre/funky-house/81/top-100',
    'jackin-house': 'https://www.beatport.com/genre/jackin-house/83/top-100',
    'melodic-house-techno': 'https://www.beatport.com/genre/melodic-house-techno/90/top-100',
    'organic-house': 'https://www.beatport.com/genre/organic-house/93/top-100',
    'techno': 'https://www.beatport.com/genre/techno/6/top-100',
    'peak-time-driving-techno': 'https://www.beatport.com/genre/peak-time-driving-techno/2/top-100',
    'raw-deep-hypnotic-techno': 'https://www.beatport.com/genre/raw-deep-hypnotic-techno/3/top-100',
    'hard-techno': 'https://www.beatport.com/genre/hard-techno/31/top-100',
    'minimal-deep-tech': 'https://www.beatport.com/genre/minimal-deep-tech/14/top-100',
    'trance': 'https://www.beatport.com/genre/trance/7/top-100',
    'progressive-trance': 'https://www.beatport.com/genre/psy-trance/13/top-100',
    'uplifting-trance': 'https://www.beatport.com/genre/uplifting-trance/34/top-100',
    'vocal-trance': 'https://www.beatport.com/genre/vocal-trance/35/top-100',
    'electronica-downtempo': 'https://www.beatport.com/genre/electronica-downtempo/3/top-100',
    'ambient': 'https://www.beatport.com/genre/ambient/37/top-100',
    'breakbeat': 'https://www.beatport.com/genre/breakbeat/39/top-100',
    'drum-n-bass': 'https://www.beatport.com/genre/drum-bass/1/top-100',
    'dubstep': 'https://www.beatport.com/genre/dubstep/18/top-100',
    'electro-house': 'https://www.beatport.com/genre/electro-house/8/top-100',
    'future-bass': 'https://www.beatport.com/genre/future-bass/86/top-100',
    'garage': 'https://www.beatport.com/genre/garage/87/top-100',
    'dance-pop': 'https://www.beatport.com/genre/dance-pop/39/top-100',
    'pop': 'https://www.beatport.com/genre/pop/71/top-100',
    'hip-hop': 'https://www.beatport.com/genre/hip-hop/38/top-100',
    'r-b': 'https://www.beatport.com/genre/r-b/42/top-100',
    'reggae': 'https://www.beatport.com/genre/reggae/41/top-100',
    'dancehall': 'https://www.beatport.com/genre/dancehall/40/top-100',
    'reggaeton': 'https://www.beatport.com/genre/reggaeton/76/top-100',
    'latin': 'https://www.beatport.com/genre/latin/43/top-100'
};

async function scrapeBeatportGenre(genre) {
    const url = BEATPORT_GENRES[genre];
    if (!url) {
        throw new Error(`Género '${genre}' no encontrado`);
    }

    console.log(`Iniciando scraping para género: ${genre}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const page = await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000 
        });
        
        try {
            await page.waitForSelector('.track-grid-item, .bucket-item', { timeout: 15000 });
        } catch (error) {
            await page.waitForSelector('[data-ec-name], .playable-track, .track', { timeout: 10000 });
        }
        
        await page.waitForTimeout(3000);
        
        const tracks = await page.evaluate(() => {
            const trackElements = Array.from(document.querySelectorAll('.track-grid-item, .bucket-item, [data-ec-name], .playable-track'));
            
            return trackElements.slice(0, 100).map((element, index) => {
                try {
                    // Extraer título
                    let title = '';
                    const titleSelectors = [
                        '.buk-track-title',
                        '[data-ec-name]',
                        '.track-title',
                        '.title',
                        'a[data-ec-name]',
                        '.buk-track-artists + .buk-track-title',
                        '.bucket-item .buk-track-title'
                    ];
                    
                    for (const selector of titleSelectors) {
                        const titleEl = element.querySelector(selector);
                        if (titleEl && titleEl.textContent.trim()) {
                            title = titleEl.textContent.trim();
                            break;
                        }
                    }
                    
                    if (!title && element.getAttribute('data-ec-name')) {
                        title = element.getAttribute('data-ec-name').trim();
                    }
                    
                    // Extraer artistas
                    let artists = [];
                    const artistSelectors = [
                        '.buk-track-artists',
                        '.track-artists',
                        '.artists',
                        '[data-ec-artist]',
                        '.bucket-item .buk-track-artists'
                    ];
                    
                    for (const selector of artistSelectors) {
                        const artistEls = element.querySelectorAll(selector + ' a, ' + selector);
                        if (artistEls.length > 0) {
                            artists = Array.from(artistEls).map(el => el.textContent.trim()).filter(artist => artist);
                            if (artists.length > 0) break;
                        }
                    }
                    
                    if (artists.length === 0 && element.getAttribute('data-ec-artist')) {
                        artists = [element.getAttribute('data-ec-artist').trim()];
                    }
                    
                    // Extraer label
                    let label = '';
                    const labelSelectors = [
                        '.buk-track-labels',
                        '.track-label',
                        '.label',
                        '[data-ec-label]',
                        '.bucket-item .buk-track-labels'
                    ];
                    
                    for (const selector of labelSelectors) {
                        const labelEl = element.querySelector(selector + ' a, ' + selector);
                        if (labelEl && labelEl.textContent.trim()) {
                            label = labelEl.textContent.trim();
                            break;
                        }
                    }
                    
                    if (!label && element.getAttribute('data-ec-label')) {
                        label = element.getAttribute('data-ec-label').trim();
                    }
                    
                    // Extraer precio
                    let price = '';
                    const priceSelectors = [
                        '.buk-track-buy-link',
                        '.price',
                        '.buy-link',
                        '.track-price',
                        '.bucket-item .buk-track-buy-link'
                    ];
                    
                    for (const selector of priceSelectors) {
                        const priceEl = element.querySelector(selector);
                        if (priceEl && priceEl.textContent.trim()) {
                            price = priceEl.textContent.trim();
                            break;
                        }
                    }
                    
                    return {
                        position: index + 1,
                        title: title || 'Sin título',
                        artist: artists.length > 0 ? artists : ['Sin artista'],
                        label: label || 'Sin label',
                        genre: genre,
                        price: price || 'Sin precio'
                    };
                } catch (error) {
                    console.error('Error extrayendo datos del track:', error);
                    return {
                        position: index + 1,
                        title: 'Error al extraer',
                        artist: ['Error'],
                        label: 'Error',
                        genre: genre,
                        price: 'Error'
                    };
                }
            });
        });
        
        return tracks;
        
    } catch (error) {
        console.error('Error durante el scraping:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method === 'POST') {
        try {
            const { genres } = req.body;
            
            if (!genres || !Array.isArray(genres) || genres.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Array de géneros requerido'
                });
            }
            
            if (genres.length > 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Máximo 5 géneros permitidos por solicitud'
                });
            }
            
            // Validar que todos los géneros existan
            const invalidGenres = genres.filter(genre => !BEATPORT_GENRES[genre]);
            if (invalidGenres.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Géneros no válidos: ${invalidGenres.join(', ')}`,
                    availableGenres: Object.keys(BEATPORT_GENRES)
                });
            }
            
            console.log(`Iniciando scraping múltiple para géneros: ${genres.join(', ')}`);
            
            const results = [];
            const errors = [];
            
            // Procesar cada género secuencialmente para evitar sobrecargar el servidor
            for (const genre of genres) {
                try {
                    console.log(`Procesando género: ${genre}`);
                    const tracks = await scrapeBeatportGenre(genre);
                    
                    results.push({
                        genre: genre,
                        success: true,
                        tracksCount: tracks.length,
                        tracks: tracks,
                        scrapedAt: new Date().toISOString()
                    });
                    
                    console.log(`✅ Completado ${genre}: ${tracks.length} tracks`);
                    
                    // Pequeña pausa entre géneros
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                } catch (error) {
                    console.error(`❌ Error en género ${genre}:`, error.message);
                    errors.push({
                        genre: genre,
                        error: error.message
                    });
                    
                    results.push({
                        genre: genre,
                        success: false,
                        error: error.message,
                        tracksCount: 0,
                        tracks: []
                    });
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const totalTracks = results.reduce((sum, r) => sum + (r.tracksCount || 0), 0);
            
            res.status(200).json({
                success: errors.length === 0,
                totalGenres: genres.length,
                successfulGenres: successCount,
                failedGenres: errors.length,
                totalTracks: totalTracks,
                results: results,
                errors: errors.length > 0 ? errors : undefined,
                completedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error en scraping múltiple:', error);
            res.status(500).json({
                success: false,
                error: 'Error durante el scraping múltiple',
                message: error.message
            });
        }
    } else {
        res.status(405).json({
            success: false,
            error: 'Método no permitido. Use POST.'
        });
    }
};