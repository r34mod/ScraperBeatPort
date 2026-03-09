const express = require('express');
const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const { getRandomUserAgent, handleCookieConsent, delay } = require('./scraper-utils');

const router = express.Router();

// URLs base para diferentes tipos de búsqueda en 1001Tracklists
const TRACKLISTS_BASE_URLS = {
    search: 'https://www.1001tracklists.com/search/result.php?format=list&limit=50&search=',
    popular: 'https://www.1001tracklists.com/',
    latest: 'https://www.1001tracklists.com/',
    dj: 'https://www.1001tracklists.com/search/result.php?format=list&limit=50&search='
};

// Función para hacer scraping de tracks de una tracklist específica
async function scrapeTracklistTracks(tracklistUrl, browser) {
    try {
        const page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1200, height: 900 });

        console.log(`🎵 Extrayendo tracks de: ${tracklistUrl}`);
        
        await page.goto(tracklistUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Esperar y hacer scroll para cargar todos los tracks
        await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < 3; i++) { 
                window.scrollBy(0, 800); 
                await delay(500); 
            }
        });
        
        await page.waitForSelector('[class*="tlp"], tr[id*="tlpItem"], .crate-list', { timeout: 10000 }).catch(() => {});
        await delay(2000);

        // Extraer tracks
        const tracks = await page.evaluate(() => {
            const trackElements = document.querySelectorAll('[class*="tlp"], tr[id*="tlpItem"]');
            const results = [];
            
            trackElements.forEach((element, index) => {
                try {
                    // Buscar número de track
                    const trackNumber = index + 1;
                    
                    // Buscar título del track
                    const trackTitleElement = element.textContent;
                    const titleMatch = trackTitleElement.match(/^\s*\d+\s+(.+?)\s*\[/);
                    let title = 'Track no disponible';
                    let artist = 'Artista no disponible';
                    
                    if (titleMatch) {
                        const fullTitle = titleMatch[1].trim();
                        // Separar artista y título
                        if (fullTitle.includes(' - ')) {
                            const parts = fullTitle.split(' - ');
                            artist = parts[0].trim();
                            title = parts.slice(1).join(' - ').trim();
                        } else {
                            title = fullTitle;
                        }
                    }
                    
                    // Buscar label
                    const labelMatch = trackTitleElement.match(/\[([^\]]+)\]/);
                    const label = labelMatch ? labelMatch[1] : 'Label no disponible';
                    
                    if (title !== 'Track no disponible') {
                        results.push({
                            trackNumber: trackNumber,
                            artist: artist,
                            title: title,
                            label: label,
                            fullTitle: `${artist} - ${title}`
                        });
                    }
                } catch (error) {
                    console.log(`Error procesando track ${index}:`, error.message);
                }
            });
            
            return results.slice(0, 100); // Máximo 100 tracks
        });

        await page.close();
        return tracks;
        
    } catch (error) {
        console.log(`Error extrayendo tracks: ${error.message}`);
        return [];
    }
}

