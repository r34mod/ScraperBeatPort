/**
 * Spotify Metadata API — traducción directa del cliente Go a Node.js
 *
 * Endpoints:
 *   POST /api/spotify/resolve         { url: "URL o URI de Spotify" }
 *   GET  /api/spotify/search          ?q=...&limit=20
 *   GET  /api/spotify/search/all      ?q=...&trackLimit=20&artistLimit=5
 *   GET  /api/spotify/related/:id     ?limit=20
 *   GET  /api/spotify/health
 *
 * Variables de entorno requeridas:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */

const express = require('express');
const axios   = require('axios');

const router = express.Router();

// ─── Constantes ───────────────────────────────────────────────────────────────
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_BASE_URL   = 'https://api.spotify.com/v1/search';

const ARTIST_CACHE_TTL = 10 * 60 * 1000; // 10 min
const SEARCH_CACHE_TTL =  5 * 60 * 1000; //  5 min
const ALBUM_CACHE_TTL  = 10 * 60 * 1000; // 10 min

// ─── SpotifyClient ────────────────────────────────────────────────────────────
class SpotifyClient {
    constructor() {
        this.clientId       = process.env.SPOTIFY_CLIENT_ID     || '';
        this.clientSecret   = process.env.SPOTIFY_CLIENT_SECRET || '';
        this.cachedToken    = null;
        this.tokenExpiresAt = 0;
        this.artistCache    = new Map();
        this.searchCache    = new Map();
        this.albumCache     = new Map();
        this.http = axios.create({ timeout: 15000 });
    }

    // ─── Cache helpers ────────────────────────────────────────────────────────
    _cacheGet(cache, key) {
        const e = cache.get(key);
        if (e && Date.now() < e.expiresAt) return e.data;
        cache.delete(key);
        return null;
    }

    _cacheSet(cache, key, data, ttl) {
        cache.set(key, { data, expiresAt: Date.now() + ttl });
    }

    // ─── Auth ─────────────────────────────────────────────────────────────────
    async getAccessToken() {
        if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
            return this.cachedToken;
        }
        if (!this.clientId || !this.clientSecret) {
            throw new Error(
                'Spotify credentials not configured. ' +
                'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env'
            );
        }

