/**
 * api/scrape-jobs.js — Lightweight Job Queue para scraping en Vercel Serverless
 *
 * Ciclo de vida de un job:
 *   POST /api/jobs          → crea el job (< 1 s), devuelve { jobId } de inmediato
 *   POST /api/jobs/:id/run  → ejecuta el scrape real (≤ 60 s en Vercel Hobby)
 *   GET  /api/jobs/:id      → devuelve estado actual (polling ligero, ≈ 100 ms)
 *
 * Patrón recomendado para scrape-multiple en el frontend:
 *   1. POST /api/jobs  con { platform, genres: [...] } → { jobIds: [...] }
 *   2. Para cada jobId: POST /api/jobs/:id/run  (en paralelo, Promise.all en cliente)
 *   3. Polling con GET /api/jobs/:id hasta status === 'done' | 'error'
 *
 * Upgrade path:
 *   - Vercel Pro: aumentar maxDuration en vercel.json hasta 800 s.
 *   - QStash (Upstash): tras el POST /api/jobs, publicar un mensaje QStash que
 *     invoca POST /api/jobs/:id/run como webhook, liberando al cliente de la espera.
 *   - Inngest: definir una función inngest que dispara scrapeJob.run({ jobId }).
 */
'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();

const { BEATPORT_GENRES } = require('./constants/beatport-genres');
const { scrapeBeatportGenre } = require('./beatport-scraper-fixed');
const { scrapeTraxsourceGenre, TRAXSOURCE_GENRES } = require('./traxsource-scraper');
const { retryWithBackoff, validateTrackData, getDownloadsDir } = require('./scraper-utils');
const { generateAndStoreCsv } = require('./services/csv-service');
const { saveSessionToSupabase } = require('./services/supabase-tracks-service');
const { isSupabaseEnabled } = require('./supabase');
const { optionalAuth } = require('./auth-middleware');
const scrapeCache = require('./scrape-cache');

// ── In-memory job store ───────────────────────────────────────────────────────
// Used when Supabase is not configured or as a mirror for fast in-process reads.
// ⚠️  Not shared across Vercel cold-starts — upgrade to Supabase/Redis for prod.
const _memJobs = new Map(); // jobId → { platform, genre, status, result, error, createdAt }

// ── Job store helpers ─────────────────────────────────────────────────────────

async function _createJob(db, userId, platform, genre) {
    const id = randomUUID();
    const snapshot = { platform, genre, status: 'pending', result: null, error: null, createdAt: new Date().toISOString() };

    if (isSupabaseEnabled() && db && userId) {
        try {
            const { data, error } = await db
                .from('scrape_jobs')
                .insert({ id, user_id: userId, platform, genre, status: 'pending' })
                .select('id')
                .single();
            if (!error && data) {
                _memJobs.set(data.id, snapshot); // mirror for fast in-process reads
                return data.id;
            }
        } catch (e) {
            console.warn('⚠️ Jobs DB write failed, falling back to in-memory:', e.message);
        }
    }

    _memJobs.set(id, snapshot);
    return id;
}

async function _readJob(db, jobId) {
    // Fast path: check in-memory mirror first
    const mem = _memJobs.get(jobId);

    if (isSupabaseEnabled() && db) {
        const { data } = await db.from('scrape_jobs').select('*').eq('id', jobId).maybeSingle();
        if (data) {
            _memJobs.set(jobId, data); // keep mirror fresh
            return data;
        }
    }

    return mem ?? null;
}

async function _patchJob(db, jobId, patch) {
    if (isSupabaseEnabled() && db) {
        await db.from('scrape_jobs')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', jobId);
    }
    const existing = _memJobs.get(jobId);
    if (existing) _memJobs.set(jobId, { ...existing, ...patch });
}

// ── Platform configuration ────────────────────────────────────────────────────

const _today = () => new Date().toISOString().split('T')[0];

