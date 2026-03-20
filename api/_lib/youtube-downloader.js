const express = require('express');
const axios = require('axios');

const router = express.Router();

// ─── Quality map matching Go backend  ─────────────────────────────────────────
const YT_QUALITY_MAP = {
    mp3_320:  { format: 'mp3',  bitrate: '320' },
    mp3_256:  { format: 'mp3',  bitrate: '256' },
    mp3_128:  { format: 'mp3',  bitrate: '128' },
    opus_256: { format: 'opus', bitrate: '256' },
    opus_128: { format: 'opus', bitrate: '128' },
};

const SPOTUBE_BASE = 'https://spotubedl.com';
const COBALT_API   = 'https://api.qwkuns.me';

const http = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractVideoID(url) {
    try {
        if (typeof url !== 'string') return null;
        if (url.includes('youtu.be/')) {
            return url.split('youtu.be/')[1].split('?')[0].split('&')[0] || null;
        }
        const parsed = new URL(url);
        const v = parsed.searchParams.get('v');
        if (v) return v;
        // /embed/ or /v/
        const match = parsed.pathname.match(/\/(?:embed|v)\/([^/]+)/);
        if (match) return match[1];
    } catch (_) {}
    return null;
}

function isYouTubeVideoID(s) {
    return typeof s === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(s);
}

// ─── Step 1 – Search using YouTube Data API v3 (if key available) ─────────────
async function searchYouTubeAPI(title, artist) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return null;

    const { google } = require('googleapis');
    const yt = google.youtube({ version: 'v3', auth: apiKey });

    const q = `${artist} ${title} official audio`;
    const response = await yt.search.list({
        part: 'id,snippet',
        q,
        type: 'video',
        maxResults: 3,
        videoCategoryId: '10',
    });

    const items = response.data.items;
    if (!items?.length) return null;

    const item = items[0];
    return {
        videoId:      item.id.videoId,
        title:        item.snippet.title,
        artist:       item.snippet.channelTitle,
        thumbnail:    item.snippet.thumbnails.high?.url
                   || item.snippet.thumbnails.medium?.url
                   || item.snippet.thumbnails.default?.url,
    };
}

// ─── Step 1 fallback – SpotubeDL search endpoint ───────────────────────────────
async function searchSpotubeDL(title, artist) {
    const query = `${artist} ${title}`;
    const url   = `${SPOTUBE_BASE}/api/search?q=${encodeURIComponent(query)}&limit=1`;

    const resp = await http.get(url, { timeout: 10000 });
    const result = resp.data?.results?.[0] || resp.data?.result;
    if (!result) return null;

    const videoId = result.videoId || result.id || result.video_id;
    if (!isYouTubeVideoID(videoId)) return null;

    return {
        videoId,
        title:     result.title  || result.name      || title,
        artist:    result.artist || result.channelTitle || artist,
        thumbnail: result.thumbnail || result.cover   || null,
    };
}

// ─── Step 2a – SpotubeDL download (primary – SpotubeDL handles Cobalt auth) ───
async function getSpotubeDLDownloadUrl(videoId, format, bitrate) {
    const engines = format === 'mp3' ? ['v1', 'v3', 'v2'] : ['v1'];

    for (const engine of engines) {
        try {
            const url = `${SPOTUBE_BASE}/api/download/${videoId}?engine=${encodeURIComponent(engine)}&format=${encodeURIComponent(format)}&quality=${encodeURIComponent(bitrate)}`;
            const resp = await http.get(url, { timeout: 20000 });

            let downloadUrl = (resp.data?.url || '').trim();
            if (downloadUrl.startsWith('/')) downloadUrl = SPOTUBE_BASE + downloadUrl;
            if (!downloadUrl.startsWith('http')) continue;

            return { url: downloadUrl, filename: resp.data?.filename || '' };
        } catch (_) {}
    }
    return null;
}

