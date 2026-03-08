/**
 * Auto-save scraped tracks to "Mis Listas" via the tracks API.
 * Best-effort: logs warning on failure but never throws.
 *
 * @param {Object} opts
 * @param {Array} opts.tracks - Track data to save
 * @param {string} opts.platform - Platform name
 * @param {string} opts.genre - Genre name
 * @param {string} opts.token - Auth JWT token
 * @param {boolean} [opts.replaceExisting=false] - Replace existing sessions for same platform+genre
 * @returns {{ success: boolean, duplicate?: boolean, existing_sessions?: Array, data?: Object }}
 */
export async function autoSaveTracks({ tracks, platform, genre, token, replaceExisting = false }) {
  if (!token || !tracks || tracks.length === 0) return null;
  try {
    const res = await fetch('/api/tracks/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tracks, platform, genre, replaceExisting }),
    });

    const data = await res.json();

    if (res.status === 409 && data.error === 'duplicate') {
      console.warn(`⚠️ Duplicado: ya existen datos para ${platform}/${genre}`);
      return { success: false, duplicate: true, existing_sessions: data.existing_sessions };
    }

    if (res.ok) {
      console.log(`✅ Auto-guardados ${data.tracks_saved} tracks en Mis Listas`);
      return { success: true, data };
    }

    console.warn('Auto-save failed:', data.error);
    return { success: false };
  } catch (e) {
    console.warn('Auto-save to Mis Listas failed:', e.message);
    return null;
  }
}