const PLATFORM_CONFIG = {
    beatport: {
        isValid:      (genre) => !!BEATPORT_GENRES[genre],
        getUrl:       (genre) => BEATPORT_GENRES[genre],
        scrape:       (url, genre) => scrapeBeatportGenre(url, genre),
        sanitize:     (rawTracks) => rawTracks.map(t => validateTrackData(t)),
        csvHeaders: [
            { id: 'position',    title: 'Posicion' },
            { id: 'title',       title: 'Titulo' },
            { id: 'artist',      title: 'Artista' },
            { id: 'remixer',     title: 'Remixer' },
            { id: 'label',       title: 'Sello' },
            { id: 'releaseDate', title: 'Fecha de Lanzamiento' },
            { id: 'genre',       title: 'Genero' },
            { id: 'bpm',         title: 'BPM' },
            { id: 'key',         title: 'Clave Musical' },
            { id: 'length',      title: 'Duracion' },
        ],
        fileName:    (genre) => `beatport_${genre.replace(/-/g, '_')}_top100_${_today()}.csv`,
        storagePath: (genre, fn) => `beatport/${genre.toLowerCase()}/${fn}`,
        fallbackUrl: (genre, fn) => `/api/download/${genre}/${fn}`,
        localDir:    (genre) => getDownloadsDir(genre),
        trackMapper: (genre) => (t, idx, sid, uid) => ({
            session_id:   sid,
            user_id:      uid,
            platform:     'beatport',
            genre:        genre.toLowerCase(),
            position:     t.position || idx + 1,
            title:        t.title || '',
            artist:       t.artist || '',
            remixer:      t.remixer || '',
            label:        t.label || '',
            release_date: t.releaseDate || null,
            bpm:          t.bpm || null,
            key:          t.key || null,
            duration:     t.length || null,
        }),
    },

    traxsource: {
        isValid:      (genre) => !!TRAXSOURCE_GENRES[genre],
        getUrl:       (genre) => TRAXSOURCE_GENRES[genre],
        scrape:       (url, genre) => scrapeTraxsourceGenre(url, genre),
        sanitize:     (rawTracks) => rawTracks, // traxsource already returns clean objects
        csvHeaders: [
            { id: 'position', title: 'Position' },
            { id: 'title',    title: 'Title' },
            { id: 'mix',      title: 'Mix' },
            { id: 'artist',   title: 'Artist' },
            { id: 'label',    title: 'Label' },
            { id: 'duration', title: 'Duration' },
            { id: 'genre',    title: 'Genre' },
            { id: 'bpm',      title: 'BPM' },
            { id: 'key',      title: 'Key' },
            { id: 'price',    title: 'Price' },
            { id: 'platform', title: 'Platform' },
        ],
        fileName:    (genre) => `traxsource_${genre.replace(/-/g, '_')}_top100_${_today()}.csv`,
        storagePath: (genre, fn) => `traxsource/${genre.toLowerCase()}/${fn}`,
        fallbackUrl: (genre, fn) => `/api/traxsource/download/${genre}/${fn}`,
        localDir:    (genre) => getDownloadsDir(genre),
        trackMapper: (genre) => (t, idx, sid, uid) => ({
            session_id:   sid,
            user_id:      uid,
            platform:     'traxsource',
            genre:        genre.toLowerCase(),
            position:     t.position || idx + 1,
            title:        t.title || '',
            artist:       t.artist || '',
            remixer:      t.mix || '',
            label:        t.label || '',
            release_date: null,
            bpm:          t.bpm ? String(t.bpm) : null,
            key:          t.key || null,
            duration:     t.duration || null,
        }),
    },
};

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/jobs
 * Enqueue one or many scrape jobs. Responds in < 1 s.
 *
 * Body: { platform, genre } | { platform, genres: [...] }
 * Response (single): { jobId }
 * Response (batch):  { jobIds: [...] }
 */
router.post('/', optionalAuth, async (req, res) => {
    const { platform, genre, genres } = req.body;

    if (!platform || !PLATFORM_CONFIG[platform]) {
        return res.status(400).json({
            error: `"platform" inválida. Valores aceptados: ${Object.keys(PLATFORM_CONFIG).join(', ')}`,
        });
    }

    const genreList = Array.isArray(genres) ? genres : (genre ? [genre] : []);
    if (genreList.length === 0) return res.status(400).json({ error: '"genre" o "genres" es requerido' });
    if (genreList.length > 10) return res.status(400).json({ error: 'Máximo 10 géneros por lote' });

    const cfg = PLATFORM_CONFIG[platform];
    const invalid = genreList.filter(g => !cfg.isValid(g));
    if (invalid.length) return res.status(400).json({ error: `Géneros no válidos para ${platform}: ${invalid.join(', ')}` });

    const db = req.userClient ?? null;
    const ids = await Promise.all(genreList.map(g => _createJob(db, req.userId, platform, g)));

    console.log(`📋 Job(s) creado(s): ${ids.join(', ')} (${platform}/${genreList.join(', ')})`);
    return res.status(201).json(ids.length === 1 ? { jobId: ids[0] } : { jobIds: ids });
});