// ─── Step 2b – Direct Cobalt API (fallback) ────────────────────────────────────
async function getCobaltDownloadUrl(videoId, format, bitrate) {
    const musicUrl = `https://music.youtube.com/watch?v=${videoId}`;

    const resp = await http.post(COBALT_API, {
        url:             musicUrl,
        audioFormat:     format,
        audioBitrate:    bitrate,
        downloadMode:    'audio',
        filenameStyle:   'basic',
        disableMetadata: true,
    }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: 20000,
    });

    if (resp.data?.status === 'error') {
        throw new Error(resp.data.error?.code || 'Cobalt API error');
    }
    if (!resp.data?.url) {
        throw new Error(`Unexpected Cobalt status: ${resp.data?.status}`);
    }

    return { url: resp.data.url, filename: resp.data.filename || '' };
}

// ─── Resolve file extension from response / provider filename ─────────────────
function resolveExtension(format, providerFilename) {
    const lower = (providerFilename || '').toLowerCase().trim();
    if (lower.endsWith('.mp3'))                       return '.mp3';
    if (lower.endsWith('.opus') || lower.endsWith('.ogg')) return '.opus';
    return format === 'opus' ? '.opus' : '.mp3';
}

// ─── GET /api/youtube-dl/search ───────────────────────────────────────────────
// Returns: { success, track: { videoId, title, artist, thumbnail, available } }
router.get('/search', async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) {
        return res.status(400).json({ error: 'title and artist are required' });
    }

    let result = null;

    try { result = await searchYouTubeAPI(title, artist); } catch (_) {}
    if (!result) {
        try { result = await searchSpotubeDL(title, artist); } catch (_) {}
    }

    if (!result) {
        return res.json({
            success: true,
            track: { videoId: null, title, artist, thumbnail: null, available: false },
        });
    }

    return res.json({
        success: true,
        track: {
            videoId:   result.videoId,
            title:     result.title  || title,
            artist:    result.artist || artist,
            thumbnail: result.thumbnail,
            available: !!result.videoId,
        },
    });
});

// ─── GET /api/youtube-dl/download ─────────────────────────────────────────────
// Accepts: title, artist, quality (mp3_320 default), videoId (optional), filename
// Streams the audio file directly to the client.
router.get('/download', async (req, res) => {
    const { title, artist, quality = 'mp3_320', filename } = req.query;
    let { videoId } = req.query;

    if (!videoId && (!title || !artist)) {
        return res.status(400).json({ error: 'videoId or (title + artist) required' });
    }

    const { format, bitrate } = YT_QUALITY_MAP[quality] || YT_QUALITY_MAP.mp3_320;

    try {
        // 1. Resolve video ID if not provided
        if (!isYouTubeVideoID(videoId)) {
            let found = null;
            try { found = await searchYouTubeAPI(title, artist); } catch (_) {}
            if (!found) {
                try { found = await searchSpotubeDL(title, artist); } catch (_) {}
            }
            if (!found?.videoId) {
                return res.status(404).json({ error: 'No se encontró el video en YouTube' });
            }
            videoId = found.videoId;
        }

        // 2. Get download URL (SpotubeDL → Cobalt)
        let dlInfo = await getSpotubeDLDownloadUrl(videoId, format, bitrate);
        if (!dlInfo) dlInfo = await getCobaltDownloadUrl(videoId, format, bitrate);
        if (!dlInfo?.url) throw new Error('No se obtuvo URL de descarga');

        // 3. Determine extension
        const ext = resolveExtension(format, dlInfo.filename);
        const safeFilename = (filename || `${artist || ''} - ${title || ''}`)
            .replace(/[^\w\s()[\]-]/g, '').trim();

        // 4. Stream to client
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}${ext}"`);
        res.setHeader('Content-Type', ext === '.opus' ? 'audio/ogg' : 'audio/mpeg');

        const fileResp = await http.get(dlInfo.url, {
            responseType: 'stream',
            timeout: 180000,
        });

        if (fileResp.headers['content-length']) {
            res.setHeader('Content-Length', fileResp.headers['content-length']);
        }

        fileResp.data.pipe(res);
        fileResp.data.on('error', () => {
            if (!res.headersSent) res.status(500).json({ error: 'Error al transferir el archivo' });
        });

    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