// Función para hacer scraping de 1001Tracklists
async function scrape1001Tracklists(searchType, query, event) {
    console.log(`🎧 Procesando búsqueda en 1001Tracklists: ${searchType} - ${query}`);

    let browser = null;
    try {
        console.log(`🌐 Lanzando navegador para scraping de 1001Tracklists...`);
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1200, height: 900 });

        let targetUrl;
        
        // Construir URL según el tipo de búsqueda
        switch(searchType) {
            case 'dj':
            case 'artist':
                targetUrl = `${TRACKLISTS_BASE_URLS.search}${encodeURIComponent(query)}`;
                break;
            case 'event':
                targetUrl = `${TRACKLISTS_BASE_URLS.search}${encodeURIComponent(query)}`;
                break;
            case 'popular':
                targetUrl = TRACKLISTS_BASE_URLS.popular;
                break;
            default:
                targetUrl = `${TRACKLISTS_BASE_URLS.search}${encodeURIComponent(query)}`;
        }

        console.log(`🔗 URL objetivo: ${targetUrl}`);

        // Navegar a la URL
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // Intentar cerrar posibles banners de cookies
        await handleCookieConsent(page);

        // Esperar que la página cargue
        console.log('🔍 Buscando tracklists en la página...');
        
        // Hacer scroll para cargar más contenido
        await page.evaluate(async () => {
            const distance = 800;
            const delay = ms => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < 5; i++) { 
                window.scrollBy(0, distance); 
                await delay(500); 
            }
        });
        await delay(2000);

        // Extraer tracklists desde el DOM
        const tracklists = await page.evaluate(() => {
            const results = [];
            
            // Buscar los elementos de tracklist en la página principal de 1001tracklists
            const tracklistElements = document.querySelectorAll('table tr:not(:first-child), .tlContainer, [class*="tracklist"]');
            console.log(`Encontrados ${tracklistElements.length} elementos potenciales de tracklists`);
            
            // Si no hay elementos de tabla, buscar en el layout general de la página
            if (tracklistElements.length === 0) {
                // Buscar todos los enlaces de tracklist
                const tracklistLinks = document.querySelectorAll('a[href*="/tracklist/"]');
                console.log(`Encontrados ${tracklistLinks.length} enlaces de tracklist`);
                
                tracklistLinks.forEach((link, index) => {
                    if (index >= 50) return; // Limitar a 50 resultados
                    
                    try {
                        const parentElement = link.closest('tr, div, li') || link.parentElement;
                        
                        // Extraer título del tracklist
                        const title = link.textContent.trim() || 'Título no disponible';
                        
                        // Buscar DJ/Artista - puede estar en el mismo elemento o cerca
                        let artist = 'Artista no disponible';
                        const djLink = parentElement.querySelector('a[href*="/dj/"]');
                        if (djLink) {
                            artist = djLink.textContent.trim();
                        } else {
                            // Buscar en el texto del elemento padre
                            const parentText = parentElement.textContent;
                            const parts = parentText.split(/[-@]/);
                            if (parts.length > 1) {
                                artist = parts[0].trim();
                            }
                        }
                        
                        // Buscar evento
                        let event = 'Evento no disponible';
                        const venueLink = parentElement.querySelector('a[href*="/venue/"]');
                        if (venueLink) {
                            event = venueLink.textContent.trim();
                        }
                        
                        // Buscar fecha (formato YYYY-MM-DD)
                        let date = 'Fecha no disponible';
                        const dateMatch = parentElement.textContent.match(/\d{4}-\d{2}-\d{2}/);
                        if (dateMatch) {
                            date = dateMatch[0];
                        }
                        
                        // Buscar duración (formato como "1h 30m" o "30m")
                        let duration = 'Duración no disponible';
                        const durationMatch = parentElement.textContent.match(/\d+h\s*\d*m?|\d+m/);
                        if (durationMatch) {
                            duration = durationMatch[0];
                        }
                        
                        // Buscar número de tracks (formato como "25/30" o "all/25")
                        let trackCount = 'No disponible';
                        const trackCountMatch = parentElement.textContent.match(/(\d+\/\d+|all\/\d+)/);
                        if (trackCountMatch) {
                            trackCount = trackCountMatch[0];
                        }
                        
                        // URL completa del tracklist
                        const url = link.href;
                        
                        if (title && title.length > 3) {
                            results.push({
                                position: results.length + 1,
                                title: title,
                                artist: artist,
                                event: event,
                                date: date,
                                duration: duration,
                                trackCount: trackCount,
                                url: url,
                                platform: '1001Tracklists'
                            });
                        }
                    } catch (error) {
                        console.log(`Error procesando enlace ${index}:`, error.message);
                    }
                });
            } else {
                // Procesar elementos de tabla si los hay
                tracklistElements.forEach((element, index) => {
                    if (index >= 50) return; // Limitar a 50 resultados
                    
                    try {
                        const cells = element.querySelectorAll('td, .tlCell, div');
                        
                        // Buscar título del tracklist
                        const titleLink = element.querySelector('a[href*="/tracklist/"]');
                        const title = titleLink ? titleLink.textContent.trim() : 'Título no disponible';
                        
                        // Buscar artista/DJ
                        const artistLink = element.querySelector('a[href*="/dj/"]');
                        const artist = artistLink ? artistLink.textContent.trim() : 'Artista no disponible';
                        
                        // Buscar evento
                        const eventLink = element.querySelector('a[href*="/venue/"]');
                        const event = eventLink ? eventLink.textContent.trim() : 'Evento no disponible';
                        
                        // Extraer fecha, duración y tracks del texto
                        const fullText = element.textContent;
                        
                        const dateMatch = fullText.match(/\d{4}-\d{2}-\d{2}/);
                        const date = dateMatch ? dateMatch[0] : 'Fecha no disponible';
                        
                        const durationMatch = fullText.match(/\d+h\s*\d*m?|\d+m/);
                        const duration = durationMatch ? durationMatch[0] : 'Duración no disponible';
                        
                        const trackCountMatch = fullText.match(/(\d+\/\d+|all\/\d+)/);
                        const trackCount = trackCountMatch ? trackCountMatch[0] : 'No disponible';
                        
                        const url = titleLink ? titleLink.href : '';
                        
                        if (title && title !== 'Título no disponible' && title.length > 3) {
                            results.push({
                                position: results.length + 1,
                                title: title,
                                artist: artist,
                                event: event,
                                date: date,
                                duration: duration,
                                trackCount: trackCount,
                                url: url,
                                platform: '1001Tracklists'
                            });
                        }
                    } catch (error) {
                        console.log(`Error procesando elemento ${index}:`, error.message);
                    }
                });
            }
            
            console.log(`Procesados ${results.length} tracklists válidos`);
            return results.slice(0, 50); // Máximo 50
        });

        console.log(`✅ Scrape completado: ${tracklists.length} tracklists extraídos`);
        await browser.close();
        return tracklists;

    } catch (error) {
        if (browser) { 
            try { await browser.close(); } catch (e) {} 
        }
        console.error(`❌ Error scraping 1001Tracklists:`, error.message);
        throw error;
    }
}

