/**
 * API de la comunidad — Compartir listas CSV.
 *
 * Endpoints:
 *   GET    /api/community/lists         - Listar archivos de la comunidad (público)
 *   POST   /api/community/upload        - Subir un CSV (requiere auth)
 *   GET    /api/community/download/:id  - Descargar contenido de un CSV (público)
 *   DELETE /api/community/:id           - Eliminar un CSV propio (requiere auth)
 */
const express = require('express');
const { supabase, isSupabaseEnabled } = require('./supabase');
const { requireAuth } = require('./auth-middleware');
const router = express.Router();

const BUCKET = 'community-csvs';
const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── MODO MOCK (sin Supabase) ─────────────────────────────────────────────────
if (!isSupabaseEnabled()) {
    console.warn('⚠️  Community API en MODO MOCK: datos en memoria (se pierden al reiniciar).');

    const mockFiles = [];
    let nextId = 1;

    router.get('/lists', (_req, res) => res.json({ files: mockFiles }));

    router.post('/upload', requireAuth, (req, res) => {
        const { csvContent, name, genre, platform, description, tracks_count, uploader_name } = req.body;
        if (!csvContent || typeof csvContent !== 'string' || !name) {
            return res.status(400).json({ error: 'csvContent y name son requeridos.' });
        }
        const file = {
            id: String(nextId++),
            user_id: req.userId,
            uploader_name: (uploader_name || 'Anónimo').slice(0, 50),
            name: name.trim().slice(0, 100),
            genre: (genre || '').slice(0, 50),
            platform: (platform || '').slice(0, 50),
            description: (description || '').slice(0, 300),
            tracks_count: Math.max(0, parseInt(tracks_count) || 0),
            _csvContent: csvContent,
            created_at: new Date().toISOString(),
        };
        mockFiles.unshift(file);
        res.json({ success: true, id: file.id, message: 'Lista subida (mock).' });
    });

    router.get('/download/:id', (req, res) => {
        const file = mockFiles.find(f => f.id === req.params.id);
        if (!file) return res.status(404).json({ error: 'Lista no encontrada.' });
        res.json({ csvContent: file._csvContent, name: file.name });
    });

    router.delete('/:id', requireAuth, (req, res) => {
        const idx = mockFiles.findIndex(f => f.id === req.params.id && f.user_id === req.userId);
        if (idx === -1) return res.status(404).json({ error: 'No encontrado o sin permiso.' });
        mockFiles.splice(idx, 1);
        res.json({ success: true });
    });

    module.exports = router;
    // eslint-disable-next-line no-useless-return
    return;
}
// ─── FIN MODO MOCK ────────────────────────────────────────────────────────────

// GET /lists — público
router.get('/lists', async (req, res) => {
    try {
        const { genre, platform, search } = req.query;

        let query = supabase
            .from('community_files')
            .select('id, user_id, uploader_name, name, genre, platform, description, tracks_count, created_at')
            .order('created_at', { ascending: false })
            .limit(200);

        if (genre && genre !== 'Todos') query = query.eq('genre', genre);
        if (platform && platform !== 'Todos') query = query.eq('platform', platform);
        if (search) query = query.ilike('name', `%${search}%`);

        const { data, error } = await query;
        if (error) throw error;
        res.json({ files: data || [] });
    } catch (err) {
        console.error('Community list error:', err);
        res.status(500).json({ error: 'Error cargando listas de la comunidad.' });
    }
});

// POST /upload — requiere autenticación
router.post('/upload', requireAuth, async (req, res) => {
    try {
        const { csvContent, name, genre, platform, description, tracks_count, uploader_name } = req.body;

        if (!csvContent || typeof csvContent !== 'string') {
            return res.status(400).json({ error: 'csvContent es requerido y debe ser texto.' });
        }
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'El nombre de la lista es requerido.' });
        }
        if (Buffer.byteLength(csvContent, 'utf-8') > MAX_CSV_BYTES) {
            return res.status(400).json({ error: 'El CSV es demasiado grande (máx. 5 MB).' });
        }

        const safeName = name.trim()
            .replace(/[^a-zA-Z0-9_\-\s]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 60) || 'lista';
        const filename = `${req.userId}/${Date.now()}_${safeName}.csv`;

        const csvBuffer = Buffer.from(csvContent, 'utf-8');
        const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, csvBuffer, { contentType: 'text/csv; charset=utf-8', upsert: false });

        if (storageError) {
            console.error('Storage upload error:', storageError);
            return res.status(500).json({ error: 'Error subiendo el archivo: ' + storageError.message });
        }

        const { data, error: dbError } = await supabase
            .from('community_files')
            .insert({
                user_id: req.userId,
                uploader_name: (uploader_name || 'Anónimo').slice(0, 50),
                name: name.trim().slice(0, 100),
                filename,
                genre: (genre || '').slice(0, 50),
                platform: (platform || '').slice(0, 50),
                description: (description || '').slice(0, 300),
                tracks_count: Math.max(0, parseInt(tracks_count) || 0),
            })
            .select('id')
            .single();

        if (dbError) {
            await supabase.storage.from(BUCKET).remove([filename]);
            console.error('DB insert error:', dbError);
            return res.status(500).json({ error: 'Error guardando metadatos.' });
        }

        res.json({ success: true, id: data.id, message: '¡Lista subida correctamente!' });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Error interno al subir la lista.' });
    }
});

// GET /download/:id — público
router.get('/download/:id', async (req, res) => {
    try {
        if (!UUID_RE.test(req.params.id)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }
        const { data: file, error } = await supabase
            .from('community_files')
            .select('filename, name')
            .eq('id', req.params.id)
            .single();

        if (error || !file) return res.status(404).json({ error: 'Lista no encontrada.' });

        const { data: csvBlob, error: dlError } = await supabase.storage
            .from(BUCKET)
            .download(file.filename);

        if (dlError) {
            console.error('Storage download error:', dlError);
            return res.status(500).json({ error: 'Error descargando el archivo.' });
        }

        const csvContent = await csvBlob.text();
        res.json({ csvContent, name: file.name });
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Error interno.' });
    }
});

// DELETE /:id — requiere auth, solo el propietario
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        if (!UUID_RE.test(req.params.id)) {
            return res.status(400).json({ error: 'ID inválido.' });
        }
        const { data: file, error } = await supabase
            .from('community_files')
            .select('filename, user_id')
            .eq('id', req.params.id)
            .single();

        if (error || !file) return res.status(404).json({ error: 'Lista no encontrada.' });
        if (file.user_id !== req.userId) {
            return res.status(403).json({ error: 'Sin permiso para eliminar esta lista.' });
        }

        await supabase.storage.from(BUCKET).remove([file.filename]);
        await supabase.from('community_files').delete().eq('id', req.params.id);

        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Error eliminando la lista.' });
    }
});

module.exports = router;