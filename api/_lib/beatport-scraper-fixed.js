const express = require('express');
const fs = require('fs');
const path = require('path');
const { optionalAuth } = require('./auth-middleware');
const { getRandomUserAgent, handleCookieConsent, retryWithBackoff, smoothScroll, validateTrackData, delay, launchBrowser, createPage, getDownloadsDir } = require('./scraper-utils');
const { generateAndStoreCsv } = require('./services/csv-service');
const { saveSessionToSupabase } = require('./services/supabase-tracks-service');
const scrapeCache = require('./scrape-cache');
const { validate, schemas } = require('./validation');
const { BEATPORT_GENRES } = require('./constants/beatport-genres');

const router = express.Router();

// Extrae tracks usando una página ya abierta (sin gestionar el browser)
async function _doScrapeBeatportPage(page, genreUrl, genreName) {
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1280, height: 900 });

        // Navegar a la URL. Usamos 'domcontentloaded' en lugar de 'networkidle2':
        // Beatport es un SPA (React) con conexiones persistentes que hacen que
        // 'networkidle2' tarde mucho o nunca se resuelva (especialmente en Vercel).
        await page.goto(genreUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Esperar a que React monte el contenido dinámico
        await delay(3000);

        // Detectar páginas de protección anti-bot (Cloudflare, 403, login wall...)
        const pageTitle = await page.title();
        const pageUrl = page.url();
        const isChallenge = /just a moment|cloudflare|403 forbidden|access denied|captcha|bot/i.test(pageTitle);
        const isLoginWall = /sign in|log in|login|iniciar sesión/i.test(pageTitle) && !pageTitle.toLowerCase().includes('top');
        if (isChallenge || pageUrl.includes('challenges.cloudflare.com')) {
            throw new Error(`Página protegida por Cloudflare/bot-detection: "${pageTitle}". Beatport está bloqueando el acceso desde este servidor.`);
        }
        if (isLoginWall) {
            throw new Error(`Beatport requiere autenticación para acceder al Top 100 del género "${genreName}".`);
        }
        console.log(`📄 Página cargada: "${pageTitle}" (${pageUrl})`);

        // Intentar cerrar posibles banners de cookies
        await handleCookieConsent(page);

        // Esperar que la página cargue y buscar los elementos de tracks
        console.log('🔍 Buscando elementos de tracks en la página...');
        
        // Probar diferentes selectores para encontrar los tracks
        let trackElements = null;
        try {
            // Primero intentar esperar por cualquier elemento que contenga tracks
            await page.waitForSelector('a[href*="/track/"]', { timeout: 30000 });
            console.log('✅ Encontrados enlaces a tracks');
            
            // Scroll dinámico: continuar hasta que no haya tracks nuevos o se alcancen 100
            let lastCount = 0;
            let stableRounds = 0;
            const MAX_ITERS = 25;    // tope de seguridad (~20 s máximo)
            const STABLE_NEEDED = 2; // rondas sin cambio para considerar carga completa

            for (let i = 0; i < MAX_ITERS; i++) {
                const currentCount = await page.evaluate(() =>
                    new Set(
                        Array.from(document.querySelectorAll('a[href*="/track/"]'))
                            .map(a => a.textContent.trim())
                            .filter(t => t.length > 1)
                    ).size
                );

                console.log(`🔄 Scroll ${i + 1}: ${currentCount} tracks únicos detectados`);

                if (currentCount >= 100) {
                    console.log('✅ 100 tracks cargados, deteniendo scroll');
                    break;
                }

                if (currentCount === lastCount) {
                    stableRounds++;
                    if (stableRounds >= STABLE_NEEDED) {
                        console.log(`✅ Sin tracks nuevos tras ${STABLE_NEEDED} rondas, deteniendo scroll`);
                        break;
                    }
                } else {
                    stableRounds = 0;
                }

                lastCount = currentCount;
                await page.evaluate(() => window.scrollBy(0, 800));
                await delay(600);
            }
            
        } catch (error) {
            console.log('⚠️ No se encontraron elementos de tracks inmediatamente, continuando...');
        }

        // Extraer título y artista reales desde DOM
        const tracks = await page.evaluate(() => {
            // Buscar todos los enlaces a tracks como elemento base
            const trackLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
            
            const out = [];
            const seenTitles = new Set();
            let position = 1;
            
            // Procesar cada enlace de track para obtener información
            trackLinks.forEach((trackLink) => {
                if (position > 100) return;
                
                // Obtener el título del enlace del track
                const title = trackLink.textContent.trim();
                if (!title || title.length < 2) return;
                
                // Evitar duplicados por título
                if (seenTitles.has(title)) return;
                seenTitles.add(title);
                
                // Buscar el contenedor padre que contiene toda la información del track
                // Subimos hasta 12 niveles para cubrir estructuras de componentes más profundas.
                // IMPORTANTE: buscamos el contenedor MÁS PEQUEÑO que tenga al menos un artista
                // pero no más de ~5 tracks (para no coger toda la lista de golpe).
                let container = trackLink.parentElement;
                let attempts = 0;
                let foundContainer = null;
                while (container && attempts < 12) {
                    const artistLinks = container.querySelectorAll('a[href*="/artist/"]');
                    const childTrackLinks = container.querySelectorAll('a[href*="/track/"]');
                    if (artistLinks.length > 0 && childTrackLinks.length <= 4) {
                        foundContainer = container;
                        break;
                    }
                    container = container.parentElement;
                    attempts++;
                }

                if (foundContainer) {
                    const artistLinks = foundContainer.querySelectorAll('a[href*="/artist/"]');
                    const labelLink = foundContainer.querySelector('a[href*="/label/"]');

                    const artists = Array.from(artistLinks)
                        .map(a => a.textContent.trim())
                        .filter(a => a.length > 0)
                        .join(', ');

                    const label = labelLink ? labelLink.textContent.trim() : '';

                    let remixer = '';
                    const remixMatch = title.match(/\(([^)]+(?:remix|mix|edit|dub|rework|bootleg)[^)]*)\)/i);
                    if (remixMatch) remixer = remixMatch[1].trim();

                    // BPM
                    let bpm = '';
                    const allSpans = foundContainer.querySelectorAll('span, div.bpm, span.bpm, [class*="bpm"], [data-track-bpm]');
                    for (const el of allSpans) {
                        const txt = el.textContent.trim();
                        if (/^\d{2,3}$/.test(txt)) {
                            const num = parseInt(txt, 10);
                            if (num >= 60 && num <= 200) { bpm = txt; break; }
                        }
                    }

                    // Key (traditional + Camelot)
                    let key = '';
                    const keyPattern = /^[A-G][#b♯♭]?\s*(maj|min|major|minor)?$/i;
                    const camelotPattern = /^(1[0-2]|[1-9])[AB]$/;
                    const keyElements = foundContainer.querySelectorAll('span, div.key, span.key, [class*="key"], [data-track-key]');
                    for (const el of keyElements) {
                        const txt = el.textContent.trim();
                        if (keyPattern.test(txt) || camelotPattern.test(txt)) { key = txt; break; }
                    }

                    // Duration
                    let length = '';
                    const durationPattern = /^\d{1,2}:\d{2}$/;
                    const durationElements = foundContainer.querySelectorAll('span, div.length, span.length, [class*="duration"], [class*="length"], [data-track-length]');
                    for (const el of durationElements) {
                        const txt = el.textContent.trim();
                        if (durationPattern.test(txt)) { length = txt; break; }
                    }

                    // Release Date
                    let releaseDate = '';
                    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                    const dateElements = foundContainer.querySelectorAll('span, [class*="release"], [class*="date"], [data-track-released]');
                    for (const el of dateElements) {
                        const txt = el.textContent.trim();
                        if (datePattern.test(txt)) { releaseDate = txt; break; }
                    }

                    out.push({
                        position: position++,
                        title,
                        artist: artists || 'Unknown Artist',
                        remixer,
                        label,
                        releaseDate,
                        genre: window.location.pathname.split('/')[2] || '',
                        bpm,
                        key,
                        length,
                    });
                } else {
                    // Fallback: incluir el track con solo el título para no perder posiciones.
                    // Ocurre cuando la estructura del DOM no sigue el patrón esperado.
                    out.push({
                        position: position++,
                        title,
                        artist: '',
                        remixer: '',
                        label: '',
                        releaseDate: '',
                        genre: window.location.pathname.split('/')[2] || '',
                        bpm: '',
                        key: '',
                        length: '',
                    });
                }
            });
            
            console.log(`Procesados ${out.length} tracks válidos`);
            return out.slice(0, 100); // Asegurar máximo 100
        });

        console.log(`✅ Scrape completado: ${tracks.length} tracks extraídos (hasta 100)`);
        return tracks;
}

