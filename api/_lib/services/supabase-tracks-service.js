const { isSupabaseEnabled } = require('../supabase');

/**
 * Inserts a scrape session and its tracks into Supabase.
 * Returns early (no-op) when Supabase is disabled or the user is not authenticated.
 *
 * @param {object} db                - Supabase client scoped to the authenticated user
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.platform     - e.g. 'beatport' | 'traxsource'
 * @param {string} opts.genre
 * @param {object[]} opts.tracks
 * @param {function} opts.trackMapper - (track, index, sessionId, userId) => DB row object
 * @returns {Promise<{supabaseSaved: boolean, sessionId: string|null}>}
 */
async function saveSessionToSupabase(db, { userId, platform, genre, tracks, trackMapper }) {
    if (!isSupabaseEnabled() || !db || !userId) return { supabaseSaved: false, sessionId: null };

    try {
        const { data: session, error: sessionError } = await db
            .from('scrape_sessions')
            .insert({ user_id: userId, platform, genre: genre.toLowerCase(), tracks_count: tracks.length })
            .select()
            .single();

        if (!sessionError && session) {
            const rows = tracks.map((t, idx) => trackMapper(t, idx, session.id, userId));
            await db.from('tracks').insert(rows);
            console.log(`☁️ Tracks guardados en Supabase (sesión ${session.id}, user ${userId})`);
            return { supabaseSaved: true, sessionId: session.id };
        }
    } catch (e) {
        console.warn('⚠️ No se pudieron guardar tracks en Supabase:', e.message);
    }

    return { supabaseSaved: false, sessionId: null };
}

module.exports = { saveSessionToSupabase };
