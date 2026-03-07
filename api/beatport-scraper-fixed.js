const express = require('express');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseEnabled } = require('./supabase');
const { optionalAuth } = require('./auth-middleware');
const { getRandomUserAgent, handleCookieConsent, retryWithBackoff, smoothScroll, validateTrackData, delay, launchBrowser, getDownloadsDir } = require('./scraper-utils');

const router = express.Router();

// Géneros disponibles en Beatport con sus URLs oficiales
const BEATPORT_GENRES = {
    // Electronic - House y subgéneros
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

    // Electronic - Techno y subgéneros
    'techno': 'https://www.beatport.com/genre/techno/6/top-100',
    'peak-time-driving-techno': 'https://www.beatport.com/genre/peak-time-driving-techno/2/top-100',
    'raw-deep-hypnotic-techno': 'https://www.beatport.com/genre/raw-deep-hypnotic-techno/3/top-100',
    'hard-techno': 'https://www.beatport.com/genre/hard-techno/31/top-100',
    'minimal-deep-tech': 'https://www.beatport.com/genre/minimal-deep-tech/14/top-100',

    // Electronic - Trance y subgéneros
    'trance': 'https://www.beatport.com/genre/trance/7/top-100',
    'psy-trance': 'https://www.beatport.com/genre/psy-trance/13/top-100',
    'trance-raw-deep-hypnotic': 'https://www.beatport.com/genre/trance-raw-deep-hypnotic/132/top-100',

    // Electronic - Bass music
    'drum-bass': 'https://www.beatport.com/genre/drum-bass/1/top-100',
    'dubstep': 'https://www.beatport.com/genre/dubstep/18/top-100',
    'trap-future-bass': 'https://www.beatport.com/genre/trap-future-bass/87/top-100',
    'bass-club': 'https://www.beatport.com/genre/bass-club/147/top-100',
    'deep-dubstep-grime': 'https://www.beatport.com/genre/deep-dubstep-grime/140/top-100',

    // Electronic - Garage y Breakbeat
    'uk-garage-bassline': 'https://www.beatport.com/genre/uk-garage-bassline/86/top-100',
    'breaks-breakbeat-uk-bass': 'https://www.beatport.com/genre/breaks-breakbeat-uk-bass/9/top-100',

    // Electronic - Hardcore y Hard Dance
    'hard-dance-hardcore': 'https://www.beatport.com/genre/hard-dance-hardcore/8/top-100',

    // Electronic - Ambient y Downtempo
    'ambient-experimental': 'https://www.beatport.com/genre/ambient-experimental/19/top-100',
    'downtempo': 'https://www.beatport.com/genre/downtempo/10/top-100',
    'electronica': 'https://www.beatport.com/genre/electronica/20/top-100',

    // Electronic - Indie y Nu Disco
    'indie-dance': 'https://www.beatport.com/genre/indie-dance/37/top-100',
    'nu-disco-disco': 'https://www.beatport.com/genre/nu-disco-disco/50/top-100',

    // Electronic - Electro y Mainstage
    'electro': 'https://www.beatport.com/genre/electro/52/top-100',
    'mainstage': 'https://www.beatport.com/genre/mainstage/79/top-100',

    // Electronic - Dance y Pop
    'dance-pop': 'https://www.beatport.com/genre/dance-pop/39/top-100',

    // Electronic - DJ Tools
    'dj-tools': 'https://www.beatport.com/genre/dj-tools/16/top-100',

    // Electronic - Géneros emergentes
    'amapiano': 'https://www.beatport.com/genre/amapiano/152/top-100',
    'brazilian-funk': 'https://www.beatport.com/genre/brazilian-funk/127/top-100',

    // Open Format - Géneros diversos
    'african': 'https://www.beatport.com/genre/african/65/top-100',
    'caribbean': 'https://www.beatport.com/genre/caribbean/66/top-100',
    'hip-hop': 'https://www.beatport.com/genre/hip-hop/38/top-100',
    'latin': 'https://www.beatport.com/genre/latin/61/top-100',
    'pop': 'https://www.beatport.com/genre/pop/35/top-100',
    'rnb': 'https://www.beatport.com/genre/rnb/36/top-100'
};

// Función simplificada para hacer scraping o generar datos de prueba
async function scrapeBeatportGenre(genreUrl, genreName) {
    console.log(`🎵 Procesando género: ${genreName}`);
    console.log(`🔗 URL: ${genreUrl}`);

    let browser = null;
    try {
        console.log(`🌐 Lanzando navegador para scraping de ${genreName}...`);
        browser = await launchBrowser();
        const page = await browser.newPage();
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
            
            // Hacer scroll para cargar contenido lazy
            await page.evaluate(async () => {
                const distance = 800;
                const delay = ms => new Promise(r => setTimeout(r, ms));
                for (let i = 0; i < 10; i++) { 
                    window.scrollBy(0, distance); 
                    await delay(400); 
                }
            });
            await delay(2000);
            
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
        await browser.close();
        return tracks;

    } catch (error) {
        if (browser) { try { await browser.close(); } catch (e) {} }
        console.error(`❌ Error scraping real de ${genreName}:`, error.message);
        throw error;
    }
}