// Gestiona el ciclo de vida del browser para scraping individual
async function scrapeBeatportGenre(genreUrl, genreName) {
    console.log(`🎵 Procesando género: ${genreName}`);
    console.log(`🔗 URL: ${genreUrl}`);
    let browser = null;
    try {
        console.log(`🌐 Lanzando navegador para scraping de ${genreName}...`);
        browser = await launchBrowser();
        const page = await createPage(browser);
        return await _doScrapeBeatportPage(page, genreUrl, genreName);
    } finally {
        if (browser) { try { await browser.close(); } catch (e) {} }
    }
}

// Función para generar CSV — delega a csv-service (Supabase Storage o disco local como fallback)
async function generateCSV(tracks, genreName) {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `beatport_${genreName.replace('-', '_')}_top100_${timestamp}.csv`;
    return generateAndStoreCsv({
        records: tracks,
        headers: [
            { id: 'position', title: 'Posicion' },
            { id: 'title', title: 'Titulo' },
            { id: 'artist', title: 'Artista' },
            { id: 'remixer', title: 'Remixer' },
            { id: 'label', title: 'Sello' },
            { id: 'releaseDate', title: 'Fecha de Lanzamiento' },
            { id: 'genre', title: 'Genero' },
            { id: 'bpm', title: 'BPM' },
            { id: 'key', title: 'Clave Musical' },
            { id: 'length', title: 'Duracion' },
        ],
        storagePath: `beatport/${genreName.toLowerCase()}/${fileName}`,
        localDir: getDownloadsDir(genreName),
        fileName,
        fallbackUrl: `/api/download/${genreName}/${fileName}`,
    });
}

