/**
 * API para gestionar canciones guardadas (liked songs).
 *
 * Todos los endpoints requieren autenticación Bearer JWT.
 * Datos aislados por usuario mediante user_id + RLS de Supabase.
 *
 * Endpoints:
 *   GET    /api/likes        - Listar canciones guardadas del usuario
 *   POST   /api/likes        - Guardar una canción
 *   DELETE /api/likes/:id    - Eliminar una canción guardada
 */

const express = require('express');
const router = express.Router();
const { isSupabaseEnabled } = require('./supabase');
const { requireAuth } = require('./auth-middleware');

router.use(requireAuth);

// ─── MOCK MODE (desarrollo sin Supabase) ───────────────────────────────────
if (!isSupabaseEnabled()) {
    console.warn('⚠️  Likes API en MODO MOCK: datos en memoria (se pierden al reiniciar).');

    const mockLikes = [];
    let nextId = 1;

    router.get('/', (req, res) => {
        const userLikes = mockLikes
            .filter(l => l.user_id === req.userId)
            .sort((a, b) => new Date(b.liked_at) - new Date(a.liked_at));
        return res.json({ likes: userLikes });
    });

    router.post('/', (req, res) => {
        const { title, artist = '', artwork_url = '', sc_label = '' } = req.body;
        if (!title) return res.status(400).json({ error: 'title es requerido.' });

        const existing = mockLikes.find(
            l => l.user_id === req.userId && l.title === title && l.artist === artist
        );
        if (existing) return res.json({ like: existing, duplicate: true });

        const like = {
            id: String(nextId++),
            user_id: req.userId,
            title,
            artist,
            artwork_url,
            sc_label,
            liked_at: new Date().toISOString(),
        };
        mockLikes.push(like);
        return res.status(201).json({ like });
    });

    router.delete('/:id', (req, res) => {
        const { id } = req.params;
        const idx = mockLikes.findIndex(l => l.id === id && l.user_id === req.userId);
        if (idx === -1) return res.status(404).json({ error: 'No encontrado.' });
        mockLikes.splice(idx, 1);
        return res.json({ success: true });
    });

} else {
    // ─── SUPABASE MODE ─────────────────────────────────────────────────────

    router.get('/', async (req, res) => {
        try {
            const { data, error } = await req.userClient
                .from('liked_songs')
                .select('id, title, artist, artwork_url, sc_label, liked_at')
                .eq('user_id', req.userId)
                .order('liked_at', { ascending: false });
            if (error) throw error;
            return res.json({ likes: data || [] });
        } catch (err) {
            console.error('Error fetching liked songs:', err);
            return res.status(500).json({ error: 'Error al obtener canciones guardadas.' });
        }
    });

    router.post('/', async (req, res) => {
        const { title, artist = '', artwork_url = '', sc_label = '' } = req.body;
        if (!title) return res.status(400).json({ error: 'title es requerido.' });

        try {
            // Prevent duplicates: same user + title + artist
            const { data: existing, error: checkErr } = await req.userClient
                .from('liked_songs')
                .select('id, title, artist, artwork_url, sc_label, liked_at')
                .eq('user_id', req.userId)
                .eq('title', title)
                .eq('artist', artist)
                .maybeSingle();
            if (checkErr) throw checkErr;
            if (existing) return res.json({ like: existing, duplicate: true });

            const { data, error } = await req.userClient
                .from('liked_songs')
                .insert({ user_id: req.userId, title, artist, artwork_url, sc_label })
                .select()
                .single();
            if (error) throw error;
            return res.status(201).json({ like: data });
        } catch (err) {
            console.error('Error saving liked song:', err);
            return res.status(500).json({ error: 'Error al guardar la canción.' });
        }
    });

    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        // Validate UUID format to prevent injection
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }
        try {
            const { error } = await req.userClient
                .from('liked_songs')
                .delete()
                .eq('id', id)
                .eq('user_id', req.userId);
            if (error) throw error;
            return res.json({ success: true });
        } catch (err) {
            console.error('Error deleting liked song:', err);
            return res.status(500).json({ error: 'Error al eliminar la canción.' });
        }
    });
}

module.exports = router;
