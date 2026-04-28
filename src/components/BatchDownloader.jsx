import { useState, useRef, useCallback } from 'react';
import { parseCSV, downloadTrackBlob } from '../utils/downloadUtils';

export default function BatchDownloader({ provider, quality, trackDownload, onNeedUpgrade }) {
  const [batchTracks, setBatchTracks] = useState([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [csvFilename, setCsvFilename] = useState('');
  const cancelRef = useRef(false);
  const fileInputRef = useRef(null);

  const isTidal = provider === 'tidal';

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

  const updateRow = useCallback((id, patch) => {
    setBatchTracks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  async function startBatch() {
    cancelRef.current = false;
    setBatchRunning(true);
    setBatchDone(false);

    setBatchTracks(prev => prev.map(t =>
      t.status === 'done' || t.status === 'skipped' ? t : { ...t, status: 'pending', progress: 0, msg: '' }
    ));

    const list = batchTracks.filter(t => t.status !== 'done' && t.status !== 'skipped');

    for (const row of list) {
      if (cancelRef.current) { updateRow(row.id, { status: 'pending', msg: 'Cancelado' }); continue; }

      updateRow(row.id, { status: 'searching', msg: 'Buscando…' });
      
      let foundTrack;
      const searchUrl = isTidal
        ? `/api/tidal/search?title=${encodeURIComponent(row.title)}&artist=${encodeURIComponent(row.artist)}`
        : `/api/youtube-dl/search?title=${encodeURIComponent(row.title)}&artist=${encodeURIComponent(row.artist)}`;

      try {
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'No encontrado');
        
        if (isTidal) {
            foundTrack = data.track;
            if (!foundTrack?.tidalAvailable) {
                updateRow(row.id, { status: 'skipped', msg: 'No disponible en Tidal' });
                continue;
            }
        } else {
            if (!data.track?.videoId) {
                updateRow(row.id, { status: 'skipped', msg: 'No encontrado en YouTube' });
                continue;
            }
            foundTrack = { 
                ...data.track, 
                title: data.track.title || row.title,
                artist: data.track.artist || row.artist
            };
        }
      } catch (err) {
        updateRow(row.id, { status: 'error', msg: `Búsqueda: ${err.message}` });
        continue;
      }

      if (cancelRef.current) { updateRow(row.id, { status: 'pending', msg: 'Cancelado' }); continue; }

      updateRow(row.id, { status: 'downloading', progress: 0, msg: 'Descargando…' });
      const safeFilename = `${foundTrack.artist} - ${foundTrack.title}`.replace(/[^\w\s()-]/g, '').trim();
      
      const dlUrl = isTidal 
        ? null 
        : `/api/youtube-dl/download?videoId=${encodeURIComponent(foundTrack.videoId)}&quality=${quality}&filename=${encodeURIComponent(safeFilename)}`;

      try {
        await downloadTrackBlob(isTidal ? foundTrack.tidalId : null, isTidal ? quality : null, safeFilename, (pct, bytes) => {
          const msg = pct !== null ? `Descargando… ${pct}%` : `Descargando… ${(bytes / 1024 / 1024).toFixed(1)} MB`;
          updateRow(row.id, { progress: pct ?? 0, msg });
        }, dlUrl);
        updateRow(row.id, { status: 'done', progress: 100, msg: '✓ Completado' });
      } catch (err) {
        updateRow(row.id, { status: 'error', msg: `Descarga: ${err.message}` });
      }

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

  const batchTotal    = batchTracks.length;
  const batchFinished = batchTracks.filter(t => t.status === 'done').length;
  const batchSkipped  = batchTracks.filter(t => t.status === 'skipped').length;
  const batchErrors   = batchTracks.filter(t => t.status === 'error').length;

  return (
    <>
      <div className="td-card td-csv-card">
        <p className="td-csv-hint">
          Sube el CSV generado por el scraper de Beatport o Traxsource.<br />
          Se leerán las columnas <strong>Título / Title</strong> y <strong>Artista / Artist</strong>.
        </p>
        <div className="td-csv-row">
          <label className="td-btn-file">
            📂 Elegir CSV
            <input type="file" accept=".csv,text/csv" ref={fileInputRef} onChange={handleCSVFile} style={{ display: 'none' }} />
          </label>
          {csvFilename && <span className="td-csv-name">{csvFilename}</span>}
          {batchTracks.length > 0 && <span className="td-csv-count">{batchTracks.length} canciones</span>}
        </div>

        {batchError && <div className="td-status td-status--error" style={{ marginTop: 12 }}>{batchError}</div>}

        {batchTracks.length > 0 && (
          <div className="td-batch-controls">
            {!batchRunning ? (
              <button className={`td-btn-search ${!isTidal ? 'td-btn-search--yt' : ''}`} onClick={startBatch}>
                ▶ Iniciar descarga ({batchTracks.filter(t => t.status !== 'done' && t.status !== 'skipped').length} pendientes)
              </button>
            ) : (
              <button className="td-btn-stop" onClick={stopBatch}>⏹ Detener</button>
            )}
            <button className="td-btn-reset" onClick={resetBatch} disabled={batchRunning}>🗑 Limpiar</button>
          </div>
        )}

        {batchTracks.length > 0 && (
          <div className="td-batch-summary">
            <div className="td-batch-bar-wrap">
              <div className={`td-batch-bar-fill ${!isTidal ? 'td-batch-bar-fill--yt' : ''}`} style={{ width: `${batchTotal ? Math.round(((batchFinished + batchSkipped + batchErrors) / batchTotal) * 100) : 0}%` }} />
            </div>
            <span className="td-batch-bar-label">{batchFinished} ✓ · {batchSkipped} omitidas · {batchErrors} errores · {batchTotal} total</span>
            {batchDone && !batchRunning && <div className="td-status td-status--success" style={{ marginTop: 8 }}>✓ Cola completada</div>}
          </div>
        )}
      </div>

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
                {t.status === 'downloading' && (
                  <div className="td-mini-bar-wrap"><div className={`td-mini-bar-fill ${!isTidal ? 'td-mini-bar-fill--yt' : ''}`} style={{ width: `${t.progress}%` }} /></div>
                )}
                <span className="td-batch-status-label">
                  {t.status === 'pending'     && '—'}
                  {t.status === 'searching'   && <><span className="td-spinner td-spinner--sm" /> Buscando</>}
                  {t.status === 'downloading' && <><span className="td-spinner td-spinner--sm" /> {t.msg}</>}
                  {t.status === 'done'        && '✓'}
                  {t.status === 'skipped'     && <span className="td-batch-skip">{isTidal ? 'Sin Tidal' : 'Sin resultado'}</span>}
                  {t.status === 'error'       && <span className="td-batch-err" title={t.msg}>Error</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}