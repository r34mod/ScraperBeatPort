const express = require('express');
const fs = require('fs');
const path = require('path');
const { optionalAuth } = require('./auth-middleware');
const { getRandomUserAgent, handleCookieConsent, retryWithBackoff, cleanText, delay, launchBrowser, createPage, getDownloadsDir } = require('./scraper-utils');
const { generateAndStoreCsv } = require('./services/csv-service');
const { saveSessionToSupabase } = require('./services/supabase-tracks-service');
const scrapeCache = require('./scrape-cache');
const { validate, schemas } = require('./validation');

const router = express.Router();

// Géneros disponibles en Traxsource con sus URLs oficiales
const TRAXSOURCE_GENRES = {
    // House principales
    'house': 'https://www.traxsource.com/genre/4/house/top',
    'deep-house': 'https://www.traxsource.com/genre/13/deep-house/top',
    'tech-house': 'https://www.traxsource.com/genre/18/tech-house/top',
    'afro-house': 'https://www.traxsource.com/genre/27/afro-house/top',
    'soulful-house': 'https://www.traxsource.com/genre/24/soulful-house/top',
    'jackin-house': 'https://www.traxsource.com/genre/15/jackin-house/top',
    'funky-house': 'https://www.traxsource.com/genre/5/funky-house/top',
    'garage-house': 'https://www.traxsource.com/genre/29/garage/top',
    'melodic-house/progressive': 'https://www.traxsource.com/genre/19/melodic-progressive-house/top',
    
    // Subgéneros House
    'tribal-house': 'https://www.traxsource.com/genre/32/tribal-house/top',
    'latin-house': 'https://www.traxsource.com/genre/23/afro-latin-brazilian/top',
    'classic-house': 'https://www.traxsource.com/genre/12/classic-house/top',
    
    // Techno y géneros relacionados
    'techno': 'https://www.traxsource.com/genre/20/techno/top',
    
    // Disco y Nu-Disco
    'disco/leftfield': 'https://www.traxsource.com/genre/14/disco/top',
    'nu-disco': 'https://www.traxsource.com/genre/17/nu-disco-indie-dance/top',
    'funk': 'https://www.traxsource.com/genre/15/funk/top',
    'soul-funk-disco': 'https://www.traxsource.com/genre/3/soul-funk-disco/top',
    
    
    // Trance
    'trance': 'https://www.traxsource.com/genre/7/trance/top',

    // Electronica y Experimental
    'electronica': 'https://www.traxsource.com/genre/5/electronica/top',
    'drum-bass': 'https://www.traxsource.com/genre/31/drum-and-bass/top',
    'electro-house': 'https://www.traxsource.com/genre/11/electro-house/top'
};