// Función para generar CSV con tracklists
async function generateTracklistsCSV(tracklists, searchType, query) {
    try {
        // Crear estructura de carpetas
        const downloadsDir = path.join(__dirname, '..', 'downloads');
        const tracklistsDir = path.join(downloadsDir, '1001tracklists');
        
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
            console.log(`📁 Creado directorio: downloads`);
        }
        
        if (!fs.existsSync(tracklistsDir)) {
            fs.mkdirSync(tracklistsDir, { recursive: true });
            console.log(`📁 Creado directorio: downloads/1001tracklists`);
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const searchTerm = query ? query.replace(/[^a-zA-Z0-9]/g, '_') : searchType;
        const fileName = `1001tracklists_${searchType}_${searchTerm}_${timestamp}.csv`;
        const filePath = path.join(tracklistsDir, fileName);

        console.log(`💾 Generando CSV: ${fileName}`);

        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: 'position', title: 'Posicion' },
                { id: 'title', title: 'Titulo' },
                { id: 'artist', title: 'Artista' },
                { id: 'event', title: 'Evento' },
                { id: 'date', title: 'Fecha' },
                { id: 'duration', title: 'Duracion' },
                { id: 'trackCount', title: 'Numero de Tracks' },
                { id: 'url', title: 'URL' },
                { id: 'platform', title: 'Plataforma' }
            ]
        });

        await csvWriter.writeRecords(tracklists);
        console.log(`✅ CSV generado exitosamente: ${fileName} con ${tracklists.length} tracklists`);
        
        return { 
            filePath, 
            fileName,
            fullPath: filePath
        };
    } catch (error) {
        console.error('Error generando CSV:', error);
        throw new Error('Error al generar archivo CSV');
    }
}

// Rutas API

// Ruta principal de scraping
router.post('/scrape', async (req, res) => {
    const { searchType, query, event } = req.body;
    
    console.log(`🚀 Iniciando scraping de 1001Tracklists: ${searchType} - ${query || 'sin query'}`);
    
    try {
        // Hacer scraping
        const tracklists = await scrape1001Tracklists(searchType, query, event);
        
        if (tracklists.length === 0) {
            console.log(`⚠️ No se obtuvieron tracklists`);
            return res.status(404).json({ 
                error: 'No se pudieron extraer tracklists',
                searchType,
                query
            });
        }

        // Generar CSV
        const { fileName } = await generateTracklistsCSV(tracklists, searchType, query);
        
        console.log(`✅ Proceso completado: ${tracklists.length} tracklists`);
        
        res.json({
            success: true,
            searchType,
            query,
            tracklistsCount: tracklists.length,
            filename: fileName,
            downloadUrl: `/api/1001tracklists/download/${fileName}`,
            tracklists: tracklists.slice(0, 10), // Mostrar solo los primeros 10 como preview
            platform: '1001Tracklists'
        });

    } catch (error) {
        console.error(`❌ Error procesando búsqueda en 1001Tracklists:`, error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor al procesar la solicitud',
            details: error.message,
            searchType,
            query
        });
    }
});

