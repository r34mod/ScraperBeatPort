const express = require('express');
const { google } = require('googleapis');
const puppeteer = require('puppeteer');

// Configuración de YouTube API
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY_HERE';
const youtube = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY
});

// Router para búsquedas de YouTube
const router = express.Router();

/**
 * Buscar videos de música en YouTube usando la API oficial
 */
router.post('/search', async (req, res) => {
    try {
        const { query, maxResults = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Limpiar y mejorar el query de búsqueda
        const cleanQuery = cleanSearchQuery(query);
        
        // Método 1: Intentar con YouTube API oficial si está configurada
        let searchResults = await searchWithYouTubeAPI(cleanQuery, maxResults);
        
        // Verificar si la API no está configurada y usar métodos alternativos
        if (!searchResults || searchResults.fallback || searchResults.length === 0) {
            console.log('Using fallback search methods...');
            
            // Método 2: Usar scraping como alternativa
            try {
                searchResults = await searchWithScraping(cleanQuery, maxResults);
            } catch (scrapingError) {
                console.log('Scraping search failed, using local database');
                searchResults = searchInLocalDatabase(cleanQuery);
            }
        }
        
        // Método 3: Si todo falla, usar base de datos local
        if (!searchResults || searchResults.length === 0) {
            searchResults = searchInLocalDatabase(cleanQuery);
        }

        res.json({
            success: true,
            query: cleanQuery,
            results: searchResults || [],
            method: searchResults?.method || 'fallback'
        });

    } catch (error) {
        console.error('YouTube search error:', error);
        
        // Fallback en caso de error
        const fallbackResults = searchInLocalDatabase(req.body.query);
        
        res.json({
            success: true,
            query: req.body.query,
            results: fallbackResults,
            warning: 'Used fallback search due to API error'
        });
    }
});

/**
 * Limpiar query de búsqueda para mejorar resultados
 */
function cleanSearchQuery(query) {
    // Eliminar caracteres especiales y normalizar
    let cleaned = query
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Agregar palabras clave para mejorar búsqueda musical
    const musicKeywords = ['music', 'official', 'video'];
    if (!musicKeywords.some(keyword => cleaned.toLowerCase().includes(keyword))) {
        cleaned += ' music';
    }
    
    return cleaned;
}

/**
 * Búsqueda usando YouTube API oficial
 */
async function searchWithYouTubeAPI(query, maxResults) {
    try {
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
            console.log('YouTube API key not configured, skipping API search');
            return {
                success: false,
                error: 'YouTube API key not configured',
                fallback: true
            };
        }

        const response = await youtube.search.list({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: maxResults,
            order: 'relevance',
            videoCategoryId: '10', // Música
            videoDuration: 'medium' // Videos de duración media (4-20 min)
        });

        return response.data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
            publishedAt: item.snippet.publishedAt,
            source: 'youtube_api'
        }));

    } catch (error) {
        console.error('YouTube API search failed:', error);
        return null;
    }
}

/**
 * Búsqueda usando web scraping como alternativa
 */
