import { useState, useRef, useCallback } from 'react';
import './VisualizePage.css';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { result.push(current.trim().replace(/^"(.*)"$/, '$1')); current = ''; }
    else current += c;
  }
  result.push(current.trim().replace(/^"(.*)"$/, '$1'));
  return result;
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line);
    const track = { id: `track_${index}` };
    headers.forEach((h, i) => { track[h] = values[i] || ''; });
    return track;
  }).filter(t => t['Título'] || t.Title || t['Track Title'] || t.title);
}

function getField(track, ...keys) {
  for (const k of keys) if (track[k]) return track[k];
  return '';
}

export default function VisualizePage() {
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [playerTrack, setPlayerTrack] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const fileRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) { showToast('Sube un archivo CSV válido'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Archivo demasiado grande (máx 10MB)'); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        setTracks(parsed); setSelected(new Set());
        showToast(`"${file.name}" cargado — ${parsed.length} tracks`);
      } catch { showToast('Error procesando CSV'); }
      setLoading(false);
    };
    reader.onerror = () => { showToast('Error leyendo archivo'); setLoading(false); };
    reader.readAsText(file, 'utf-8');
  }, []);

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const selectAll = () => setSelected(new Set(tracks.map(t => t.id)));
  const clearSelection = () => setSelected(new Set());

  const downloadSelected = () => {
    const sel = tracks.filter(t => selected.has(t.id));
    if (!sel.length) return;
    const headers = Object.keys(sel[0]).filter(k => k !== 'id');
    const csv = [headers.join(','), ...sel.map(t => headers.map(h => {
      const v = t[h] || ''; return v.includes(',') ? `"${v}"` : v;
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `selected_tracks_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`${sel.length} tracks descargados`);
  };

  const playTrack = async (title, artist) => {
    setPlayerTrack({ title, artist }); setVideoId(null); setVideoLoading(true);
    try {
      const q = `${artist} ${title}`.trim().replace(/[^\w\s]/gi, ' ');
      const res = await fetch('/api/youtube/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, maxResults: 3 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.directSearch || !data.success) {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank');
          setPlayerTrack(null);
        } else if (data.results?.[0]?.videoId) {
          setVideoId(data.results[0].videoId);
        } else {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank');
          setPlayerTrack(null);
        }
      } else {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`)}`, '_blank');
        setPlayerTrack(null);
      }
    } catch {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`)}`, '_blank');
      setPlayerTrack(null);
    } finally { setVideoLoading(false); }
  };

  return (
    <div className="container vz-page">
      <h1 className="vz-title">Visualice</h1>
      <p className="vz-subtitle">Visualiza, selecciona y organiza tus tracks</p>

      {/* Upload */}
      <div className="vz-upload"
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
        onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); }}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => handleFile(e.target.files[0])} />
        <div className="vz-upload-icon">📁</div>
        <p>Arrastra un archivo CSV aquí o haz clic para seleccionar</p>
      </div>

      {loading && <div className="vz-loading"><span className="spinner-inline" /> Cargando...</div>}

      {tracks.length > 0 && (
        <>
          {/* Controls */}
          <div className="vz-controls">
            <span className="vz-count">{selected.size} de {tracks.length} seleccionados</span>
            <button className="vz-btn" onClick={selectAll}>Seleccionar todo</button>
            <button className="vz-btn" onClick={clearSelection}>Limpiar</button>
            <button className="vz-btn primary" disabled={selected.size === 0} onClick={downloadSelected}>💾 Descargar seleccionados</button>
          </div>

          {/* Table */}
          <div className="vz-table-wrap">
            <table className="vz-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === tracks.length} onChange={() => selected.size === tracks.length ? clearSelection() : selectAll()} /></th>
                  <th>#</th><th>Track</th><th>Género</th><th>BPM</th><th>Label</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((t, i) => {
                  const title = getField(t, 'Título', 'Title', 'Track Title', 'title') || 'Sin título';
                  const artist = getField(t, 'Artista', 'Artist', 'Artist Name', 'artist') || 'Desconocido';
                  const genre = getField(t, 'Género', 'Genre', 'genre') || 'N/A';
                  const bpm = getField(t, 'BPM', 'bpm') || 'N/A';
                  const label = getField(t, 'Label', 'label', 'Record Label') || 'N/A';
                  const q = encodeURIComponent(`${title} ${artist}`);
                  return (
                    <tr key={t.id} className={selected.has(t.id) ? 'selected' : ''}>
                      <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                      <td className="vz-pos">{i + 1}</td>
                      <td><div className="vz-track-title">{title}</div><div className="vz-track-artist">{artist}</div></td>
                      <td><span className="vz-genre-badge">{genre}</span></td>
                      <td>{bpm}</td>
                      <td>{label}</td>
                      <td className="vz-actions-cell">
                        <button className="vz-play-btn" onClick={() => playTrack(title, artist)}>▶️</button>
                        <a className="vz-play-btn" href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noopener noreferrer">📺</a>
                        <a className="vz-play-btn" href={`https://soundcloud.com/search?q=${q}`} target="_blank" rel="noopener noreferrer">🎵</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tracks.length === 0 && !loading && (
        <div className="vz-empty">
          <div style={{ fontSize: '3rem' }}>📁</div>
          <h3>No hay archivo cargado</h3>
          <p>Sube un archivo CSV para visualizar y seleccionar tracks</p>
        </div>
      )}

      {/* Music Player Overlay */}
      {playerTrack && (
        <div className="vz-player-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPlayerTrack(null); }}>
          <div className="vz-player-card">
            <button className="vz-player-close" onClick={() => setPlayerTrack(null)}>✕</button>
            <h3>{playerTrack.title}</h3>
            <p style={{ color: '#aaa' }}>{playerTrack.artist}</p>
            {videoLoading && <div style={{ marginTop: 20 }}><span className="spinner-inline" /> Buscando video...</div>}
            {videoId && (
              <iframe
                style={{ width: '100%', height: 360, border: 'none', borderRadius: 12, marginTop: 16 }}
                src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="YouTube player"
              />
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="vz-toast">{toast}</div>}
    </div>
  );
}
