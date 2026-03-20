const express = require('express');
const { BEATPORT_GENRES } = require('./constants/beatport-genres');

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