async function searchWithScraping(query, maxResults) {
    let browser;
    
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Configurar User-Agent para evitar bloqueos
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Ir a YouTube y buscar
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle0' });
        
        // Extraer información de videos
        const videos = await page.evaluate((maxResults) => {
            const videoElements = document.querySelectorAll('a#video-title');
            const results = [];
            
            for (let i = 0; i < Math.min(videoElements.length, maxResults); i++) {
                const element = videoElements[i];
                const href = element.getAttribute('href');
                
                if (href && href.includes('/watch?v=')) {
                    const videoId = href.split('v=')[1].split('&')[0];
                    results.push({
                        videoId: videoId,
                        title: element.textContent.trim(),
                        channelTitle: '',
                        thumbnail: '',
                        source: 'scraping'
                    });
                }
            }
            
            return results;
        }, maxResults);

        return videos;

    } catch (error) {
        console.error('Scraping search failed:', error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Búsqueda en base de datos local como fallback
 */
function searchInLocalDatabase(query) {
    // Base de datos expandida de tracks populares
    const trackDatabase = {
        // House & Deep House
        'house music': [
            { videoId: 'kJQP7kiw5Fk', title: 'Deep House Mix 2024', channelTitle: 'House Nation', source: 'local_db' },
            { videoId: 'NLfnJMsVvzU', title: 'Best House Music 2024', channelTitle: 'Electronic Beats', source: 'local_db' },
        ],
        'deep house': [
            { videoId: 'kJQP7kiw5Fk', title: 'Deep House Mix 2024', channelTitle: 'House Nation', source: 'local_db' },
            { videoId: '8gXcEUa2lEY', title: 'Chill Deep House', channelTitle: 'Relax Music', source: 'local_db' },
        ],
        
        // Techno
        'techno': [
            { videoId: '_WamkRSDeD8', title: 'Techno Mix 2024', channelTitle: 'Techno Underground', source: 'local_db' },
            { videoId: '6p0DAz_30qQ', title: 'Dark Techno Set', channelTitle: 'Techno Rave', source: 'local_db' },
        ],
        'tech house': [
            { videoId: 'hF_2aQhXcCo', title: 'Tech House Vibes', channelTitle: 'Tech House Music', source: 'local_db' },
            { videoId: '6p0DAz_30qQ', title: 'Progressive Tech House', channelTitle: 'Electronic Groove', source: 'local_db' },
        ],
        
        // Trance
        'trance': [
            { videoId: 'PLFVGzyxDyg', title: 'Uplifting Trance Mix', channelTitle: 'Trance Family', source: 'local_db' },
            { videoId: '4YFYWsH6BBQ', title: 'Progressive Trance 2024', channelTitle: 'Trance Music', source: 'local_db' },
        ],
        
        // Progressive
        'progressive': [
            { videoId: '6p0DAz_30qQ', title: 'Progressive House Journey', channelTitle: 'Progressive Sounds', source: 'local_db' },
            { videoId: '1zi7bqRfdC4', title: 'Melodic Progressive', channelTitle: 'Melodic Records', source: 'local_db' },
        ],
        
        // Ambient & Chill
        'ambient': [
            { videoId: '1zi7bqRfdC4', title: 'Ambient Electronic Music', channelTitle: 'Ambient World', source: 'local_db' },
            { videoId: 'mahoSVZhpUo', title: 'Chill Ambient Mix', channelTitle: 'Chill Nation', source: 'local_db' },
        ],
        
        // Popular Artists
        'martin garrix': [
            { videoId: 'gCYcHz2k5x0', title: 'Martin Garrix - Animals', channelTitle: 'Martin Garrix', source: 'local_db' },
        ],
        'avicii': [
            { videoId: '_ovdm2yX4MA', title: 'Avicii - Levels', channelTitle: 'Avicii', source: 'local_db' },
        ],
        'deadmau5': [
            { videoId: 'tKi9Z-f6qX4', title: 'deadmau5 - Strobe', channelTitle: 'deadmau5', source: 'local_db' },
        ],
    };

    const query_lower = query.toLowerCase();
    
    // Búsqueda exacta
    for (const [key, videos] of Object.entries(trackDatabase)) {
        if (query_lower.includes(key) || key.includes(query_lower)) {
            return videos;
        }
    }
    
    // Búsqueda por palabras clave
    const keywords = query_lower.split(/\s+/);
    for (const keyword of keywords) {
        for (const [key, videos] of Object.entries(trackDatabase)) {
            if (key.includes(keyword)) {
                return videos;
            }
        }
    }
    
    // Fallback genérico
    return [
        { videoId: 'kJQP7kiw5Fk', title: 'Electronic Music Mix', channelTitle: 'Music Station', source: 'local_db' }
    ];
}

/**
 * Obtener información detallada de un video específico
 */
router.get('/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        // Intentar obtener información con YouTube API
        let videoInfo = await getVideoInfoFromAPI(videoId);
        
        // Fallback: información básica
        if (!videoInfo) {
            videoInfo = {
                videoId: videoId,
                title: 'Music Video',
                channelTitle: 'Unknown Artist',
                duration: 'Unknown',
                viewCount: 'Unknown',
                source: 'fallback'
            };
        }

        res.json({
            success: true,
            video: videoInfo
        });

    } catch (error) {
        console.error('Error getting video info:', error);
        res.status(500).json({ error: 'Failed to get video information' });
    }
});

/**
 * Obtener información de video usando YouTube API
 */
async function getVideoInfoFromAPI(videoId) {
    try {
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
            return null;
        }

        const response = await youtube.videos.list({
            part: 'snippet,statistics,contentDetails',
            id: videoId
        });

        if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            return {
                videoId: videoId,
                title: video.snippet.title,
                channelTitle: video.snippet.channelTitle,
                description: video.snippet.description,
                publishedAt: video.snippet.publishedAt,
                duration: video.contentDetails.duration,
                viewCount: video.statistics.viewCount,
                likeCount: video.statistics.likeCount,
                thumbnail: video.snippet.thumbnails.medium?.url,
                source: 'youtube_api'
            };
        }

        return null;

    } catch (error) {
        console.error('YouTube API video info failed:', error);
        return null;
    }
}

module.exports = router;