// Función para hacer scraping de Traxsource
async function scrapeTraxsourceGenre(genreUrl, genreName) {
    console.log(`🎵 Procesando género Traxsource: ${genreName}`);
    console.log(`🔗 URL: ${genreUrl}`);

    let browser = null;
    try {
        browser = await launchBrowser();
        const page = await createPage(browser);
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1280, height: 900 });

        await page.goto(genreUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(5000);
        await handleCookieConsent(page);

        // Log de clases disponibles para diagnóstico
        const availableClasses = await page.evaluate(() => {
            const allEls = document.querySelectorAll('[class]');
            const classes = new Set();
            allEls.forEach(el => {
                const cn = el.getAttribute('class') || '';
                cn.split(' ').forEach(c => { if (c) classes.add(c); });
            });
            return Array.from(classes).filter(c => c.toLowerCase().includes('track') || c.toLowerCase().includes('row') || c.toLowerCase().includes('item') || c.toLowerCase().includes('cue') || c.toLowerCase().includes('chart'));
        });
        console.log('🔍 Clases relevantes encontradas:', availableClasses.join(', '));

        // Intentar varios selectores conocidos de Traxsource
        const SELECTORS = [
            '.cue-buy-row',
            '.trk-row',
            '.track-row',
            '.chart-item',
            '.track-item',
            '[data-trackid]',
            'li.trk',
            '.traxsource-track',
        ];
        let usedSelector = null;
        for (const sel of SELECTORS) {
            const found = await page.$(sel);
            if (found) { usedSelector = sel; break; }
        }
        if (!usedSelector) {
            // último recurso: links a /track/
            const fallback = await page.$('a[href*="/track/"]');
            if (fallback) usedSelector = 'a[href*="/track/"]';
        }
        console.log(`✅ Selector usado: ${usedSelector}`);
        if (!usedSelector) throw new Error('No se encontró ningún selector de tracks en la página');

        const tracks = await page.evaluate((selector) => {
            const results = [];

            if (selector === 'a[href*="/track/"]') {
                // Fallback: extraer desde los links de tracks directamente
                const trackLinks = document.querySelectorAll('a[href*="/track/"]');
                trackLinks.forEach((el, index) => {
                    const title = el.textContent.trim();
                    if (!title || title.length < 2) return;
                    // Buscar el contenedor padre más cercano con info de artista
                    const container = el.closest('li, tr, div[class*="row"], div[class*="item"], div[class*="track"]') || el.parentElement;
                    const artistEls = container ? container.querySelectorAll('a[href*="/artist/"]') : [];
                    const artist = Array.from(artistEls).map(a => a.textContent.trim()).join(', ');
                    const labelEl = container ? container.querySelector('a[href*="/label/"]') : null;
                    const label = labelEl ? labelEl.textContent.trim() : 'N/A';
                    if (title && artist) {
                        results.push({ position: index + 1, title, mix: 'N/A', artist, label, duration: 'N/A', genre: 'N/A', bpm: 'N/A', key: 'N/A', price: 'N/A', platform: 'Traxsource' });
                    }
                });
            } else {
                const rows = document.querySelectorAll(selector);
                rows.forEach((row, index) => {
                    try {
                        const posEl = row.querySelector('.position, [class*="pos"]');
                        const position = posEl ? parseInt(posEl.textContent.trim(), 10) || (index + 1) : index + 1;

                        const titleEl = row.querySelector('a[href*="/track/"]');
                        const title = titleEl ? titleEl.textContent.trim() : null;

                        // Versión/Mix: texto que sigue al título + duración entre paréntesis
                        const versionEl = row.querySelector('.version, [class*="version"], [class*="mix"]');
                        let mix = 'N/A';
                        let duration = 'N/A';
                        if (versionEl) {
                            const vt = versionEl.textContent.trim();
                            const durMatch = vt.match(/\((\d+:\d+)\)\s*$/);
                            if (durMatch) {
                                duration = durMatch[1];
                                mix = vt.replace(durMatch[0], '').trim() || 'N/A';
                            } else {
                                mix = vt;
                            }
                        }
                        // Si no hay .version, buscar duración directamente
                        if (duration === 'N/A') {
                            const allText = row.textContent;
                            const durMatch = allText.match(/\((\d+:\d+)\)/);
                            if (durMatch) duration = durMatch[1];
                        }

                        const artistEls = row.querySelectorAll('a[href*="/artist/"]');
                        const artist = Array.from(artistEls).map(a => a.textContent.trim()).join(', ');

                        const labelEl = row.querySelector('a[href*="/label/"]');
                        const label = labelEl ? labelEl.textContent.trim() : 'N/A';

                        const genreEl = row.querySelector('a[href*="/genre/"]');
                        const genre = genreEl ? genreEl.textContent.trim() : 'N/A';

                        const bpmEl = row.querySelector('[class*="bpm"]');
                        const bpm = bpmEl ? bpmEl.textContent.trim() : 'N/A';

                        const keyEl = row.querySelector('[class*="key"]');
                        const key = keyEl ? keyEl.textContent.trim() : 'N/A';

                        const priceEl = row.querySelector('[class*="price"], [class*="buy"]');
                        const price = priceEl ? priceEl.textContent.trim() : 'N/A';

                        if (title && artist) {
                            results.push({ position, title, mix, artist, label, duration, genre, bpm, key, price, platform: 'Traxsource' });
                        }
                    } catch (err) { /* skip */ }
                });
            }
            return results;
        }, usedSelector);

        console.log(`📊 Tracks encontrados en ${genreName}: ${tracks.length}`);

        if (tracks.length === 0) {
            throw new Error(`No se encontraron tracks para el género ${genreName}. Es posible que la estructura de la página haya cambiado.`);
        }

        return tracks.slice(0, 100);

    } catch (error) {
        console.error(`❌ Error durante el scraping de ${genreName}:`, error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}



// Ruta para obtener géneros disponibles
router.get('/genres', (req, res) => {
    try {
        const genres = Object.keys(TRAXSOURCE_GENRES).map(key => ({
            id: key,
            name: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            url: TRAXSOURCE_GENRES[key]
        }));
        
        console.log(`📋 Enviando ${genres.length} géneros de Traxsource disponibles`);
        res.json(genres);
    } catch (error) {
        console.error('❌ Error al obtener géneros de Traxsource:', error);
        res.status(500).json({ error: 'Error al obtener géneros' });
    }
});

// Ruta para hacer scraping de un género específico
router.post('/scrape', optionalAuth, validate(schemas.traxsourceScrape), async (req, res) => {
    const { genre } = req.body;

    if (!genre || !TRAXSOURCE_GENRES[genre]) {
        return res.status(400).json({ 
            error: 'Género no válido. Consulta /api/traxsource/genres para ver géneros disponibles.' 
        });
    }

    try {
        // Verificar caché antes de lanzar un nuevo browser
        const cached = scrapeCache.get('traxsource', genre);
        if (cached) {
            console.log(`⚡ Devolviendo resultados cacheados para Traxsource/${genre}`);
            const cacheExpiresIn = Math.round((cached.expiresAt - Date.now()) / 60000);
            return res.json({
                success: true, genre, fromCache: true,
                cachedAt: cached.cachedAt, cacheExpiresIn: `${cacheExpiresIn} min`,
                tracksCount: cached.tracks.length, tracks: cached.tracks,
                platform: 'Traxsource',
            });
        }

        console.log(`🎵 Iniciando scraping de Traxsource - Género: ${genre}`);
        
        const genreUrl = TRAXSOURCE_GENRES[genre];
        const tracks = await retryWithBackoff(
            () => scrapeTraxsourceGenre(genreUrl, genre),
            2, 3000
        );

        if (tracks.length === 0) {
            return res.status(404).json({ error: 'No se encontraron tracks para este género' });
        }

        // Guardar en caché para evitar scrapes redundantes
        scrapeCache.set('traxsource', genre, tracks);

        // Crear nombre de archivo con fecha y género
        const today = new Date().toISOString().split('T')[0];
        const filename = `traxsource_${genre.replace('-', '_')}_top100_${today}.csv`;

        // Generar CSV y almacenar (Supabase Storage o disco local como fallback)
        const { downloadUrl } = await generateAndStoreCsv({
            records: tracks,
            headers: [
                { id: 'position', title: 'Position' },
                { id: 'title', title: 'Title' },
                { id: 'mix', title: 'Mix' },
                { id: 'artist', title: 'Artist' },
                { id: 'label', title: 'Label' },
                { id: 'duration', title: 'Duration' },
                { id: 'genre', title: 'Genre' },
                { id: 'bpm', title: 'BPM' },
                { id: 'key', title: 'Key' },
                { id: 'price', title: 'Price' },
                { id: 'platform', title: 'Platform' },
            ],
            storagePath: `traxsource/${genre.toLowerCase()}/${filename}`,
            localDir: getDownloadsDir(genre),
            fileName: filename,
            fallbackUrl: `/api/traxsource/download/${genre}/${filename}`,
        });

        console.log(`✅ Scraping completado: ${filename} — ${tracks.length} tracks`);

        // Guardar en Supabase si está configurado y el usuario está autenticado
        const { supabaseSaved, sessionId } = await saveSessionToSupabase(req.userClient, {
            userId: req.userId,
            platform: 'traxsource',
            genre,
            tracks,
            trackMapper: (t, idx, sid, uid) => ({
                session_id: sid,
                user_id: uid,
                platform: 'traxsource',
                genre: genre.toLowerCase(),
                position: t.position || idx + 1,
                title: t.title || '',
                artist: t.artist || '',
                remixer: t.mix || '',
                label: t.label || '',
                release_date: null,
                bpm: t.bpm ? String(t.bpm) : null,
                key: t.key || null,
                duration: t.duration || null,
            }),
        });

        res.json({
            success: true,
            message: `Scraping de ${genre} completado exitosamente`,
            filename: filename,
            tracksCount: tracks.length,
            downloadUrl,
            genre: genre,
            platform: 'Traxsource',
            supabaseSaved,
            sessionId,
            tracks: tracks.slice(0, 10) // Mostrar solo los primeros 10 tracks en la respuesta
        });

    } catch (error) {
        console.error(`❌ Error durante el scraping de ${genre}:`, error);
        res.status(500).json({ 
            error: 'Error durante el scraping', 
            details: error.message 
        });
    }
});

// Descargar archivo CSV generado con estructura de carpetas por género
router.get('/download/:genre/:filename', (req, res) => {
    const { genre, filename } = req.params;
    
    // Buscar en la estructura de carpetas correcta
    const filePath = path.join(getDownloadsDir(genre), filename);
    
    console.log(`📥 Solicitud de descarga: ${genre}/${filename}`);
    console.log(`📂 Buscando en: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado: ${filePath}`);
        
        return res.status(404).json({ 
            error: 'Archivo no encontrado', 
            searchedPath: filePath,
            genre: genre,
            filename: filename
        });
    }
    
    console.log(`✅ Enviando archivo desde: ${filePath}`);
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Error descargando archivo:', err);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    });
});

module.exports = router;
module.exports.scrapeTraxsourceGenre = scrapeTraxsourceGenre;
module.exports.TRAXSOURCE_GENRES = TRAXSOURCE_GENRES;