        const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const resp  = await this.http.post(
            SPOTIFY_TOKEN_URL,
            'grant_type=client_credentials',
            { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        this.cachedToken    = resp.data.access_token;
        const expiresIn     = Number(resp.data.expires_in) || 3600;
        this.tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
        return this.cachedToken;
    }

    // ─── HTTP helper ──────────────────────────────────────────────────────────
    async _getJSON(url, token) {
        const resp = await this.http.get(url, {
            headers: {
                Authorization:          `Bearer ${token}`,
                'User-Agent':           this._randomUserAgent(),
                Accept:                 'application/json',
                'Accept-Language':      'en-US,en;q=0.9',
                'sec-ch-ua-platform':   '"Windows"',
                'sec-fetch-dest':       'empty',
                'sec-fetch-mode':       'cors',
                'sec-fetch-site':       'same-origin',
                Referer:                'https://open.spotify.com/',
                Origin:                 'https://open.spotify.com',
            },
        });
        return resp.data;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    _randomUserAgent() {
        const ri = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
        const macMaj = ri(11, 14), macMin = ri(4, 8);
        const wkMaj  = ri(530, 536), wkMin = ri(30, 36);
        const chrMaj = ri(80, 104), chrBld = ri(3000, 4500), chrPch = ri(60, 124);
        const sfMaj  = ri(530, 536), sfMin  = ri(30, 35);
        return (
            `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_${macMaj}_${macMin}) ` +
            `AppleWebKit/${wkMaj}.${wkMin} (KHTML, like Gecko) ` +
            `Chrome/${chrMaj}.0.${chrBld}.${chrPch} Safari/${sfMaj}.${sfMin}`
        );
    }

    _joinArtists(artists = []) {
        return (artists || []).map(a => a.name).join(', ');
    }

    _firstImage(images = []) {
        return images && images.length > 0 ? images[0].url : '';
    }

    _mapTrackFull(t) {
        return {
            spotify_id:   t.id,
            artists:      this._joinArtists(t.artists),
            name:         t.name,
            album_name:   t.album?.name        || '',
            album_artist: this._joinArtists(t.album?.artists),
            duration_ms:  t.duration_ms,
            images:       this._firstImage(t.album?.images),
            release_date: t.album?.release_date || '',
            track_number: t.track_number,
            total_tracks: t.album?.total_tracks || 0,
            disc_number:  t.disc_number         || 1,
            external_urls: t.external_urls?.spotify || '',
            isrc:         t.external_ids?.isrc  || '',
            album_id:     t.album?.id           || '',
            artist_id:    t.artists?.[0]?.id    || '',
            album_type:   t.album?.album_type   || '',
        };
    }

    // ─── Resolver principal ───────────────────────────────────────────────────
    async getFilteredData(spotifyURL) {
        const { type, id } = parseSpotifyURI(spotifyURL);
        const token = await this.getAccessToken();
        switch (type) {
            case 'track':    return this.fetchTrack(id, token);
            case 'album':    return this.fetchAlbum(id, token);
            case 'playlist': return this.fetchPlaylist(id, token);
            case 'artist':   return this.fetchArtist(id, token);
            default: throw new Error(`Unsupported Spotify type: ${type}`);
        }
    }

    // ─── Búsqueda ─────────────────────────────────────────────────────────────
    async searchTracks(query, limit = 20) {
        const token = await this.getAccessToken();
        const url   = `${SEARCH_BASE_URL}?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
        const data  = await this._getJSON(url, token);
        return {
            tracks: (data.tracks?.items || []).map(t => this._mapTrackFull(t)),
            total:  data.tracks?.total || 0,
        };
    }

    async searchAll(query, trackLimit = 20, artistLimit = 5) {
        const cacheKey = `all:${query}:${trackLimit}:${artistLimit}`;
        const cached   = this._cacheGet(this.searchCache, cacheKey);
        if (cached) return cached;

        const token = await this.getAccessToken();
        const url   = `${SEARCH_BASE_URL}?q=${encodeURIComponent(query)}&type=track,artist&limit=${trackLimit}`;
        const data  = await this._getJSON(url, token);

        const result = {
            tracks: (data.tracks?.items || []).map(t => this._mapTrackFull(t)),
            artists: (data.artists?.items || []).slice(0, artistLimit).map(a => ({
                id:         a.id,
                name:       a.name,
                images:     this._firstImage(a.images),
                followers:  a.followers?.total || 0,
                popularity: a.popularity,
            })),
            albums:    [],
            playlists: [],
        };

        this._cacheSet(this.searchCache, cacheKey, result, SEARCH_CACHE_TTL);
        return result;
    }

    async getRelatedArtists(artistId, limit = 20) {
        const token = await this.getAccessToken();
        const data  = await this._getJSON(
            `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
            token
        );
        const items = (data.artists || []).slice(0, limit > 0 ? limit : undefined);
        return items.map(a => ({
            id:         a.id,
            name:       a.name,
            images:     this._firstImage(a.images),
            followers:  a.followers?.total || 0,
            popularity: a.popularity,
        }));
    }

    // ─── Fetchers individuales ────────────────────────────────────────────────
    async fetchTrack(trackId, token) {
        const data = await this._getJSON(`https://api.spotify.com/v1/tracks/${trackId}`, token);
        return { track: this._mapTrackFull(data) };
    }

    async fetchAlbum(albumId, token) {
        const cached = this._cacheGet(this.albumCache, albumId);
        if (cached) return cached;

        const data  = await this._getJSON(`https://api.spotify.com/v1/albums/${albumId}`, token);
        const cover = this._firstImage(data.images);

        const albumInfo = {
            total_tracks: data.total_tracks,
            name:         data.name,
            release_date: data.release_date,
            artists:      this._joinArtists(data.artists),
            artist_id:    data.artists?.[0]?.id || '',
            images:       cover,
        };

        // Paginar tracks del álbum
        let allItems = [...(data.tracks?.items || [])];
        let nextURL  = data.tracks?.next;
        while (nextURL) {
            const page = await this._getJSON(nextURL, token);
            allItems   = allItems.concat(page.items || []);
            nextURL    = page.next;
        }
        console.log(`[Spotify] Album "${data.name}": ${allItems.length} tracks (total: ${data.total_tracks})`);

        // ISRCs en paralelo (los items de álbum no traen external_ids)
        const isrcMap = await this._fetchISRCsParallel(allItems.map(t => t.id), token);

        const trackList = allItems.map(item => ({
            spotify_id:   item.id,
            artists:      this._joinArtists(item.artists),
            name:         item.name,
            album_name:   data.name,
            album_artist: this._joinArtists(data.artists),
            duration_ms:  item.duration_ms,
            images:       cover,
            release_date: data.release_date,
            track_number: item.track_number,
            total_tracks: data.total_tracks,
            disc_number:  item.disc_number || 1,
            external_urls: item.external_urls?.spotify || '',
            isrc:         isrcMap[item.id] || '',
            album_id:     albumId,
        }));

        const result = { album_info: albumInfo, track_list: trackList };
        this._cacheSet(this.albumCache, albumId, result, ALBUM_CACHE_TTL);
        return result;
    }

    async fetchPlaylist(playlistId, token) {
        const data = await this._getJSON(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            token
        );

        const playlistInfo = {
            tracks: { total: data.tracks?.total || 0 },
            owner:  {
                display_name: data.owner?.display_name || '',
                name:         data.name,
                images:       this._firstImage(data.images),
            },
        };

        const mapItem = (item) => {
            const t = item?.track;
            if (!t) return null;
            return {
                spotify_id:   t.id,
                artists:      this._joinArtists(t.artists),
                name:         t.name,
                album_name:   t.album?.name        || '',
                album_artist: this._joinArtists(t.album?.artists),
                duration_ms:  t.duration_ms,
                images:       this._firstImage(t.album?.images),
                release_date: t.album?.release_date || '',
                track_number: t.track_number,
                total_tracks: t.album?.total_tracks || 0,
                disc_number:  t.disc_number         || 1,
                external_urls: t.external_urls?.spotify || '',
                isrc:         t.external_ids?.isrc  || '',
                album_id:     t.album?.id           || '',
                album_url:    t.album?.external_urls?.spotify || '',
            };
        };

        let tracks  = (data.tracks?.items || []).map(mapItem).filter(Boolean);
        let nextURL = data.tracks?.next;
        while (nextURL) {
            const page = await this._getJSON(nextURL, token);
            tracks     = tracks.concat((page.items || []).map(mapItem).filter(Boolean));
            nextURL    = page.next;
        }
        console.log(`[Spotify] Playlist "${data.name}": ${tracks.length} tracks (total: ${data.tracks?.total})`);

        return { playlist_info: playlistInfo, track_list: tracks };
    }

    async fetchArtist(artistId, token) {
        const cached = this._cacheGet(this.artistCache, artistId);
        if (cached) return cached;

        const artistData = await this._getJSON(
            `https://api.spotify.com/v1/artists/${artistId}`,
            token
        );
        const artistInfo = {
            id:         artistData.id,
            name:       artistData.name,
            images:     this._firstImage(artistData.images),
            followers:  artistData.followers?.total || 0,
            popularity: artistData.popularity,
        };

        let albums = [];
        let offset = 0;
        const limit = 50;

        while (true) {
            const url  = `https://api.spotify.com/v1/artists/${artistId}/albums` +
                         `?include_groups=album,single,compilation&limit=${limit}&offset=${offset}`;
            const page = await this._getJSON(url, token);

            for (const album of page.items || []) {
                albums.push({
                    id:           album.id,
                    name:         album.name,
                    release_date: album.release_date,
                    total_tracks: album.total_tracks,
                    images:       this._firstImage(album.images),
                    album_type:   album.album_type,
                    artists:      this._joinArtists(album.artists),
                });
            }

            if (!page.next || (page.items || []).length < limit || offset >= 500) break;
            offset += limit;
        }

        const result = { artist_info: artistInfo, albums };
        this._cacheSet(this.artistCache, artistId, result, ARTIST_CACHE_TTL);
        return result;
    }

    // ─── ISRCs en paralelo (max 10 concurrentes) ──────────────────────────────
    async _fetchISRCsParallel(trackIds, token) {
        const MAX_PARALLEL = 10;
        const result = {};

        for (let i = 0; i < trackIds.length; i += MAX_PARALLEL) {
            const batch   = trackIds.slice(i, i + MAX_PARALLEL);
            const entries = await Promise.all(
                batch.map(async (id) => {
                    try {
                        const data = await this._getJSON(
                            `https://api.spotify.com/v1/tracks/${id}`,
                            token
                        );
                        return [id, data.external_ids?.isrc || ''];
                    } catch {
                        return [id, ''];
                    }
                })
            );
            for (const [id, isrc] of entries) result[id] = isrc;
        }

        return result;
    }
}

// ─── Instancia singleton ──────────────────────────────────────────────────────
const client = new SpotifyClient();

// ─── Parser de URI/URL de Spotify ────────────────────────────────────────────
function parseSpotifyURI(input) {
    const s = (input || '').trim();
    if (!s) throw new Error('Invalid or unsupported Spotify URL');

    // spotify:type:id
    if (s.startsWith('spotify:')) {
        const parts = s.split(':');
        if (parts.length === 3 && ['album', 'track', 'playlist', 'artist'].includes(parts[1])) {
            return { type: parts[1], id: parts[2] };
        }
    }

    let parsed;
    try {
        parsed = new URL(s);
    } catch {
        // Sin esquema ni host → tratar como ID de playlist
        const id = s.replace(/^\/|\/$/g, '');
        if (id) return { type: 'playlist', id };
        throw new Error('Invalid or unsupported Spotify URL');
    }

    // embed.spotify.com?uri=...
    if (parsed.hostname === 'embed.spotify.com') {
        const uri = parsed.searchParams.get('uri');
        if (!uri) throw new Error('Invalid or unsupported Spotify URL');
        return parseSpotifyURI(uri);
    }

    if (!['open.spotify.com', 'play.spotify.com'].includes(parsed.hostname)) {
        throw new Error('Invalid or unsupported Spotify URL');
    }

    let parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed')          parts = parts.slice(1);
    if (parts[0]?.startsWith('intl-')) parts = parts.slice(1);

    if (parts.length === 2 && ['album', 'track', 'playlist', 'artist'].includes(parts[0])) {
        return { type: parts[0], id: parts[1] };
    }
    if (parts.length === 4 && parts[2] === 'playlist') {
        return { type: 'playlist', id: parts[3] };
    }

    throw new Error('Invalid or unsupported Spotify URL');
}

// ─── Rutas Express ────────────────────────────────────────────────────────────

/**
 * POST /api/spotify/resolve
 * Body: { url: "https://open.spotify.com/track/..." }
 * Resuelve cualquier URL/URI de Spotify: track, album, playlist o artist.
 */
router.post('/resolve', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'url is required' });
        const result = await client.getFilteredData(url);
        res.json({ success: true, ...result });
    } catch (err) {
        const status = err.message.includes('credentials') ? 503
                     : err.message.includes('Invalid')     ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/spotify/search?q=fisher+losing+it&limit=20
 * Busca tracks por nombre/artista.
 */
router.get('/search', async (req, res) => {
    try {
        const { q, limit = '20' } = req.query;
        if (!q) return res.status(400).json({ success: false, error: 'q is required' });
        const result = await client.searchTracks(q, Math.min(parseInt(limit, 10) || 20, 50));
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/spotify/search/all?q=fisher&trackLimit=20&artistLimit=5
 * Devuelve tracks + artistas en una sola llamada (con caché 5 min).
 */
router.get('/search/all', async (req, res) => {
    try {
        const { q, trackLimit = '20', artistLimit = '5' } = req.query;
        if (!q) return res.status(400).json({ success: false, error: 'q is required' });
        const result = await client.searchAll(
            q,
            Math.min(parseInt(trackLimit, 10)  || 20, 50),
            Math.min(parseInt(artistLimit, 10) ||  5, 20)
        );
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/spotify/related/:artistId?limit=20
 * Artistas relacionados.
 */
router.get('/related/:artistId', async (req, res) => {
    try {
        const { artistId } = req.params;
        const { limit = '20' } = req.query;
        const artists = await client.getRelatedArtists(artistId, parseInt(limit, 10) || 20);
        res.json({ success: true, artists });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/spotify/health
 */
router.get('/health', (req, res) => {
    res.json({
        success:    true,
        service:    'Spotify Metadata API',
        configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    });
});

module.exports = router;
