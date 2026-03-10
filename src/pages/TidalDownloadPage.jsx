import { useState, useRef, useCallback } from 'react';
import './TidalDownloadPage.css';

const QUALITY_OPTIONS = [
  { value: 'HIGH',     label: 'M4A (Alta)',  info: 'AAC ~320 kbps · .m4a' },
  { value: 'LOSSLESS', label: 'Lossless',    info: 'FLAC 16-bit / 44.1 kHz' },
  { value: 'HI_RES',  label: 'HiRes',       info: 'FLAC 24-bit / hasta 192 kHz' },
];

// ── CSV parser (handles quoted fields with commas) ────────────────────────────
function parseCSV(text) {
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

// ── Shared download helper (fetch → blob → save) ──────────────────────────────
async function downloadTrackBlob(tidalId, quality, safeFilename, onProgress) {
  const url = `/api/tidal/download?tidalId=${tidalId}&quality=${quality}&filename=${encodeURIComponent(safeFilename)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(contentLength > 0
      ? Math.round((received / contentLength) * 100)
      : null,
      received
    );
  }

  const disposition = response.headers.get('content-disposition') || '';
  const extMatch    = disposition.match(/filename=".+?(\.[^"]+)"/);
  const ext         = extMatch ? extMatch[1] : '.m4a';
  const blob        = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mp4' });
  const blobUrl     = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl; a.download = `${safeFilename}${ext}`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

export default function TidalDownloadPage() {
  const [tab, setTab] = useState('single'); // 'single' | 'batch'

  // ── Single track state ───────────────────────────────────────────────────────
  const [title, setTitle]       = useState('');
  const [artist, setArtist]     = useState('');
  const [quality, setQuality]   = useState('LOSSLESS');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [track, setTrack]       = useState(null);
  const [dlStatus, setDlStatus] = useState('');
  const [dlMsg, setDlMsg]       = useState('');

  // ── Batch state ──────────────────────────────────────────────────────────────
  const [batchTracks, setBatchTracks]   = useState([]);   // parsed rows
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone]       = useState(false);
  const [batchError, setBatchError]     = useState('');
  const [csvFilename, setCsvFilename]   = useState('');
  const cancelRef = useRef(false);
  const fileInputRef = useRef(null);

  // ── Single: search ──────────────────────────────────────────────────────────────
  async function handleSearch(e) {
    e?.preventDefault();
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) { setSearchError('Introduce el título y el artista.'); return; }

    setSearching(true);
    setSearchError('');
    setTrack(null);
    setDlStatus('');
    setDlMsg('');

    try {
      const res  = await fetch(`/api/tidal/search?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se encontró la canción');
      setTrack(data.track);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  // ── Single: download ─────────────────────────────────────────────────────────
  async function handleDownload() {
    if (!track?.tidalId) return;

    setDlStatus('loading');
    setDlMsg('Conectando con Tidal…');

    const safeFilename = `${track.artist} - ${track.title}`.replace(/[^\w\s()-]/g, '').trim();
    const url = `/api/tidal/download?tidalId=${track.tidalId}&quality=${quality}&filename=${encodeURIComponent(safeFilename)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      // Stream with progress if Content-Length is available
      const contentLength = Number(response.headers.get('content-length') || 0);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          const pct = Math.round((received / contentLength) * 100);
          setDlMsg(`Descargando… ${pct}%`);
        } else {
          setDlMsg(`Descargando… ${(received / 1024 / 1024).toFixed(1)} MB`);
        }
      }

      // Determine extension from Content-Disposition or default to .m4a
      const disposition = response.headers.get('content-disposition') || '';
      const extMatch = disposition.match(/filename=".+?(\.[^"]+)"/);
      const ext = extMatch ? extMatch[1] : '.m4a';

      const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mp4' });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href     = blobUrl;
      a.download = `${safeFilename}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      setDlStatus('done');
      setDlMsg('✓ Descarga completada');
    } catch (err) {
      setDlStatus('error');
      setDlMsg(`Error: ${err.message}`);
    }
  }

  // ── Batch: load CSV ────────────────────────────────────────────────────────────
  function handleCSVFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFilename(file.name);
    setBatchTracks([]);
    setBatchError('');
    setBatchDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseCSV(ev.target.result);
      if (result === null) {
        setBatchError('El CSV no tiene columnas de título y artista reconocibles (se esperan Title/Título y Artist/Artista).');
        return;
      }
      if (result.length === 0) {
        setBatchError('El CSV no contiene canciones válidas.');
        return;
      }
      setBatchTracks(result);
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ── Batch: update a single row ─────────────────────────────────────────────────
  const updateRow = useCallback((id, patch) => {
    setBatchTracks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  // ── Batch: run queue ─────────────────────────────────────────────────────────────
  async function startBatch() {
    cancelRef.current = false;
    setBatchRunning(true);
    setBatchDone(false);

    // Reset pending rows (keep done/skipped as-is if re-running)
    setBatchTracks(prev => prev.map(t =>
      t.status === 'done' || t.status === 'skipped' ? t : { ...t, status: 'pending', progress: 0, msg: '' }
    ));

    // Work on a snapshot; read current list from ref-like approach via closure
    const list = batchTracks.filter(t => t.status !== 'done' && t.status !== 'skipped');

    for (const row of list) {
      if (cancelRef.current) {
        updateRow(row.id, { status: 'pending', msg: 'Cancelado' });
        continue;
      }

      // 1. Search
      updateRow(row.id, { status: 'searching', msg: 'Buscando…' });
      let foundTrack;
      try {
        const res  = await fetch(`/api/tidal/search?title=${encodeURIComponent(row.title)}&artist=${encodeURIComponent(row.artist)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'No encontrado');
        foundTrack = data.track;
      } catch (err) {
        updateRow(row.id, { status: 'error', msg: `Busqueda: ${err.message}` });
        continue;
      }

      if (!foundTrack.tidalAvailable) {
        updateRow(row.id, { status: 'skipped', msg: 'No disponible en Tidal' });
        continue;
      }

      if (cancelRef.current) {
        updateRow(row.id, { status: 'pending', msg: 'Cancelado' });
        continue;
      }

      // 2. Download
      updateRow(row.id, { status: 'downloading', progress: 0, msg: 'Descargando…' });
      const safeFilename = `${foundTrack.artist} - ${foundTrack.title}`.replace(/[^\w\s()-]/g, '').trim();
      try {
        await downloadTrackBlob(foundTrack.tidalId, quality, safeFilename, (pct, bytes) => {
          const msg = pct !== null
            ? `Descargando… ${pct}%`
            : `Descargando… ${(bytes / 1024 / 1024).toFixed(1)} MB`;
          updateRow(row.id, { progress: pct ?? 0, msg });
        });
        updateRow(row.id, { status: 'done', progress: 100, msg: '✓ Completado' });
      } catch (err) {
        updateRow(row.id, { status: 'error', msg: `Descarga: ${err.message}` });
      }

      // Brief pause between tracks to avoid hammering the APIs
      if (!cancelRef.current) await new Promise(r => setTimeout(r, 1200));
    }

    setBatchRunning(false);
    setBatchDone(true);
  }

  function stopBatch() { cancelRef.current = true; }

  function resetBatch() {
    setBatchTracks([]);
    setCsvFilename('');
    setBatchError('');
    setBatchDone(false);
    setBatchRunning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const selectedQualityInfo = QUALITY_OPTIONS.find(q => q.value === quality)?.info ?? '';

  // Batch stats
  const batchTotal    = batchTracks.length;
  const batchFinished = batchTracks.filter(t => t.status === 'done').length;
  const batchSkipped  = batchTracks.filter(t => t.status === 'skipped').length;
  const batchErrors   = batchTracks.filter(t => t.status === 'error').length;

  return (
    <div className="td-page">
      {/* Header */}
      <div className="td-header">
        <div className="td-logo">🌊</div>
        <h1 className="td-title">Tidal Downloader</h1>
        <p className="td-subtitle">Descarga canciones de Tidal en alta calidad</p>
      </div>

      {/* Quality selector (shared) */}
      <div className="td-card td-quality-card">
        <div className="td-quality-row">
          <span className="td-quality-label">Calidad:</span>
          {QUALITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`td-quality-btn${quality === opt.value ? ' active' : ''}`}
              onClick={() => setQuality(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <span className="td-quality-info td-quality-info--inline">{selectedQualityInfo}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="td-tabs">
        <button
          className={`td-tab${tab === 'single' ? ' active' : ''}`}
          onClick={() => setTab('single')}
        >
          🎵 Canción individual
        </button>
        <button
          className={`td-tab${tab === 'batch' ? ' active' : ''}`}
          onClick={() => setTab('batch')}
        >
          📋 Importar CSV
        </button>
      </div>

      {/* ═══ SINGLE TAB ════════════════════════════════════════════════════════ */}
      {tab === 'single' && (
      <div className="td-card">
        <form className="td-form" onSubmit={handleSearch}>
          <div className="td-form-grid">
            <div className="td-field">
              <label htmlFor="td-title">Título</label>
              <input
                id="td-title"
                type="text"
                placeholder="p. ej. Blinding Lights"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="td-field">
              <label htmlFor="td-artist">Artista</label>
              <input
                id="td-artist"
                type="text"
                placeholder="p. ej. The Weeknd"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <button className="td-btn-search" type="submit" disabled={searching}>
            {searching ? '⏳  Buscando…' : '🔍  Buscar canción'}
          </button>
        </form>

        {searching && (
          <div className="td-status td-status--loading">
            <span className="td-spinner" />
            Buscando en Deezer y Tidal…
          </div>
        )}
        {searchError && (
          <div className="td-status td-status--error">{searchError}</div>
        )}
      </div>
      )}

      {/* Result card (single) */}
      {tab === 'single' && track && (
        <div className="td-card td-result">
          <div className="td-track-info">
            {track.cover
              ? <img className="td-cover" src={track.cover} alt="Cover" />
              : <div className="td-cover td-cover--placeholder">🎵</div>
            }
            <div className="td-track-meta">
              <h2 className="td-track-title">{track.title}</h2>
              <p className="td-track-artist">{track.artist}</p>
              {track.album && <p className="td-track-album">{track.album}</p>}
              <span className={`td-badge${track.tidalAvailable ? ' td-badge--ok' : ' td-badge--no'}`}>
                {track.tidalAvailable ? '✓ Disponible en Tidal' : '✗ No encontrado en Tidal'}
              </span>
            </div>
          </div>

          {track.preview && (
            <div className="td-preview">
              <p className="td-preview-label">Vista previa (30 seg)</p>
              <audio controls src={track.preview} preload="none" />
            </div>
          )}

          <hr className="td-divider" />

          <div className="td-download-row">
            <button
              className="td-btn-download"
              onClick={handleDownload}
              disabled={!track.tidalAvailable || dlStatus === 'loading'}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar
            </button>
            <span className="td-quality-info">{selectedQualityInfo}</span>
          </div>

          {dlStatus === 'loading' && (
            <div className="td-status td-status--loading td-dl-status">
              <span className="td-spinner" />
              {dlMsg}
            </div>
          )}
          {dlStatus === 'done' && (
            <div className="td-status td-status--success td-dl-status">{dlMsg}</div>
          )}
          {dlStatus === 'error' && (
            <div className="td-status td-status--error td-dl-status">{dlMsg}</div>
          )}
        </div>
      )}

      {/* ═══ BATCH TAB ═════════════════════════════════════════════════════════ */}
      {tab === 'batch' && (
        <>
          {/* CSV drop zone */}
          <div className="td-card td-csv-card">
            <p className="td-csv-hint">
              Sube el CSV generado por el scraper de Beatport o Traxsource.<br />
              Se leerán las columnas <strong>Título / Title</strong> y <strong>Artista / Artist</strong>.
            </p>
            <div className="td-csv-row">
              <label className="td-btn-file">
                📂 Elegir CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={handleCSVFile}
                  style={{ display: 'none' }}
                />
              </label>
              {csvFilename && <span className="td-csv-name">{csvFilename}</span>}
              {batchTracks.length > 0 && (
                <span className="td-csv-count">{batchTracks.length} canciones</span>
              )}
            </div>

            {batchError && (
              <div className="td-status td-status--error" style={{ marginTop: 12 }}>{batchError}</div>
            )}

            {batchTracks.length > 0 && (
              <div className="td-batch-controls">
                {!batchRunning ? (
                  <button className="td-btn-search" onClick={startBatch}>
                    ▶ Iniciar descarga ({batchTracks.filter(t => t.status !== 'done' && t.status !== 'skipped').length} pendientes)
                  </button>
                ) : (
                  <button className="td-btn-stop" onClick={stopBatch}>
                    ⏹ Detener
                  </button>
                )}
                <button className="td-btn-reset" onClick={resetBatch} disabled={batchRunning}>
                  🗑 Limpiar
                </button>
              </div>
            )}

            {/* Global progress bar */}
            {batchTracks.length > 0 && (
              <div className="td-batch-summary">
                <div className="td-batch-bar-wrap">
                  <div
                    className="td-batch-bar-fill"
                    style={{ width: `${batchTotal ? Math.round(((batchFinished + batchSkipped + batchErrors) / batchTotal) * 100) : 0}%` }}
                  />
                </div>
                <span className="td-batch-bar-label">
                  {batchFinished} ✓ · {batchSkipped} omitidas · {batchErrors} errores · {batchTotal} total
                </span>
                {batchDone && !batchRunning && (
                  <div className="td-status td-status--success" style={{ marginTop: 8 }}>
                    ✓ Cola completada
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Track list */}
          {batchTracks.length > 0 && (
            <div className="td-batch-list">
              {batchTracks.map((t, idx) => (
                <div key={t.id} className={`td-batch-row td-batch-row--${t.status}`}>
                  <span className="td-batch-num">{idx + 1}</span>
                  <div className="td-batch-info">
                    <span className="td-batch-title">{t.title}</span>
                    <span className="td-batch-artist">{t.artist}</span>
                  </div>
                  <div className="td-batch-right">
                    {(t.status === 'downloading') && (
                      <div className="td-mini-bar-wrap">
                        <div className="td-mini-bar-fill" style={{ width: `${t.progress}%` }} />
                      </div>
                    )}
                    <span className="td-batch-status-label">
                      {t.status === 'pending'     && '—'}
                      {t.status === 'searching'   && <><span className="td-spinner td-spinner--sm" /> Buscando</>}
                      {t.status === 'downloading' && <><span className="td-spinner td-spinner--sm" /> {t.msg}</>}
                      {t.status === 'done'        && '✓'}
                      {t.status === 'skipped'     && <span className="td-batch-skip">Sin Tidal</span>}
                      {t.status === 'error'       && <span className="td-batch-err" title={t.msg}>Error</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
