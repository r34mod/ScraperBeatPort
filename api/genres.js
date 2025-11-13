const express = require('express');

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
    'progressive-trance': 'https://www.beatport.com/genre/psy-trance/13/top-100',
    'uplifting-trance': 'https://www.beatport.com/genre/uplifting-trance/34/top-100',
    'vocal-trance': 'https://www.beatport.com/genre/vocal-trance/35/top-100',

    // Electronic - Otros géneros electrónicos
    'electronica-downtempo': 'https://www.beatport.com/genre/electronica-downtempo/3/top-100',
    'ambient': 'https://www.beatport.com/genre/ambient/37/top-100',
    'breakbeat': 'https://www.beatport.com/genre/breakbeat/39/top-100',
    'drum-n-bass': 'https://www.beatport.com/genre/drum-bass/1/top-100',
    'dubstep': 'https://www.beatport.com/genre/dubstep/18/top-100',
    'electro-house': 'https://www.beatport.com/genre/electro-house/8/top-100',
    'future-bass': 'https://www.beatport.com/genre/future-bass/86/top-100',
    'garage': 'https://www.beatport.com/genre/garage/87/top-100',

    // Dance/Pop
    'dance-pop': 'https://www.beatport.com/genre/dance-pop/39/top-100',
    'pop': 'https://www.beatport.com/genre/pop/71/top-100',

    // Hip-Hop/R&B
    'hip-hop': 'https://www.beatport.com/genre/hip-hop/38/top-100',
    'r-b': 'https://www.beatport.com/genre/r-b/42/top-100',

    // Reggae/Dancehall
    'reggae': 'https://www.beatport.com/genre/reggae/41/top-100',
    'dancehall': 'https://www.beatport.com/genre/dancehall/40/top-100',

    // Latina
    'reggaeton': 'https://www.beatport.com/genre/reggaeton/76/top-100',
    'latin': 'https://www.beatport.com/genre/latin/43/top-100'
};

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
            // Organizar géneros por categorías
            const categories = {
                'House': {},
                'Techno': {},
                'Trance': {},
                'Electronic': {},
                'Dance/Pop': {},
                'Hip-Hop/R&B': {},
                'Reggae/Dancehall': {},
                'Latina': {}
            };

            // Clasificar géneros
            Object.keys(BEATPORT_GENRES).forEach(genre => {
                if (genre.includes('house')) {
                    categories['House'][genre] = BEATPORT_GENRES[genre];
                } else if (genre.includes('techno')) {
                    categories['Techno'][genre] = BEATPORT_GENRES[genre];
                } else if (genre.includes('trance')) {
                    categories['Trance'][genre] = BEATPORT_GENRES[genre];
                } else if (['electronica-downtempo', 'ambient', 'breakbeat', 'drum-n-bass', 'dubstep', 'electro-house', 'future-bass', 'garage'].includes(genre)) {
                    categories['Electronic'][genre] = BEATPORT_GENRES[genre];
                } else if (['dance-pop', 'pop'].includes(genre)) {
                    categories['Dance/Pop'][genre] = BEATPORT_GENRES[genre];
                } else if (['hip-hop', 'r-b'].includes(genre)) {
                    categories['Hip-Hop/R&B'][genre] = BEATPORT_GENRES[genre];
                } else if (['reggae', 'dancehall'].includes(genre)) {
                    categories['Reggae/Dancehall'][genre] = BEATPORT_GENRES[genre];
                } else if (['reggaeton', 'latin'].includes(genre)) {
                    categories['Latina'][genre] = BEATPORT_GENRES[genre];
                }
            });

            res.status(200).json({
                success: true,
                message: 'Géneros disponibles obtenidos exitosamente',
                categories: categories,
                totalGenres: Object.keys(BEATPORT_GENRES).length
            });
        } catch (error) {
            console.error('Error al obtener géneros:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
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