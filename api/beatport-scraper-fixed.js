const express = require('express');
const { createObjectCsvStringifier } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseEnabled } = require('./supabase');
const { optionalAuth } = require('./auth-middleware');
const { getRandomUserAgent, handleCookieConsent, retryWithBackoff, smoothScroll, validateTrackData, delay, launchBrowser, createPage, getDownloadsDir, uploadCsvToStorage } = require('./scraper-utils');
const scrapeCache = require('./scrape-cache');
const { validate, schemas } = require('./validation');
const { BEATPORT_GENRES } = require('./constants/beatport-genres');

const router = express.Router();

// Extrae tracks usando una página ya abierta (sin gestionar el browser)
async function _doScrapeBeatportPage(page, genreUrl, genreName) {
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1200, height: 900 });

        // Navegar a la URL
        await page.goto(genreUrl, { waitUntil: 'networkidle2', timeout: 45000 });

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
                let container = trackLink.closest('div');
                let attempts = 0;
                while (container && attempts < 8) {
                    const artistLinks = container.querySelectorAll('a[href*="/artist/"]');
                    const labelLink = container.querySelector('a[href*="/label/"]');
                    
                    if (artistLinks.length > 0) {
                        // Extraer artistas
                        const artists = Array.from(artistLinks)
                            .map(a => a.textContent.trim())
                            .filter(a => a.length > 0)
                            .join(', ');
                        
                        // Extraer sello
                        const label = labelLink ? labelLink.textContent.trim() : '';
                        
                        // Extraer remixer - buscar texto entre paréntesis en título o en links de artista remix
                        let remixer = '';
                        const remixMatch = title.match(/\(([^)]+(?:remix|mix|edit|dub|rework|bootleg)[^)]*)\)/i);
                        if (remixMatch) {
                            remixer = remixMatch[1].trim();
                        }
                        
                        // Extraer BPM - buscar elementos con texto numérico de 2-3 dígitos (rango 60-200)
                        let bpm = '';
                        const allSpans = container.querySelectorAll('span, div.bpm, span.bpm, [class*="bpm"], [data-track-bpm]');
                        for (const el of allSpans) {
                            const txt = el.textContent.trim();
                            if (/^\d{2,3}$/.test(txt)) {
                                const num = parseInt(txt, 10);
                                if (num >= 60 && num <= 200) {
                                    bpm = txt;
                                    break;
                                }
                            }
                        }
                        
                        // Extraer Key - buscar elementos que contengan clave musical
                        let key = '';
                        const keyPattern = /^[A-G][#b♯♭]?\s*(maj|min|major|minor)?$/i;
                        const keyElements = container.querySelectorAll('span, div.key, span.key, [class*="key"], [data-track-key]');
                        for (const el of keyElements) {
                            const txt = el.textContent.trim();
                            if (keyPattern.test(txt)) {
                                key = txt;
                                break;
                            }
                        }
                        // Beatport also uses Camelot notation (1A-12B)
                        if (!key) {
                            const camelotPattern = /^(1[0-2]|[1-9])[AB]$/;
                            for (const el of keyElements) {
                                const txt = el.textContent.trim();
                                if (camelotPattern.test(txt)) {
                                    key = txt;
                                    break;
                                }
                            }
                        }
                        
                        // Extraer Duration - buscar elementos con formato M:SS o MM:SS
                        let length = '';
                        const durationPattern = /^\d{1,2}:\d{2}$/;
                        const durationElements = container.querySelectorAll('span, div.length, span.length, [class*="duration"], [class*="length"], [data-track-length]');
                        for (const el of durationElements) {
                            const txt = el.textContent.trim();
                            if (durationPattern.test(txt)) {
                                length = txt;
                                break;
                            }
                        }
                        
                        // Extraer Release Date - buscar elementos con formato fecha
                        let releaseDate = '';
                        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                        const dateElements = container.querySelectorAll('span, [class*="release"], [class*="date"], [data-track-released]');
                        for (const el of dateElements) {
                            const txt = el.textContent.trim();
                            if (datePattern.test(txt)) {
                                releaseDate = txt;
                                break;
                            }
                        }
                        
                        out.push({
                            position: position++,
                            title: title,
                            artist: artists || 'Unknown Artist',
                            remixer: remixer,
                            label: label || '',
                            releaseDate: releaseDate,
                            genre: window.location.pathname.split('/')[2] || '',
                            bpm: bpm,
                            key: key,
                            length: length
                        });
                        break;
                    }
                    
                    container = container.parentElement;
                    attempts++;
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

// Función para generar CSV — sube a Supabase Storage (o disco local como fallback)
async function generateCSV(tracks, genreName) {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `beatport_${genreName.replace('-', '_')}_top100_${timestamp}.csv`;

    const stringifier = createObjectCsvStringifier({
        header: [
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
    });
    const csvContent = stringifier.getHeaderString() + stringifier.stringifyRecords(tracks);

    // Intentar subir a Supabase Storage
    let downloadUrl = null;
    try {
        const storagePath = `beatport/${genreName.toLowerCase()}/${fileName}`;
        downloadUrl = await uploadCsvToStorage(csvContent, storagePath);
        if (downloadUrl) console.log(`☁️  CSV subido a Supabase Storage: ${storagePath}`);
    } catch (e) {
        console.warn('⚠️  No se pudo subir CSV a Supabase Storage:', e.message);
    }

    // Fallback: escribir en disco (desarrollo local / sin Supabase)
    if (!downloadUrl) {
        const downloadsDir = getDownloadsDir();
        const genreDir = getDownloadsDir(genreName);
        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
        if (!fs.existsSync(genreDir)) fs.mkdirSync(genreDir, { recursive: true });
        const filePath = path.join(genreDir, fileName);
        fs.writeFileSync(filePath, csvContent, 'utf-8');
        downloadUrl = `/api/download/${genreName}/${fileName}`;
        console.log(`💾 CSV guardado localmente: ${filePath}`);
    }

    console.log(`✅ CSV listo: ${fileName} — ${tracks.length} tracks`);
    return { fileName, downloadUrl };
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
            return res.status(404).json({ 
                error: 'No se pudieron extraer tracks',
                genre 
            });
        }

        // Guardar en caché para evitar scrapes redundantes
        scrapeCache.set('beatport', genre, tracks);

        // Generar CSV
        const { fileName, downloadUrl } = await generateCSV(tracks, genre);

        // Guardar en Supabase si está configurado y el usuario está autenticado
        let supabaseSaved = false;
        let sessionId = null;
        if (isSupabaseEnabled() && req.userId && req.userClient) {
            try {
                const db = req.userClient;
                const { data: session, error: sessionError } = await db
                    .from('scrape_sessions')
                    .insert({ user_id: req.userId, platform: 'beatport', genre: genre.toLowerCase(), tracks_count: tracks.length })
                    .select()
                    .single();

                if (!sessionError && session) {
                    const rows = tracks.map((t, idx) => ({
                        session_id: session.id,
                        user_id: req.userId,
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
                    }));
                    await db.from('tracks').insert(rows);
                    supabaseSaved = true;
                    sessionId = session.id;
                    console.log(`☁️ Tracks guardados en Supabase (sesión ${session.id}, user ${req.userId})`);
                }
            } catch (e) {
                console.warn('⚠️ No se pudieron guardar tracks en Supabase:', e.message);
            }
        }
        
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