// Función para generar CSV con carpetas organizadas por género
async function generateCSV(tracks, genreName) {
    try {
        // Crear estructura de carpetas: downloads/genero/
        const downloadsDir = getDownloadsDir();
        const genreDir = getDownloadsDir(genreName);
        
        // Crear directorio principal downloads si no existe
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
            console.log(`📁 Creado directorio: downloads`);
        }
        
        // Crear subdirectorio del género si no existe
        if (!fs.existsSync(genreDir)) {
            fs.mkdirSync(genreDir, { recursive: true });
            console.log(`📁 Creado directorio para género: downloads/${genreName.toLowerCase()}`);
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `beatport_${genreName.replace('-', '_')}_top100_${timestamp}.csv`;
        const filePath = path.join(genreDir, fileName);
        const relativePath = path.join('downloads', genreName.toLowerCase(), fileName);

        console.log(`💾 Generando CSV en: ${relativePath}`);

        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: 'position', title: 'Posición' },
                { id: 'title', title: 'Título' },
                { id: 'artist', title: 'Artista' },
                { id: 'remixer', title: 'Remixer' },
                { id: 'label', title: 'Sello' },
                { id: 'releaseDate', title: 'Fecha de Lanzamiento' },
                { id: 'genre', title: 'Género' },
                { id: 'bpm', title: 'BPM' },
                { id: 'key', title: 'Clave Musical' },
                { id: 'length', title: 'Duración' }
            ]
        });

        await csvWriter.writeRecords(tracks);
        console.log(`✅ CSV generado exitosamente: ${fileName} con ${tracks.length} tracks`);
        
        return { 
            filePath, 
            fileName, 
            relativePath,
            genreFolder: genreName.toLowerCase(),
            fullPath: filePath
        };
    } catch (error) {
        console.error('Error generando CSV:', error);
        throw new Error('Error al generar archivo CSV');
    }
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

        // Generar CSV
        const { filePath, fileName } = await generateCSV(tracks, genre);

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
            downloadUrl: `/api/download/${genre}/${fileName}`,
            supabaseSaved,
            sessionId,
            tracks: tracks.slice(0, 10) // Mostrar solo los primeros 10 como preview
        });

    } catch (error) {
        console.error(`❌ Error procesando género ${genre}:`, error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor al procesar la solicitud',
            details: error.message,
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

// Listar archivos disponibles por género
router.get('/files/:genre?', (req, res) => {
    const { genre } = req.params;
    
    try {
        const downloadsDir = getDownloadsDir();
        
        if (!fs.existsSync(downloadsDir)) {
            return res.json({ 
                message: 'No hay archivos descargados aún',
                genres: [],
                files: []
            });
        }
        
        if (genre) {
            // Listar archivos de un género específico
            const genreDir = path.join(downloadsDir, genre.toLowerCase());
            
            if (!fs.existsSync(genreDir)) {
                return res.json({
                    message: `No hay archivos para el género ${genre}`,
                    genre: genre,
                    files: []
                });
            }
            
            const files = fs.readdirSync(genreDir)
                .filter(file => file.endsWith('.csv'))
                .map(file => ({
                    filename: file,
                    genre: genre,
                    downloadUrl: `/api/download/${genre}/${file}`,
                    created: fs.statSync(path.join(genreDir, file)).mtime
                }))
                .sort((a, b) => new Date(b.created) - new Date(a.created));
            
            res.json({
                genre: genre,
                filesCount: files.length,
                files: files
            });
        } else {
            // Listar todos los géneros y sus archivos
            const genres = fs.readdirSync(downloadsDir)
                .filter(item => {
                    const itemPath = path.join(downloadsDir, item);
                    return fs.statSync(itemPath).isDirectory();
                });
            
            const allFiles = [];
            
            genres.forEach(genreFolder => {
                const genreDir = path.join(downloadsDir, genreFolder);
                const files = fs.readdirSync(genreDir)
                    .filter(file => file.endsWith('.csv'))
                    .map(file => ({
                        filename: file,
                        genre: genreFolder,
                        downloadUrl: `/api/download/${genreFolder}/${file}`,
                        created: fs.statSync(path.join(genreDir, file)).mtime
                    }));
                
                allFiles.push(...files);
            });
            
            allFiles.sort((a, b) => new Date(b.created) - new Date(a.created));
            
            res.json({
                message: 'Archivos disponibles por género',
                genresCount: genres.length,
                totalFiles: allFiles.length,
                genres: genres,
                files: allFiles
            });
        }
    } catch (error) {
        console.error('Error listando archivos:', error);
        res.status(500).json({ error: 'Error al listar archivos' });
    }
});

// Obtener múltiples géneros
router.post('/scrape-multiple', async (req, res) => {
    const { genres } = req.body;
    
    console.log(`🎯 Procesando múltiples géneros:`, genres);
    
    if (!Array.isArray(genres) || genres.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar un array de géneros' });
    }

    const results = [];
    
    for (const genre of genres) {
        console.log(`⏳ Procesando género: ${genre}`);
        
        if (!BEATPORT_GENRES[genre]) {
            results.push({ genre, error: 'Género no válido' });
            continue;
        }

        try {
            const tracks = await scrapeBeatportGenre(BEATPORT_GENRES[genre], genre);
            const { fileName } = await generateCSV(tracks, genre);
            
            results.push({
                genre,
                success: true,
                tracksCount: tracks.length,
                fileName,
                downloadUrl: `/api/download/${genre}/${fileName}`
            });
            
            console.log(`✅ Completado: ${genre} (${tracks.length} tracks)`);
        } catch (error) {
            console.error(`❌ Error en ${genre}:`, error.message);
            results.push({
                genre,
                error: error.message
            });
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