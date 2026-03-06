/**
 * Auto-save scraped tracks to "Mis Listas" via the tracks API.
 * Best-effort: logs warning on failure but never throws.
 */
export async function autoSaveTracks({ tracks, platform, genre, token }) {
  if (!token || !tracks || tracks.length === 0) return;
  try {
    const res = await fetch('/api/tracks/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tracks, platform, genre }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Auto-guardados ${data.tracks_saved} tracks en Mis Listas`);
      return data;
    }
  } catch (e) {
    console.warn('Auto-save to Mis Listas failed:', e.message);
  }
  return null;
}