// Ruta para obtener tracks de una tracklist específica
router.post('/tracks', async (req, res) => {
    const { tracklistUrl } = req.body;
    
    if (!tracklistUrl) {
        return res.status(400).json({ 
            error: 'Se requiere la URL del tracklist' 
        });
    }
    
    console.log(`🎵 Iniciando extracción de tracks de: ${tracklistUrl}`);
    
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const tracks = await scrapeTracklistTracks(tracklistUrl, browser);
        await browser.close();
        
        if (tracks.length === 0) {
            return res.status(404).json({ 
                error: 'No se pudieron extraer tracks de este tracklist',
                tracklistUrl
            });
        }
        
        console.log(`✅ Tracks extraídos: ${tracks.length}`);
        
        res.json({
            success: true,
            tracklistUrl,
            tracksCount: tracks.length,
            tracks: tracks
        });
        
    } catch (error) {
        if (browser) { 
            try { await browser.close(); } catch (e) {} 
        }
        console.error(`❌ Error extrayendo tracks:`, error.message);
        res.status(500).json({ 
            error: 'Error interno del servidor al extraer tracks',
            details: error.message,
            tracklistUrl
        });
    }
});

// Descargar archivo CSV
router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    
    const filePath = path.join(__dirname, '..', 'downloads', '1001tracklists', filename);
    
    console.log(`📥 Solicitud de descarga: ${filename}`);
    console.log(`📂 Buscando en: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ Archivo no encontrado: ${filePath}`);
        return res.status(404).json({ 
            error: 'Archivo no encontrado', 
            searchedPath: filePath,
            filename: filename
        });
    }
    
    console.log(`✅ Enviando archivo: ${filePath}`);
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Error descargando archivo:', err);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    });
});

// Listar archivos disponibles
router.get('/files', (req, res) => {
    try {
        const tracklistsDir = path.join(__dirname, '..', 'downloads', '1001tracklists');
        
        if (!fs.existsSync(tracklistsDir)) {
            return res.json({ 
                message: 'No hay archivos de 1001Tracklists aún',
                files: []
            });
        }
        
        const files = fs.readdirSync(tracklistsDir)
            .filter(file => file.endsWith('.csv'))
            .map(file => ({
                filename: file,
                downloadUrl: `/api/1001tracklists/download/${file}`,
                created: fs.statSync(path.join(tracklistsDir, file)).mtime
            }))
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json({
            platform: '1001Tracklists',
            filesCount: files.length,
            files: files
        });
        
    } catch (error) {
        console.error('Error listando archivos:', error);
        res.status(500).json({ error: 'Error al listar archivos' });
    }
});

// Ruta de prueba
router.get('/test', (req, res) => {
    res.json({
        status: 'API de 1001Tracklists funcionando correctamente',
        timestamp: new Date().toISOString(),
        endpoints: {
            scrape: '/api/1001tracklists/scrape - Extrae tracklists (POST)',
            tracks: '/api/1001tracklists/tracks - Extrae tracks de un tracklist específico (POST)',
            download: '/api/1001tracklists/download/:filename - Descarga archivo CSV',
            files: '/api/1001tracklists/files - Lista archivos disponibles'
        },
        searchTypes: {
            dj: 'Buscar por DJ o artista',
            artist: 'Buscar por artista (alias de dj)',
            event: 'Buscar por evento o festival', 
            popular: 'Obtener tracklists más populares de la página principal'
        },
        folderStructure: {
            downloads: 'downloads/',
            tracklists: 'downloads/1001tracklists/',
            csvFiles: 'downloads/1001tracklists/1001tracklists_{searchType}_{query}_{date}.csv'
        },
        examples: {
            searchDJ: 'POST /api/1001tracklists/scrape {"searchType": "dj", "query": "Martin Garrix"}',
            getTracks: 'POST /api/1001tracklists/tracks {"tracklistUrl": "https://www.1001tracklists.com/tracklist/..."}',
            getPopular: 'POST /api/1001tracklists/scrape {"searchType": "popular"}'
        }
    });
});

module.exports = router;