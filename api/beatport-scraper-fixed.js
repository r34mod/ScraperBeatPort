const express = require('express');
const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

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
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1200, height: 900 });

        // Navegar a la URL
        await page.goto(genreUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // Intentar cerrar posibles banners de cookies (silencioso)
        try {
            const cookieSel = 'button[data-testid="uc-accept-all-button"], button[aria-label*="Accept"], button.cookie-accept';
            const btn = await page.$(cookieSel);
            if (btn) { await btn.click(); await page.waitForTimeout(1000); }
        } catch (e) {}

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
            await page.waitForTimeout(2000);
            
        } catch (error) {
            console.log('⚠️ No se encontraron elementos de tracks inmediatamente, continuando...');
        }

        // Extraer título y artista reales desde DOM
        const tracks = await page.evaluate(() => {
            // Buscar todos los enlaces a tracks como elemento base
            const trackLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
            console.log(`Encontrados ${trackLinks.length} enlaces de tracks`);
            
            const out = [];
            let position = 1;
            
            // Procesar cada enlace de track para obtener información
            trackLinks.forEach((trackLink, idx) => {
                if (position > 100) return; // Limitar a Top 100
                
                // Obtener el título del enlace del track
                const title = trackLink.textContent.trim();
                if (!title || title.length < 2) return; // Saltar enlaces vacíos o muy cortos
                
                // Buscar el contenedor padre que contiene toda la información del track
                let container = trackLink.closest('div');
                let attempts = 0;
                while (container && attempts < 5) {
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
                        
                        out.push({
                            position: position++,
                            title: title,
                            artist: artists || 'Unknown Artist',
                            remixer: '',
                            label: label || '',
                            releaseDate: '',
                            genre: window.location.pathname.split('/')[2] || '',
                            bpm: '',
                            key: '',
                            length: ''
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
        // Crear estructura de carpetas: Downloads/genero/
        const downloadsDir = path.join(__dirname, '..', 'Downloads');
        const genreDir = path.join(downloadsDir, genreName.toLowerCase());
        
        // Crear directorio principal Downloads si no existe
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
            console.log(`📁 Creado directorio: Downloads`);
        }
        
        // Crear subdirectorio del género si no existe
        if (!fs.existsSync(genreDir)) {
            fs.mkdirSync(genreDir, { recursive: true });
            console.log(`📁 Creado directorio para género: Downloads/${genreName.toLowerCase()}`);
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `beatport_${genreName.replace('-', '_')}_top100_${timestamp}.csv`;
        const filePath = path.join(genreDir, fileName);
        const relativePath = path.join('Downloads', genreName.toLowerCase(), fileName);

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

// Obtener Top100 de un género específico y generar CSV
router.get('/scrape/:genre', async (req, res) => {
    const { genre } = req.params;
    
    console.log(`🚀 Iniciando scraping para género: ${genre}`);
    
    if (!BEATPORT_GENRES[genre]) {
        console.log(`❌ Género no válido: ${genre}`);
        return res.status(400).json({ 
            error: 'Género no válido',
            availableGenres: Object.keys(BEATPORT_GENRES)
        });
    }

    try {
        // Hacer scraping (actualmente genera datos de prueba)
        const tracks = await scrapeBeatportGenre(BEATPORT_GENRES[genre], genre);
        
        if (tracks.length === 0) {
            console.log(`⚠️ No se obtuvieron tracks para ${genre}`);
            return res.status(404).json({ 
                error: 'No se pudieron extraer tracks',
                genre 
            });
        }

        // Generar CSV
        const { filePath, fileName } = await generateCSV(tracks, genre);
        
        console.log(`✅ Proceso completado para ${genre}: ${tracks.length} tracks`);
        
        res.json({
            success: true,
            genre,
            tracksCount: tracks.length,
            fileName,
            downloadUrl: `/api/download/${genre}/${fileName}`,
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
    
    // Buscar en la nueva estructura de carpetas
    const filePath = path.join(__dirname, '..', 'Downloads', genre.toLowerCase(), filename);
    
    console.log(`📥 Solicitud de descarga: ${genre}/${filename}`);
    console.log(`📂 Buscando en: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado: ${filePath}`);
        
        // Buscar también en la carpeta antigua (downloads) como fallback
        const oldFilePath = path.join(__dirname, '..', 'downloads', filename);
        if (fs.existsSync(oldFilePath)) {
            console.log(`✅ Encontrado en ubicación antigua: ${oldFilePath}`);
            return res.download(oldFilePath, filename, (err) => {
                if (err) {
                    console.error('Error descargando archivo:', err);
                    res.status(500).json({ error: 'Error al descargar el archivo' });
                }
            });
        }
        
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
        const downloadsDir = path.join(__dirname, '..', 'Downloads');
        
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
            downloads: 'Downloads/',
            byGenre: 'Downloads/{genre}/',
            csvFiles: 'Downloads/{genre}/beatport_{genre}_top100_{date}.csv'
        }
    });
});

module.exports = router;