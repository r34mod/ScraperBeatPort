const puppeteer = require('puppeteer');
const { BEATPORT_GENRES } = require('./constants/beatport-genres');

async function scrapeBeatport(genre) {
    const url = BEATPORT_GENRES[genre];
    if (!url) {
        throw new Error(`Género '${genre}' no encontrado`);
    }

    console.log(`Iniciando scraping para género: ${genre}`);
    console.log(`URL: ${url}`);

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
        
        console.log('Navegando a la página...');
        await page.goto(url, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000 
        });
        
        console.log('Esperando que los tracks se carguen...');
        
        try {
            await page.waitForSelector('.track-grid-item, .bucket-item', { timeout: 15000 });
        } catch (error) {
            console.log('Selectores principales no encontrados, intentando con selectores alternativos...');
            await page.waitForSelector('[data-ec-name], .playable-track, .track', { timeout: 10000 });
        }
        
        await page.waitForTimeout(3000);
        
        console.log('Extrayendo datos de los tracks...');
        
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
                        genre: window.location.pathname.split('/')[2] || 'Unknown',
                        price: price || 'Sin precio'
                    };
                } catch (error) {
                    console.error('Error extrayendo datos del track:', error);
                    return {
                        position: index + 1,
                        title: 'Error al extraer',
                        artist: ['Error'],
                        label: 'Error',
                        genre: 'Error',
                        price: 'Error'
                    };
                }
            });
        });
        
        console.log(`Extracción completa. Tracks encontrados: ${tracks.length}`);
        
        if (tracks.length === 0) {
            throw new Error('No se pudieron extraer tracks de la página');
        }
        
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
    
    if (req.method === 'GET') {
        try {
            const { genre } = req.query;
            
            if (!genre) {
                return res.status(400).json({
                    success: false,
                    error: 'Parámetro "genre" requerido'
                });
            }
            
            if (!BEATPORT_GENRES[genre]) {
                return res.status(400).json({
                    success: false,
                    error: `Género '${genre}' no disponible`,
                    availableGenres: Object.keys(BEATPORT_GENRES)
                });
            }
            
            console.log(`Iniciando scraping de Beatport para género: ${genre}`);
            
            const tracks = await scrapeBeatport(genre);
            
            res.status(200).json({
                success: true,
                genre: genre,
                totalTracks: tracks.length,
                tracks: tracks,
                scrapedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Error en scraping:', error);
            res.status(500).json({
                success: false,
                error: 'Error durante el scraping',
                message: error.message
            });
        }
    } else {
        res.status(405).json({
            success: false,
            error: 'Método no permitido'
        });
    }
};