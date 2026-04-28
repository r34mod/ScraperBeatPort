export const QUALITY_OPTIONS = [
  { value: 'MP3_320', label: 'MP3 320',    info: 'MP3 · 320 kbps · .mp3' },
  { value: 'HIGH',    label: 'M4A (Alta)', info: 'AAC ~320 kbps · .m4a' },
  { value: 'LOSSLESS', label: 'Lossless',  info: 'FLAC 16-bit / 44.1 kHz' },
  { value: 'HI_RES',  label: 'HiRes',     info: 'FLAC 24-bit / hasta 192 kHz' },
];

export const YT_QUALITY_OPTIONS = [
  { value: 'mp3_320',  label: 'MP3 320',  info: 'MP3 · 320 kbps' },
  { value: 'mp3_256',  label: 'MP3 256',  info: 'MP3 · 256 kbps' },
  { value: 'mp3_128',  label: 'MP3 128',  info: 'MP3 · 128 kbps' },
  { value: 'opus_256', label: 'Opus 256', info: 'Opus · 256 kbps' },
  { value: 'opus_128', label: 'Opus 128', info: 'Opus · 128 kbps' },
];

// ── CSV parser (handles quoted fields with commas) ────────────────────────────
export function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Split a single CSV line respecting quoted fields
  function splitLine(line) {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-záéíóúüñ]/g, ''));

  // Support both Beatport (título/artista) and Traxsource (title/artist)
  const titleIdx  = headers.findIndex(h => h === 'titulo' || h === 'ttulo' || h === 'title');
  const artistIdx = headers.findIndex(h => h === 'artista' || h === 'artist');

  if (titleIdx === -1 || artistIdx === -1) return null; // signal bad format

  return lines.slice(1).map((line, i) => {
    const cols = splitLine(line);
    return {
      id: i,
      title:  (cols[titleIdx]  || '').replace(/"/g, '').trim(),
      artist: (cols[artistIdx] || '').replace(/"/g, '').trim(),
      status: 'pending',   // pending | searching | downloading | done | error | skipped
      progress: 0,
      msg: '',
    };
  }).filter(t => t.title && t.artist);
}

// ── Internal: stream a blob from a Response and trigger download ──────────────
async function _consumeAudioResponse(response, safeFilename, onProgress) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(contentLength > 0 ? Math.round((received / contentLength) * 100) : null, received);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const extMatch    = disposition.match(/filename=".+?(\.[^"]+)"/);
  const ext         = extMatch ? extMatch[1] : '.m4a';
  const blob        = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mp4' });
  _triggerBlobDownload(blob, `${safeFilename}${ext}`);
}

function _triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

// ── Client-side Tidal proxy resolution (browser IPs are not blocked) ──────────
async function _resolveClientSide(apis, trackId, quality, safeFilename, onProgress) {
  for (const api of apis) {
    try {
      onProgress?.(null, 0);

      const resp = await fetch(`${api}/track/?id=${trackId}&quality=${quality}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;

      const data = await resp.json();

      // V1 format: [{ OriginalTrackUrl }]
      if (Array.isArray(data)) {
        const item = data.find(d => d.OriginalTrackUrl);
        if (item?.OriginalTrackUrl) {
          onProgress?.(null, 0);
          const streamResp = await fetch(
            `/api/tidal/stream-direct?url=${encodeURIComponent(item.OriginalTrackUrl)}&filename=${encodeURIComponent(safeFilename)}`
          );
          if (!streamResp.ok) {
            const e = await streamResp.json().catch(() => ({}));
            throw new Error(e.error || `HTTP ${streamResp.status}`);
          }
          await _consumeAudioResponse(streamResp, safeFilename, onProgress);
          return;
        }
      }

      // V2 format: { data: { manifest, assetPresentation } }
      if (data?.data?.manifest) {
        if (data.data.assetPresentation === 'PREVIEW') continue;
        onProgress?.(null, 0);
        const streamResp = await fetch('/api/tidal/stream-from-manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest: data.data.manifest, filename: safeFilename }),
        });
        if (!streamResp.ok) {
          const e = await streamResp.json().catch(() => ({}));
          throw new Error(e.error || `HTTP ${streamResp.status}`);
        }
        await _consumeAudioResponse(streamResp, safeFilename, onProgress);
        return;
      }
    } catch (err) {
      // CORS or network error → try next API silently
      console.warn(`[Tidal] client-side ${api} failed:`, err.message);
    }
  }

  throw new Error('No se pudo obtener el archivo desde ninguna fuente (todas las APIs fallaron).');
}

// ── Shared download helper (fetch → blob → save) ──────────────────────────────
export async function downloadTrackBlob(tidalId, quality, safeFilename, onProgress, overrideUrl = null) {
  const url = overrideUrl ?? `/api/tidal/download?tidalId=${tidalId}&quality=${quality}&filename=${encodeURIComponent(safeFilename)}`;
  const response = await fetch(url);

  // Non-JSON audio stream → success
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && !contentType.includes('application/json')) {
    await _consumeAudioResponse(response, safeFilename, onProgress);
    return;
  }

  // Parse error JSON
  const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));

  // Server-side proxy IPs blocked → resolve from the browser directly
  if (data.needsClientResolve) {
    await _resolveClientSide(
      data.tidalApis || [],
      data.trackId   ?? tidalId,
      quality,
      safeFilename,
      onProgress,
    );
    return;
  }

  throw new Error(data.error || `HTTP ${response.status}`);
}