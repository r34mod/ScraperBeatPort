/**
 * API REST para gestionar tracks almacenados en Supabase (con autenticación).
 *
 * Todos los endpoints requieren token JWT en el header Authorization.
 * Cada usuario solo ve/modifica sus propios datos gracias a user_id + RLS.
 *
 * Endpoints:
 *   POST   /api/tracks/save         - Guardar un lote de tracks (desde un scrape)
 *   GET    /api/tracks               - Listar tracks (filtros: platform, genre, session_id)
 *   GET    /api/tracks/platforms      - Listar plataformas con sus géneros disponibles
 *   GET    /api/tracks/sessions       - Listar sesiones de scrape
 *   DELETE /api/tracks/session/:id    - Eliminar una sesión y sus tracks
 *   GET    /api/tracks/export/csv     - Exportar tracks filtrados como CSV
 */

const express = require('express');
const router = express.Router();
const { isSupabaseEnabled } = require('./supabase');
const { requireAuth } = require('./auth-middleware');

// ─── MODO MOCK (desarrollo local sin Supabase) ──────────────────────────────
if (!isSupabaseEnabled()) {
    console.warn('⚠️  Tracks API en MODO MOCK: datos almacenados en memoria (se pierden al reiniciar).');
    const mockSessions = [];
    const mockTracks = [];
    let nextSessionId = 1;

    router.use(requireAuth);

    router.post('/save', (req, res) => {
        const { tracks, platform, genre } = req.body;
        if (!tracks || !Array.isArray(tracks) || !tracks.length || !platform || !genre) {
            return res.status(400).json({ error: 'Se requiere tracks[], platform y genre.' });
        }
        const session = {
            id: String(nextSessionId++),
            user_id: req.userId,
            platform: platform.toLowerCase(),
            genre: genre.toLowerCase(),
            tracks_count: tracks.length,
            created_at: new Date().toISOString(),
        };
        mockSessions.push(session);
        tracks.forEach((t, idx) => {
            mockTracks.push({
                id: `mock-${Date.now()}-${idx}`,
                session_id: session.id,
                user_id: req.userId,
                platform: platform.toLowerCase(),
                genre: genre.toLowerCase(),
                position: t.position || idx + 1,
                title: t.title || '',
                artist: t.artist || '',
                remixer: t.remixer || '',
                label: t.label || '',
                release_date: t.releaseDate || t.release_date || null,
                bpm: t.bpm || null,
                key: t.key || null,
                duration: t.length || t.duration || null,
            });
        });
        console.log(`✅ Mock: guardados ${tracks.length} tracks (sesión ${session.id})`);
        res.json({ success: true, session_id: session.id, tracks_saved: tracks.length, platform, genre });
    });

    router.get('/', (req, res) => {
        const { platform, genre, session_id, page = 1, limit = 100 } = req.query;
        let filtered = mockTracks.filter(t => t.user_id === req.userId);
        if (platform) filtered = filtered.filter(t => t.platform === platform.toLowerCase());
        if (genre) filtered = filtered.filter(t => t.genre === genre.toLowerCase());
        if (session_id) filtered = filtered.filter(t => t.session_id === session_id);
        filtered.sort((a, b) => a.position - b.position);
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const paged = filtered.slice(offset, offset + parseInt(limit));
        res.json({ tracks: paged, total: filtered.length, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(filtered.length / parseInt(limit)) });
    });

    router.get('/platforms', (req, res) => {
        const sessions = mockSessions.filter(s => s.user_id === req.userId);
        const platforms = {};
        sessions.forEach(s => {
            if (!platforms[s.platform]) platforms[s.platform] = {};
            if (!platforms[s.platform][s.genre]) platforms[s.platform][s.genre] = [];
            platforms[s.platform][s.genre].push({ session_id: s.id, tracks_count: s.tracks_count, scraped_at: s.created_at });
        });
        res.json({ platforms });
    });

    router.get('/sessions', (req, res) => {
        const { platform, genre } = req.query;
        let sessions = mockSessions.filter(s => s.user_id === req.userId);
        if (platform) sessions = sessions.filter(s => s.platform === platform.toLowerCase());
        if (genre) sessions = sessions.filter(s => s.genre === genre.toLowerCase());
        res.json({ sessions: sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
    });

    router.delete('/session/:id', (req, res) => {
        const { id } = req.params;
        const idx = mockSessions.findIndex(s => s.id === id && s.user_id === req.userId);
        if (idx === -1) return res.status(404).json({ error: 'Sesión no encontrada.' });
        mockSessions.splice(idx, 1);
        for (let i = mockTracks.length - 1; i >= 0; i--) {
            if (mockTracks[i].session_id === id) mockTracks.splice(i, 1);
        }
        res.json({ success: true, message: `Sesión ${id} eliminada (mock).` });
    });

    router.get('/export/csv', (req, res) => {
        const { platform, genre, session_id } = req.query;
        let filtered = mockTracks.filter(t => t.user_id === req.userId);
        if (platform) filtered = filtered.filter(t => t.platform === platform.toLowerCase());
        if (genre) filtered = filtered.filter(t => t.genre === genre.toLowerCase());
        if (session_id) filtered = filtered.filter(t => t.session_id === session_id);
        if (!filtered.length) return res.status(404).json({ error: 'No hay tracks para exportar.' });
        filtered.sort((a, b) => a.position - b.position);
        const headers = ['Posición','Título','Artista','Remixer','Sello','Fecha Lanzamiento','Género','BPM','Clave','Duración','Plataforma'];
        const fields = ['position','title','artist','remixer','label','release_date','genre','bpm','key','duration','platform'];
        const rows = [headers.join(',')];
        filtered.forEach(t => {
            rows.push(fields.map(f => {
                const v = t[f] != null ? String(t[f]) : '';
                return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
            }).join(','));
        });
        const filename = `tracks_${platform || 'all'}_${genre || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(rows.join('\n'));
    });

    module.exports = router;
    return;
}
// ─── FIN MODO MOCK ───────────────────────────────────────────────────────────

// Middleware: verificar que Supabase está habilitado
function requireSupabase(req, res, next) {
    if (!isSupabaseEnabled()) {
        return res.status(503).json({
            error: 'Supabase no está configurado. Añade SUPABASE_URL y SUPABASE_KEY a las variables de entorno.'
        });
    }
    next();
}

router.use(requireSupabase);
router.use(requireAuth); // Todas las rutas requieren usuario autenticado

// ─── POST /save ─── Guardar tracks de un scrape ──────────────────────────────
router.post('/save', async (req, res) => {
    try {
        const { tracks, platform, genre } = req.body;
        const db = req.userClient;
        const userId = req.userId;

        if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de tracks.' });
        }
        if (!platform || !genre) {
            return res.status(400).json({ error: 'Se requieren los campos "platform" y "genre".' });
        }

        // 1. Crear sesión de scrape
        const { data: session, error: sessionError } = await db
            .from('scrape_sessions')
            .insert({
                user_id: userId,
                platform: platform.toLowerCase(),
                genre: genre.toLowerCase(),
                tracks_count: tracks.length,
            })
            .select()
            .single();

        if (sessionError) {
            console.error('Error creando sesión:', sessionError);
            return res.status(500).json({ error: 'Error al crear la sesión de scrape.', details: sessionError.message });
        }

        // 2. Preparar tracks con session_id y user_id
        const rows = tracks.map((t, idx) => ({
            session_id: session.id,
            user_id: userId,
            platform: platform.toLowerCase(),
            genre: genre.toLowerCase(),
            position: t.position || idx + 1,
            title: t.title || '',
            artist: t.artist || '',
            remixer: t.remixer || '',
            label: t.label || '',
            release_date: t.releaseDate || t.release_date || null,
            bpm: t.bpm || null,
            key: t.key || null,
            duration: t.length || t.duration || null,
        }));

        // 3. Insertar tracks en lotes de 100
        const batchSize = 100;
        let insertedCount = 0;
        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const { error: insertError } = await db
                .from('tracks')
                .insert(batch);

            if (insertError) {
                console.error('Error insertando tracks:', insertError);
                return res.status(500).json({ error: 'Error al guardar tracks.', details: insertError.message });
            }
            insertedCount += batch.length;
        }

        console.log(`✅ Guardados ${insertedCount} tracks en Supabase (sesión ${session.id}, user ${userId})`);

        res.json({
            success: true,
            session_id: session.id,
            tracks_saved: insertedCount,
            platform,
            genre,
        });
    } catch (error) {
        console.error('Error en POST /save:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

// ─── GET / ─── Listar tracks (con filtros opcionales) ────────────────────────
router.get('/', async (req, res) => {
    try {
        const { platform, genre, session_id, page = 1, limit = 100 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const db = req.userClient;

        let query = db
            .from('tracks')
            .select('*', { count: 'exact' })
            .order('position', { ascending: true })
            .range(offset, offset + parseInt(limit) - 1);

        if (platform) query = query.eq('platform', platform.toLowerCase());
        if (genre) query = query.eq('genre', genre.toLowerCase());
        if (session_id) query = query.eq('session_id', session_id);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error obteniendo tracks:', error);
            return res.status(500).json({ error: 'Error al obtener tracks.', details: error.message });
        }

        res.json({
            tracks: data,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (error) {
        console.error('Error en GET /:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

// ─── GET /platforms ─── Listar plataformas y géneros disponibles ──────────────
router.get('/platforms', async (req, res) => {
    try {
        const db = req.userClient;
        const { data, error } = await db
            .from('scrape_sessions')
            .select('id, platform, genre, tracks_count, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error obteniendo plataformas:', error);
            return res.status(500).json({ error: 'Error al obtener plataformas.', details: error.message });
        }

        // Agrupar por plataforma → género
        const platforms = {};
        data.forEach(session => {
            if (!platforms[session.platform]) {
                platforms[session.platform] = {};
            }
            if (!platforms[session.platform][session.genre]) {
                platforms[session.platform][session.genre] = [];
            }
            platforms[session.platform][session.genre].push({
                session_id: session.id,
                tracks_count: session.tracks_count,
                scraped_at: session.created_at,
            });
        });

        res.json({ platforms });
    } catch (error) {
        console.error('Error en GET /platforms:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

// ─── GET /sessions ─── Listar sesiones de scrape ─────────────────────────────
router.get('/sessions', async (req, res) => {
    try {
        const { platform, genre } = req.query;
        const db = req.userClient;

        let query = db
            .from('scrape_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (platform) query = query.eq('platform', platform.toLowerCase());
        if (genre) query = query.eq('genre', genre.toLowerCase());

        const { data, error } = await query;

        if (error) {
            console.error('Error obteniendo sesiones:', error);
            return res.status(500).json({ error: 'Error al obtener sesiones.', details: error.message });
        }

        res.json({ sessions: data });
    } catch (error) {
        console.error('Error en GET /sessions:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

// ─── DELETE /session/:id ─── Eliminar sesión y sus tracks ─────────────────────
router.delete('/session/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.userClient;

        // Eliminar tracks de la sesión (RLS asegura que sea del usuario)
        const { error: tracksError } = await db
            .from('tracks')
            .delete()
            .eq('session_id', id);

        if (tracksError) {
            console.error('Error eliminando tracks:', tracksError);
            return res.status(500).json({ error: 'Error al eliminar tracks.', details: tracksError.message });
        }

        // Eliminar la sesión
        const { error: sessionError } = await db
            .from('scrape_sessions')
            .delete()
            .eq('id', id);

        if (sessionError) {
            console.error('Error eliminando sesión:', sessionError);
            return res.status(500).json({ error: 'Error al eliminar sesión.', details: sessionError.message });
        }

        console.log(`🗑️ Sesión ${id} eliminada con sus tracks`);
        res.json({ success: true, message: `Sesión ${id} eliminada.` });
    } catch (error) {
        console.error('Error en DELETE /session/:id:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

// ─── GET /export/csv ─── Exportar tracks como CSV ────────────────────────────
router.get('/export/csv', async (req, res) => {
    try {
        const { platform, genre, session_id } = req.query;
        const db = req.userClient;

        let query = db
            .from('tracks')
            .select('position, title, artist, remixer, label, release_date, genre, bpm, key, duration, platform')
            .order('position', { ascending: true });

        if (platform) query = query.eq('platform', platform.toLowerCase());
        if (genre) query = query.eq('genre', genre.toLowerCase());
        if (session_id) query = query.eq('session_id', session_id);

        const { data, error } = await query;

        if (error) {
            console.error('Error exportando CSV:', error);
            return res.status(500).json({ error: 'Error al exportar.', details: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No hay tracks para exportar con los filtros indicados.' });
        }

        // Generar CSV
        const headers = ['Posición', 'Título', 'Artista', 'Remixer', 'Sello', 'Fecha Lanzamiento', 'Género', 'BPM', 'Clave', 'Duración', 'Plataforma'];
        const fields = ['position', 'title', 'artist', 'remixer', 'label', 'release_date', 'genre', 'bpm', 'key', 'duration', 'platform'];

        const csvRows = [headers.join(',')];
        data.forEach(track => {
            const row = fields.map(f => {
                const val = (track[f] !== null && track[f] !== undefined) ? String(track[f]) : '';
                // Escapar comillas y envolver en comillas si contiene comas o comillas
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const filename = `tracks_${platform || 'all'}_${genre || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    } catch (error) {
        console.error('Error en GET /export/csv:', error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
});

module.exports = router;