// Rutas API

// Obtener lista de géneros disponibles
router.get('/genres', (req, res) => {
    try {
        const genres = Object.keys(BEATPORT_GENRES).map(key => ({
            id: key,
            name: key.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: BEATPORT_GENRES[key]
        }));
        
        console.log(`📋 Enviando ${genres.length} géneros disponibles`);
        res.json({ genres });
    } catch (error) {
        console.error('Error obteniendo géneros:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener Top100 de un género específico y generar CSV (usando query params)
router.get('/scrape', optionalAuth, async (req, res) => {
    const { genre } = req.query;
    
    console.log(`🚀 Iniciando scraping para género: ${genre}`);
    
    if (!BEATPORT_GENRES[genre]) {
        console.log(`❌ Género no válido: ${genre}`);
        return res.status(400).json({ 
            error: 'Género no válido',
            availableGenres: Object.keys(BEATPORT_GENRES)
        });
    }

    try {
        // Verificar caché antes de lanzar un nuevo browser
        const cached = scrapeCache.get('beatport', genre);
        if (cached) {
            console.log(`⚡ Devolviendo resultados cacheados para ${genre}`);
            const cacheExpiresIn = Math.round((cached.expiresAt - Date.now()) / 60000);
            const { fileName, downloadUrl: cachedDownloadUrl } = await generateCSV(cached.tracks, genre).catch(() => ({ fileName: null, downloadUrl: null }));
            return res.json({
                success: true, genre, fromCache: true,
                cachedAt: cached.cachedAt, cacheExpiresIn: `${cacheExpiresIn} min`,
                tracksCount: cached.tracks.length,
                fileName,
                downloadUrl: cachedDownloadUrl,
                tracks: cached.tracks.slice(0, 10),
            });
        }

        // Hacer scraping con reintentos automáticos
        const rawTracks = await retryWithBackoff(
            () => scrapeBeatportGenre(BEATPORT_GENRES[genre], genre),
            2, 3000
        );
        
        // Validar y limpiar datos de cada track
        const tracks = rawTracks.map(t => validateTrackData(t));
        
        if (tracks.length === 0) {
            console.log(`⚠️ No se obtuvieron tracks para ${genre}`);
            return res.status(503).json({ 
                error: 'No se pudieron extraer tracks. Posible bloqueo anti-bot (Cloudflare) o la página requiere autenticación.',
                hint: 'Beatport puede estar bloqueando el acceso desde servidores cloud. Prueba de nuevo más tarde o usa la versión local.',
                genre,
            });
        }

        // Guardar en caché para evitar scrapes redundantes
        scrapeCache.set('beatport', genre, tracks);

        // Generar CSV
        const { fileName, downloadUrl } = await generateCSV(tracks, genre);

        // Guardar en Supabase si está configurado y el usuario está autenticado
        const { supabaseSaved, sessionId } = await saveSessionToSupabase(req.userClient, {
            userId: req.userId,
            platform: 'beatport',
            genre,
            tracks,
            trackMapper: (t, idx, sid, uid) => ({
                session_id: sid,
                user_id: uid,
                platform: 'beatport',
                genre: genre.toLowerCase(),
                position: t.position || idx + 1,
                title: t.title || '',
                artist: t.artist || '',
                remixer: t.remixer || '',
                label: t.label || '',
                release_date: t.releaseDate || null,
                bpm: t.bpm || null,
                key: t.key || null,
                duration: t.length || null,
            }),
        });
        
        console.log(`✅ Proceso completado para ${genre}: ${tracks.length} tracks`);
        
        res.json({
            success: true,
            genre,
            tracksCount: tracks.length,
            fileName,
            downloadUrl,
            supabaseSaved,
            sessionId,
            tracks: tracks.slice(0, 10) // Mostrar solo los primeros 10 como preview
        });

    } catch (error) {
        console.error(`❌ Error procesando género ${genre}:`, error.message);
        const errorDetails = process.env.NODE_ENV === 'production'
            ? 'Ocurrió un error durante el scraping.'
            : error.message;

        res.status(500).json({ 
            error: 'Error interno del servidor al procesar la solicitud',
            details: errorDetails,
            genre
        });
    }
});

// Descargar archivo CSV generado con estructura de carpetas por género
router.get('/download/:genre/:filename', (req, res) => {
    const { genre, filename } = req.params;
    
    // Buscar en la estructura de carpetas
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

// Obtener múltiples géneros (browser único compartido + caché por género)
router.post('/scrape-multiple', validate(schemas.beatportScrapeMultiple), async (req, res) => {
    const { genres } = req.body;
    console.log(`🎯 Procesando múltiples géneros:`, genres);

    if (!Array.isArray(genres) || genres.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar un array de géneros' });
    }

    const results = [];
    let browser = null;
    try {
        // Lanzar UN único browser compartido para todos los géneros
        browser = await launchBrowser();
        console.log('🌐 Browser compartido lanzado para múltiples géneros');

        for (const genre of genres) {
            console.log(`⏳ Procesando género: ${genre}`);
            if (!BEATPORT_GENRES[genre]) {
                results.push({ genre, error: 'Género no válido' });
                continue;
            }

            // ── Verificar caché ──────────────────────────────────────────────
            const cached = scrapeCache.get('beatport', genre);
            if (cached) {
                console.log(`⚡ Usando caché para ${genre}`);
                try {
                    const { fileName, downloadUrl } = await generateCSV(cached.tracks, genre);
                    results.push({
                        genre, success: true, fromCache: true, cachedAt: cached.cachedAt,
                        tracksCount: cached.tracks.length, tracks: cached.tracks,
                        fileName, downloadUrl,
                    });
                } catch (e) {
                    results.push({
                        genre, success: true, fromCache: true, cachedAt: cached.cachedAt,
                        tracksCount: cached.tracks.length, tracks: cached.tracks,
                    });
                }
                continue;
            }

            // ── Scraping con página propia pero browser compartido ───────────
            let page = null;
            try {
                page = await createPage(browser);
                const rawTracks = await _doScrapeBeatportPage(page, BEATPORT_GENRES[genre], genre);
                const tracks = rawTracks.map(t => validateTrackData(t));
                scrapeCache.set('beatport', genre, tracks);
                const { fileName, downloadUrl } = await generateCSV(tracks, genre);
                results.push({
                    genre, success: true, fromCache: false,
                    tracksCount: tracks.length, tracks,
                    fileName, downloadUrl,
                });
                console.log(`✅ Completado: ${genre} (${tracks.length} tracks)`);
            } catch (error) {
                console.error(`❌ Error en ${genre}:`, error.message);
                results.push({ genre, error: error.message });
            } finally {
                if (page) { try { await page.close(); } catch (e) {} }
            }
            // Pausa entre géneros para evitar sobrecarga
            if (genres.indexOf(genre) < genres.length - 1) await delay(1500);
        }
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
            console.log('🚪 Browser compartido cerrado');
        }
    }

    console.log(`🏁 Proceso multiple completado. Éxitos: ${results.filter(r => r.success).length}/${results.length}`);
    res.json({ results });
});

// Ruta de prueba
router.get('/test', (req, res) => {
    res.json({
        status: 'API funcionando correctamente',
        timestamp: new Date().toISOString(),
        endpoints: {
            genres: '/api/genres - Lista géneros disponibles',
            scrape: '/api/scrape/:genre - Extrae Top100 de un género',
            download: '/api/download/:genre/:filename - Descarga archivo CSV',
            files: '/api/files/:genre? - Lista archivos disponibles (opcional por género)',
            scrapeMultiple: '/api/scrape-multiple - Extrae múltiples géneros'
        },
        folderStructure: {
            downloads: 'downloads/',
            byGenre: 'downloads/{genre}/',
            csvFiles: 'downloads/{genre}/beatport_{genre}_top100_{date}.csv'
        }
    });
});

module.exports = router;
module.exports.scrapeBeatportGenre = scrapeBeatportGenre;