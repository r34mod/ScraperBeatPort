/**
 * Función serverless para búsqueda de YouTube optimizada para Vercel
 * Maneja la ausencia de API key gracefully
 */

/**
 * Limpiar query de búsqueda
 */
function cleanSearchQuery(query) {
    return query
        .replace(/[^\w\s\-]/g, '') // Quitar caracteres especiales excepto guiones
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim()
        .substring(0, 100); // Limitar longitud
}

/**
 * Base de datos local de fallback para búsquedas comunes
 */
function searchInLocalDatabase(query) {
    const fallbackVideos = [
        {
            videoId: 'dQw4w9WgXcQ',
            title: 'Rick Astley - Never Gonna Give You Up',
            description: 'Classic 80s hit',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
        },
        {
            videoId: '9bZkp7q19f0',
            title: 'Gangnam Style - PSY',
            description: 'K-pop hit',
            thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg'
        },
        {
            videoId: 'kJQP7kiw5Fk',
            title: 'Despacito - Luis Fonsi ft. Daddy Yankee',
            description: 'Latin pop hit',
            thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg'
        }
    ];

    // Búsqueda simple por palabras clave
    const searchTerms = query.toLowerCase().split(' ');
    const matches = fallbackVideos.filter(video => {
        const title = video.title.toLowerCase();
        return searchTerms.some(term => title.includes(term));
    });

    if (matches.length > 0) {
        return matches.map(video => ({
            ...video,
            method: 'local_database'
        }));
    }

    // Si no hay coincidencias, generar un resultado genérico basado en la búsqueda
    const genericVideoId = 'dQw4w9WgXcQ'; // Video por defecto
    return [{
        videoId: genericVideoId,
        title: `Music: ${query}`,
        description: `Search results for: ${query}`,
        thumbnail: `https://img.youtube.com/vi/${genericVideoId}/maxresdefault.jpg`,
        method: 'fallback_generic'
    }];
}

/**
 * Simulación de búsqueda cuando no hay API disponible
 */
function simulateYouTubeSearch(query) {
    console.log(`Simulating YouTube search for: ${query}`);
    
    // Generar un ID de video basado en el hash del query (para consistencia)
    const hash = query.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    
    // Lista de videos de música conocidos como fallback
    const fallbackVideoIds = [
        'dQw4w9WgXcQ', // Never Gonna Give You Up
        '9bZkp7q19f0', // Gangnam Style
        'kJQP7kiw5Fk', // Despacito
        'YQHsXMglC9A', // Hello - Adele
        'JGwWNGJdvx8', // Shape of You - Ed Sheeran
        'fJ9rUzIMcZQ', // Bohemian Rhapsody
        'hTWKbfoikeg', // Smells Like Teen Spirit
        'A_MjCqQoLLA', // Hey Jude
        'QDYfEBY9NM4', // Let It Be
        'rYEDA3JcQqw'  // Rolling in the Deep
    ];
    
    const videoIndex = Math.abs(hash) % fallbackVideoIds.length;
    const videoId = fallbackVideoIds[videoIndex];
    
    return [{
        videoId: videoId,
        title: `${query} - Music Video`,
        description: `Search results for: ${query}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        method: 'simulation'
    }];
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
            const { query, maxResults = 5 } = req.body;
            
            if (!query) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Query is required' 
                });
            }

            // Limpiar y mejorar el query de búsqueda
            const cleanQuery = cleanSearchQuery(query);
            console.log(`YouTube search request: ${cleanQuery}`);
            
            // Verificar si tenemos API key configurada
            const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
            
            if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
                console.log('YouTube API key not configured, suggesting direct search');
                
                // No devolver datos falsos, sino indicar que se debe abrir búsqueda directa
                return res.status(200).json({
                    success: false,
                    apiConfigured: false,
                    searchQuery: cleanQuery,
                    directSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
                    message: 'YouTube API not configured. Use direct search instead.',
                    method: 'direct_search_required'
                });
            } else {
                // Aquí iría la lógica de YouTube API si estuviera configurada
                console.log('YouTube API available but not implemented in this endpoint');
                return res.status(200).json({
                    success: false,
                    apiConfigured: true,
                    searchQuery: cleanQuery,
                    directSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
                    message: 'YouTube API configured but endpoint not fully implemented. Use direct search.',
                    method: 'api_not_implemented'
                });
            }

        } catch (error) {
            console.error('YouTube search error:', error);
            
            res.status(500).json({
                success: false,
                error: 'Search service error',
                searchQuery: req.body.query || 'music',
                directSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(req.body.query || 'music')}`,
                message: 'Service error. Use direct search as fallback.'
            });
        }
    } else if (req.method === 'GET') {
        // Health check endpoint
        res.status(200).json({
            success: true,
            service: 'YouTube Search API',
            status: 'operational',
            apiConfigured: !!process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY !== 'YOUR_API_KEY_HERE',
            message: 'Service configured for direct search fallback'
        });
    } else {
        res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST for searches or GET for health check.'
        });
    }
};