import { useState } from 'react';
import { downloadTrackBlob } from '../utils/downloadUtils';

export default function SingleDownloader({ provider, quality, selectedQualityInfo, embedded, qualityContent, onTrackFound, trackDownload, onNeedUpgrade }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [track, setTrack] = useState(null);
  const [dlStatus, setDlStatus] = useState('');
  const [dlMsg, setDlMsg] = useState('');

  const isTidal = provider === 'tidal';

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
      const searchUrl = isTidal
        ? `/api/tidal/search?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`
        : `/api/youtube-dl/search?title=${encodeURIComponent(t)}&artist=${encodeURIComponent(a)}`;

      const res = await fetch(searchUrl);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se encontró la canción');
      setTrack(data.track);
      onTrackFound?.(data.track);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleDownload() {
    if (isTidal && !track?.tidalId) return;
    if (!isTidal && !track?.videoId) return;

    // Check download limit
    if (trackDownload) {
      const { allowed } = await trackDownload();
      if (!allowed) {
        setDlStatus('error');
        setDlMsg('Has alcanzado el límite de descargas diarias.');
        if (onNeedUpgrade) onNeedUpgrade();
        return;
      }
    }

    setDlStatus('loading');
    setDlMsg(`Conectando con ${isTidal ? 'Tidal' : 'YouTube Music'}…`);

    const safeFilename = `${track.artist} - ${track.title}`.replace(/[^\w\s()-]/g, '').trim();

    try {
      if (isTidal) {
        await downloadTrackBlob(track.tidalId, quality, safeFilename, (pct, bytes) => {
          setDlMsg(pct !== null ? `Descargando… ${pct}%` : `Descargando… ${(bytes / 1024 / 1024).toFixed(1)} MB`);
        });
      } else {
        const dlUrl = `/api/youtube-dl/download?videoId=${encodeURIComponent(track.videoId)}&quality=${quality}&filename=${encodeURIComponent(safeFilename)}`;
        await downloadTrackBlob(null, null, safeFilename, (pct, bytes) => {
          setDlMsg(pct !== null ? `Descargando… ${pct}%` : `Descargando… ${(bytes / 1024 / 1024).toFixed(1)} MB`);
        }, dlUrl);
      }
      setDlStatus('done');
      setDlMsg('✓ Descarga completada');
    } catch (err) {
      setDlStatus('error');
      setDlMsg(`Error: ${err.message}`);
    }
  }

  const isAvailable = isTidal ? track?.tidalAvailable : track?.available;

  const formEl = (
    <form className="td-form" onSubmit={handleSearch}>
      <div className="td-form-grid">
        <div className="td-field">
          <label htmlFor="td-title">Título</label>
          <input
            id="td-title"
            type="text"
            placeholder="Ej: Bohemian Rhapsody"
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
            placeholder="Ej: Queen"
            value={artist}
            onChange={e => setArtist(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {qualityContent}

      <button className={`td-btn-search ${!isTidal ? 'td-btn-search--yt' : ''}`} type="submit" disabled={searching}>
        {searching ? '⏳  Buscando…' : (isTidal ? '🔍  Buscar canción' : '🔍  Buscar en YouTube Music')}
      </button>
    </form>
  );

  const statusEl = (
    <>
      {searching && (
        <div className="td-status td-status--loading">
          <span className="td-spinner" />
          Buscando en {isTidal ? 'Deezer y Tidal' : 'YouTube Music'}…
        </div>
      )}
      {searchError && (
        <div className="td-status td-status--error">{searchError}</div>
      )}
    </>
  );

  const resultEl = track && (
    <div className={embedded ? 'td-card td-result' : 'td-card td-result'}>
      <div className="td-track-info">
        {track.cover || track.thumbnail ? (
          <img className="td-cover" src={track.cover || track.thumbnail} alt="Cover" />
        ) : (
          <div className="td-cover td-cover--placeholder">{isTidal ? '🎵' : '🎬'}</div>
        )}
        <div className="td-track-meta">
          <h2 className="td-track-title">{track.title}</h2>
          <p className="td-track-artist">{track.artist}</p>
          {track.album && <p className="td-track-album">{track.album}</p>}
          <span className={`td-badge${isAvailable ? ' td-badge--ok' : ' td-badge--no'}`}>
            {isAvailable ? `✓ Disponible en ${isTidal ? 'Tidal' : 'YouTube'}` : `✗ No encontrado en ${isTidal ? 'Tidal' : 'YouTube'}`}
          </span>
        </div>
      </div>

      <hr className="td-divider" />

      <div className="td-download-row">
        <button
          className={`td-btn-download ${!isTidal ? 'td-btn-download--yt' : ''}`}
          onClick={handleDownload}
          disabled={!isAvailable || dlStatus === 'loading'}
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

      {dlStatus === 'loading' && <div className="td-status td-status--loading td-dl-status"><span className="td-spinner" />{dlMsg}</div>}
      {dlStatus === 'done' && <div className="td-status td-status--success td-dl-status">{dlMsg}</div>}
      {dlStatus === 'error' && <div className="td-status td-status--error td-dl-status">{dlMsg}</div>}
    </div>
  );

  if (embedded) {
    return (
      <>
        {formEl}
        {statusEl}
        {resultEl}
      </>
    );
  }

  return (
    <>
      <div className="td-card">
        {formEl}
        {statusEl}
      </div>
      {resultEl}
    </>
  );
}