/**
 * POST /api/jobs/:id/run
 * Execute the scrape for a pending job. This is the heavy endpoint (≤ 60 s on Vercel Hobby).
 *
 * The client calls this immediately after receiving the jobId from POST /api/jobs.
 * Calling in parallel for multiple jobIds keeps each invocation within the 60 s budget.
 *
 * QStash/Inngest upgrade: replace the client-driven call to this endpoint with a
 * queued webhook invocation, so the client never waits for the scrape to finish.
 */
router.post('/:id/run', optionalAuth, async (req, res) => {
    const { id: jobId } = req.params;
    const db = req.userClient ?? null;

    const job = await _readJob(db, jobId);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });

    // Idempotency: return cached result if already completed
    if (job.status === 'done') {
        const result = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
        return res.json({ jobId, status: 'done', ...result });
    }
    if (job.status === 'running') {
        return res.status(409).json({ error: 'Job ya está en ejecución. Usa GET /api/jobs/:id para sondear el resultado.' });
    }

    await _patchJob(db, jobId, { status: 'running' });

    try {
        const { platform, genre } = job;
        const cfg = PLATFORM_CONFIG[platform];

        // Check cache before launching a browser
        let tracks;
        const cached = scrapeCache.get(platform, genre);
        if (cached) {
            tracks = cached.tracks;
            console.log(`⚡ Job ${jobId}: caché hit para ${platform}/${genre}`);
        } else {
            const url = cfg.getUrl(genre);
            const raw = await retryWithBackoff(() => cfg.scrape(url, genre), 2, 3000);
            tracks = cfg.sanitize(raw);
            if (tracks.length) scrapeCache.set(platform, genre, tracks);
        }

        if (!tracks.length) throw new Error(`No se obtuvieron tracks para ${platform}/${genre}`);

        // Generate & store CSV
        const fileName = cfg.fileName(genre);
        const { downloadUrl } = await generateAndStoreCsv({
            records:     tracks,
            headers:     cfg.csvHeaders,
            storagePath: cfg.storagePath(genre, fileName),
            localDir:    cfg.localDir(genre),
            fileName,
            fallbackUrl: cfg.fallbackUrl(genre, fileName),
        });

        // Persist session + tracks to Supabase (no-op when not authenticated)
        const { supabaseSaved, sessionId } = await saveSessionToSupabase(db, {
            userId:      req.userId,
            platform,
            genre,
            tracks,
            trackMapper: cfg.trackMapper(genre),
        });

        const result = {
            tracksCount:   tracks.length,
            fileName,
            downloadUrl,
            supabaseSaved,
            sessionId,
            preview:       tracks.slice(0, 10),
        };

        await _patchJob(db, jobId, { status: 'done', result: JSON.stringify(result) });
        console.log(`✅ Job ${jobId} completado: ${tracks.length} tracks (${platform}/${genre})`);

        return res.json({ jobId, status: 'done', genre, platform, ...result });

    } catch (err) {
        console.error(`❌ Job ${jobId} falló:`, err.message);
        await _patchJob(db, jobId, { status: 'error', error: err.message });
        return res.status(500).json({ jobId, status: 'error', error: err.message });
    }
});

/**
 * GET /api/jobs/:id
 * Poll job status. Fast endpoint (≈ 100 ms).
 */
router.get('/:id', optionalAuth, async (req, res) => {
    const { id: jobId } = req.params;
    const db = req.userClient ?? null;

    const job = await _readJob(db, jobId);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });

    const resp = {
        jobId,
        status:    job.status,
        platform:  job.platform,
        genre:     job.genre,
        createdAt: job.createdAt ?? job.created_at,
    };

    if (job.status === 'done' && job.result) {
        resp.result = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
    }
    if (job.status === 'error') resp.error = job.error;

    return res.json(resp);
});

module.exports = router;
