'use strict';
/**
 * genre-discovery.js
 *
 * Resolves live Beatport genre → Top 100 URL mappings without a dedicated
 * browser launch.  Every Beatport page already renders the full "Genres"
 * dropdown in its React header, so we extract links as a *side-effect* of
 * the normal scraping session (via updateDiscoveryFromPage).
 *
 * Priority when resolving a URL for a slug:
 *   1. Discovered URL  (from the most recent live page)
 *   2. Hardcoded fallback in BEATPORT_GENRES constant
 *   3. null → caller should treat the genre as invalid
 *
 * The cache TTL is intentionally long (24h) because genre IDs on Beatport
 * rarely change; the passive update on every scrape keeps it fresh regardless.
 */

const { BEATPORT_GENRES } = require('../constants/beatport-genres');

const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// slug → canonical URL  (e.g. 'house' → 'https://www.beatport.com/genre/house/5/top-100')
const _discovered = new Map();
let _lastDiscoveredAt = 0;

// ── Regex ─────────────────────────────────────────────────────────────────────
// Matches both locale-prefixed (/en/, /es/ …) and plain genre top-100 URLs.
const GENRE_URL_RE = /\/(?:[a-z]{2}\/)?genre\/([^/]+)\/(\d+)\/top-100/;

/**
 * Normalizes a genre URL to the canonical form:
 *   https://www.beatport.com/genre/{slug}/{id}/top-100
 * Strips locale prefix (/es/, /en/ …) and query string.
 */
function _normalize(href) {
    return href
        .replace(/^https?:\/\/[^/]+/, 'https://www.beatport.com')  // normalize host
        .replace(/\/[a-z]{2}(\/genre\/)/, '$1')                     // strip locale
        .replace(/\?.*$/, '');                                       // strip query string
}

/**
 * Passively updates the discovery cache from links found on an already-open
 * Puppeteer page — no extra browser launch needed.
 *
 * Safe to call fire-and-forget (returns a Promise, never throws).
 *
 * @param {import('puppeteer').Page} page
 */
async function updateDiscoveryFromPage(page) {
    try {
        const hrefs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href*="/genre/"]'))
                .map(a => a.href)
        );

        let updated = 0;
        for (const href of hrefs) {
            const match = href.match(GENRE_URL_RE);
            if (!match) continue;
            const slug = match[1];
            const canonical = _normalize(href);
            if (_discovered.get(slug) !== canonical) {
                _discovered.set(slug, canonical);
                updated++;
            }
        }

        if (updated > 0) {
            _lastDiscoveredAt = Date.now();
            console.log(`🔍 Genre discovery: ${updated} URL(s) actualizada(s) — total conocidas: ${_discovered.size}`);
        }

        // Detect redirect: if the page's actual URL differs from a known slug's URL, update it
        const pageUrl = page.url();
        const redirectMatch = pageUrl.match(GENRE_URL_RE);
        if (redirectMatch) {
            const slug = redirectMatch[1];
            const canonical = _normalize(pageUrl);
            if (_discovered.get(slug) !== canonical) {
                _discovered.set(slug, canonical);
                _lastDiscoveredAt = Date.now();
                console.log(`🔀 Redirect detectado para "${slug}": URL actualizada a ${canonical}`);
            }
        }
    } catch {
        // Non-fatal: discovery is best-effort
    }
}

/**
 * Returns the best URL for a given genre slug.
 *
 * @param {string} slug  e.g. 'melodic-house-techno'
 * @returns {string|null}
 */
function resolveGenreUrl(slug) {
    return _discovered.get(slug) ?? BEATPORT_GENRES[slug] ?? null;
}

/**
 * Returns true if we have a live-discovered URL for this slug
 * (i.e. not relying on the hardcoded fallback).
 *
 * @param {string} slug
 */
function isDiscovered(slug) {
    return _discovered.has(slug);
}

/**
 * Returns discovery stats for debug/monitoring endpoints.
 */
function discoveryStats() {
    return {
        totalDiscovered: _discovered.size,
        lastDiscoveredAt: _lastDiscoveredAt
            ? new Date(_lastDiscoveredAt).toISOString()
            : null,
        cacheAgeMinutes: _lastDiscoveredAt
            ? Math.round((Date.now() - _lastDiscoveredAt) / 60000)
            : null,
        urls: Object.fromEntries(_discovered),
    };
}

module.exports = { updateDiscoveryFromPage, resolveGenreUrl, isDiscovered, discoveryStats };
