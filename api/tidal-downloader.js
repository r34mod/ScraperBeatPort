const express = require('express');
const axios = require('axios');

const router = express.Router();

// ─── Tidal public proxy APIs (same priority list as Go backend) ────────────────
const TIDAL_APIS = [
    'https://tidal-api.binimum.org',
    'https://tidal.kinoplus.online',
    'https://triton.squid.wtf',
    'https://vogel.qqdl.site',
    'https://maus.qqdl.site',
    'https://hund.qqdl.site',
    'https://katze.qqdl.site',
    'https://wolf.qqdl.site',
    'https://hifi-one.spotisaver.net',
    'https://hifi-two.spotisaver.net',
];

const http = axios.create({
    timeout: 25000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
});

// ─── Step 1: Search Deezer public API (no auth required) ─────────────────────
async function searchDeezer(title, artist) {
    const query = `artist:"${artist}" track:"${title}"`;
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`;

    const response = await http.get(url);
    const tracks = response.data?.data;

    if (!tracks || tracks.length === 0) {
        // Retry with simpler query
        const fallbackUrl = `https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=5`;
        const fallbackResponse = await http.get(fallbackUrl);
        const fallbackTracks = fallbackResponse.data?.data;
        if (!fallbackTracks || fallbackTracks.length === 0) {
            throw new Error('Track not found on Deezer');
        }
        return mapDeezerTrack(fallbackTracks[0]);
    }

    return mapDeezerTrack(tracks[0]);
}

function mapDeezerTrack(t) {
    return {
        deezerId: String(t.id),
        title: t.title,
        artist: t.artist?.name || '',
        album: t.album?.title || '',
        cover: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '',
        duration: t.duration,
        preview: t.preview || null,
    };
}

// ─── Step 2: Resolve Tidal track ID via SongLink ──────────────────────────────
async function getTidalIdViaSongLink(deezerId) {
    const deezerUrl = `https://www.deezer.com/track/${deezerId}`;
    const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(deezerUrl)}`;

    const response = await http.get(apiUrl, { timeout: 15000 });
    const links = response.data?.linksByPlatform;

    if (!links?.tidal?.url) {
        throw new Error('Track not available on Tidal (SongLink)');
    }

    const tidalUrl = links.tidal.url;
    // Support both tidal.com/track/ID and listen.tidal.com/track/ID
    const match = tidalUrl.match(/\/track\/(\d+)/);
    if (!match) throw new Error('Could not parse Tidal track ID from URL');

    return { trackId: parseInt(match[1], 10), tidalUrl };
}

// ─── Step 3: Fetch download info from a single Tidal proxy API (with retry) ──
async function fetchFromTidalAPI(apiUrl, trackId, quality) {
    const url = `${apiUrl}/track/?id=${trackId}&quality=${quality}`;
    let delay = 500;

    for (let attempt = 0; attempt <= 2; attempt++) {
        if (attempt > 0) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }

        try {
            const response = await http.get(url, { timeout: 25000 });
            const data = response.data;

            // V2 response format: { data: { manifest, manifestMimeType, bitDepth, sampleRate, ... } }
            if (data?.data?.manifest) {
                if (data.data.assetPresentation === 'PREVIEW') {
                    return null;
                }
                return {
                    manifest: data.data.manifest,
                    manifestMimeType: data.data.manifestMimeType || '',
                    bitDepth: data.data.bitDepth || 0,
                    sampleRate: data.data.sampleRate || 0,
                    audioQuality: data.data.audioQuality || quality,
                };
            }

            // V1 response format: array with { OriginalTrackUrl }
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.OriginalTrackUrl) {
                        return {
                            directUrl: item.OriginalTrackUrl,
                            bitDepth: 16,
                            sampleRate: 44100,
                            audioQuality: quality,
                        };
                    }
                }
            }

            return null;
        } catch (err) {
            const status = err.response?.status;
            const msg = err.message?.toLowerCase() || '';
            const isRetryable =
                status >= 500 ||
                status === 429 ||
                msg.includes('timeout') ||
                msg.includes('reset') ||
                msg.includes('econnrefused') ||
                msg.includes('eof');

            if (!isRetryable) return null;
        }
    }

    return null;
}

// ─── Step 4: Query all Tidal APIs in parallel (first success wins) ────────────
async function getDownloadInfoParallel(trackId, quality) {
    const settled = await Promise.allSettled(
        TIDAL_APIS.map(api => fetchFromTidalAPI(api, trackId, quality))
    );

    for (const result of settled) {
        if (result.status === 'fulfilled' && result.value) {
            return result.value;
        }
    }

    throw new Error('All Tidal APIs failed to return a download URL');
}

// ─── Manifest parser (BTS JSON or DASH XML) ───────────────────────────────────
function parseManifest(manifestB64) {
    const manifestStr = Buffer.from(manifestB64, 'base64').toString('utf8');

    // BTS manifest (JSON) → single direct URL
    if (manifestStr.trimStart().startsWith('{')) {
        const parsed = JSON.parse(manifestStr);
        if (!parsed.urls?.length) throw new Error('No URLs in BTS manifest');
        return { type: 'bts', directUrl: parsed.urls[0], mimeType: parsed.mimeType || 'audio/mp4' };
    }

    // DASH manifest (XML MPD) → init segment + numbered media segments
    const initMatch = manifestStr.match(/initialization="([^"]+)"/);
    const mediaMatch = manifestStr.match(/media="([^"]+)"/);
    if (!initMatch) throw new Error('No initialization URL in DASH manifest');

    const initUrl = initMatch[1].replace(/&amp;/g, '&');
    const mediaTemplate = (mediaMatch?.[1] || '').replace(/&amp;/g, '&');

    let segmentCount = 0;
    for (const match of manifestStr.matchAll(/<S\s+d="(\d+)"(?:\s+r="(\d+)")?/g)) {
        segmentCount += parseInt(match[2] || '0', 10) + 1;
    }
    if (segmentCount === 0) throw new Error('No segments found in DASH manifest');

    const segmentUrls = [];
    for (let i = 1; i <= segmentCount; i++) {
        segmentUrls.push(mediaTemplate.replace('$Number$', String(i)));
    }

    return { type: 'dash', initUrl, segmentUrls };
}

// ─── Helper: pipe a remote URL into a response stream ───────────────────────
async function pipeUrlToRes(url, writableRes) {
    const resp = await http.get(url, { responseType: 'stream', timeout: 60000 });
    await new Promise((resolve, reject) => {
        resp.data.pipe(writableRes, { end: false });
        resp.data.on('end', resolve);
        resp.data.on('error', reject);
    });
}

// ─── Helper: proxy a direct audio URL with proper download headers ────────────
async function proxyDirectUrl(remoteUrl, res, safeFilename, ext, contentType) {
    const resp = await http.get(remoteUrl, { responseType: 'stream', timeout: 60000 });
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}${ext}"`);
    res.setHeader('Content-Type', contentType || 'audio/mp4');
    res.setHeader('Cache-Control', 'no-store');
    // Forward Content-Length when available so browsers show real progress
    const cl = resp.headers['content-length'];
    if (cl) res.setHeader('Content-Length', cl);
    await new Promise((resolve, reject) => {
        resp.data.pipe(res, { end: false });
        resp.data.on('end', resolve);
        resp.data.on('error', reject);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/tidal/search?title=...&artist=...
 * Searches Deezer + SongLink, returns track info + tidalId if available.
 */
router.get('/search', async (req, res) => {
    const { title, artist } = req.query;

    if (!title || !artist) {
        return res.status(400).json({ error: 'Los parámetros title y artist son requeridos' });
    }

    try {
        const deezerTrack = await searchDeezer(title.trim(), artist.trim());

        let tidalInfo = null;
        try {
            tidalInfo = await getTidalIdViaSongLink(deezerTrack.deezerId);
        } catch {
            // No Tidal match — still return Deezer info so the UI shows what was found
        }

        res.json({
            success: true,
            track: {
                ...deezerTrack,
                tidalId: tidalInfo?.trackId ?? null,
                tidalUrl: tidalInfo?.tidalUrl ?? null,
                tidalAvailable: tidalInfo !== null,
            },
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

/**
 * GET /api/tidal/download?tidalId=...&quality=LOSSLESS&filename=...
 * Streams the audio file directly to the client.
 * For DASH manifests: stitches init + segments on the fly.
 */
router.get('/download', async (req, res) => {
    const { tidalId, quality = 'LOSSLESS', filename = 'track' } = req.query;

    if (!tidalId) {
        return res.status(400).json({ error: 'El parámetro tidalId es requerido' });
    }

    try {
        const info = await getDownloadInfoParallel(parseInt(tidalId, 10), quality);
        const safeFilename = filename.replace(/[^a-zA-Z0-9 _()-]/g, '').trim() || 'track';
        const ext = quality === 'HIGH' ? '.m4a' : '.m4a';
        const contentType = 'audio/mp4';

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');

        // ── Direct URL (V1 API) ─────────────────────────────────────────────
        if (info.directUrl) {
            await proxyDirectUrl(info.directUrl, res, safeFilename, ext, contentType);
            return res.end();
        }

        // ── Manifest-based download ─────────────────────────────────────────
        if (info.manifest) {
            const parsed = parseManifest(info.manifest);

            // BTS: single direct URL inside JSON manifest
            if (parsed.type === 'bts') {
                await proxyDirectUrl(parsed.directUrl, res, safeFilename, ext, contentType);
                return res.end();
            }

            // DASH: stitch init segment + numbered media segments
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}${ext}"`);
            res.setHeader('Content-Type', contentType);

            await pipeUrlToRes(parsed.initUrl, res);
            for (const segUrl of parsed.segmentUrls) {
                await pipeUrlToRes(segUrl, res);
            }

            return res.end();
        }

        res.status(500).json({ error: 'No se pudo obtener la URL de descarga' });
    } catch (err) {
        console.error('[Tidal] Download error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
