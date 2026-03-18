/**
 * In-memory TTL cache for scrape results.
 * Prevents redundant Puppeteer browser launches when the same platform/genre
 * is requested multiple times within the TTL window.
 *
 * Usage:
 *   const scrapeCache = require('./scrape-cache');
 *   const entry = scrapeCache.get('beatport', 'house');   // null if missing/expired
 *   scrapeCache.set('beatport', 'house', tracks);          // stores for DEFAULT_TTL_MS
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const _cache = new Map();

/**
 * Returns a cached entry ({ tracks, cachedAt, expiresAt }) or null if missing/expired.
 */
function get(platform, genre) {
    const key = `${platform}:${genre}`;
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        _cache.delete(key);
        return null;
    }
    return entry;
}

/**
 * Stores tracks in the cache with a TTL.
 * @param {string} platform  e.g. 'beatport', 'traxsource'
 * @param {string} genre     e.g. 'house', 'tech-house'
 * @param {Array}  tracks    Validated track objects
 * @param {number} [ttlMs]   Time-to-live in ms (default: 1 hour)
 */
function set(platform, genre, tracks, ttlMs = DEFAULT_TTL_MS) {
    const key = `${platform}:${genre}`;
    _cache.set(key, {
        tracks,
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + ttlMs,
    });
    console.log(`📦 Cacheados ${tracks.length} tracks para ${platform}/${genre} (TTL: ${ttlMs / 60000} min)`);
}

/**
 * Removes a specific entry from the cache.
 */
function invalidate(platform, genre) {
    _cache.delete(`${platform}:${genre}`);
    console.log(`🗑️  Caché invalidada para ${platform}/${genre}`);
}

/**
 * Removes all entries for a given platform, or all entries if no platform given.
 */
function clear(platform) {
    if (!platform) {
        _cache.clear();
        console.log('🗑️  Caché completamente vaciada');
        return;
    }
    for (const key of _cache.keys()) {
        if (key.startsWith(`${platform}:`)) _cache.delete(key);
    }
    console.log(`🗑️  Caché vaciada para plataforma: ${platform}`);
}

/**
 * Returns statistics about the current (non-expired) cache state.
 */
function stats() {
    const now = Date.now();
    const entries = [];
    for (const [key, entry] of _cache.entries()) {
        if (now > entry.expiresAt) {
            _cache.delete(key); // lazy expiry
            continue;
        }
        const [platform, ...rest] = key.split(':');
        entries.push({
            platform,
            genre: rest.join(':'),
            tracksCount: entry.tracks.length,
            cachedAt: entry.cachedAt,
            expiresInMin: Math.round((entry.expiresAt - now) / 60000),
        });
    }
    return { count: entries.length, entries };
}

module.exports = { get, set, invalidate, clear, stats, DEFAULT_TTL_MS };
