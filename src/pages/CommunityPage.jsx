import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './CommunityPage.css';

const GENRES = ['Afro House', 'Dance Pop', 'Deep House', 'Drum & Bass', 'Electro', 'Electro House', 'House', 'Latin House', 'Melodic House & Techno', 'Minimal', 'Nu Disco', 'Organic House', 'Progressive House', 'Tech House', 'Techno', 'Trance', 'Tribal House', 'Other'];
const PLATFORMS = ['Beatport', 'Traxsource', '1001Tracklists', 'Manual'];

// ── CSV helpers ──────────────────────────────────────────────────────────────
function parseCsvLine(line) {
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

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map((line, idx) => {
    const vals = parseCsvLine(line);
    const row = { _id: `r_${idx}` };
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  // Include any row that has at least one non-empty field (handles all header name variants)
  }).filter(r => Object.entries(r).some(([k, v]) => k !== '_id' && v.trim()));
}

function getField(row, ...keys) {
  for (const k of keys) if (row[k]) return row[k];
  // Fallback: case-insensitive search among all keys
  const lower = keys.map(k => k.toLowerCase());
  for (const [k, v] of Object.entries(row)) {
    if (k !== '_id' && lower.includes(k.toLowerCase()) && v) return v;
  }
  return '';
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CommunityPage() {
  const { token, userId, email } = useAuth();
  const navigate = useNavigate();
  const API = window.location.origin;
  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  // ── Upload state ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [listName, setListName] = useState('');
  const [listGenre, setListGenre] = useState('');
  const [listPlatform, setListPlatform] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  // ── Listing state ────────────────────────────────────────────────────────
  const [files, setFiles] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');

  // ── Modal state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null);
  const [modalTracks, setModalTracks] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [playerTrack, setPlayerTrack] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // ── Fetch listing ────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await fetch(`${API}/api/community/lists`);
      if (!res.ok) throw new Error(await res.text());
      const { files: data } = await res.json();
      setFiles(data || []);
    } catch {
      setListError('Error cargando las listas de la comunidad.');
    } finally {
      setListLoading(false);
    }
  }, [API]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── File handling ────────────────────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setUploadMsg({ text: 'El archivo debe ser un CSV.', type: 'error' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadMsg({ text: 'El archivo es demasiado grande (máx. 5 MB).', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parseCsv(text);
      const baseName = file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' ');
      setUploadFile({ name: file.name, csvContent: text, rowCount: rows.length });
      setListName(prev => prev || baseName);
      setUploadMsg({ text: `"${file.name}" listo — ${rows.length} tracks detectados`, type: 'success' });
    };
    reader.onerror = () => setUploadMsg({ text: 'Error leyendo el archivo.', type: 'error' });
    reader.readAsText(file, 'utf-8');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Upload submit ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) return setUploadMsg({ text: 'Primero selecciona un CSV.', type: 'error' });
    if (!listName.trim()) return setUploadMsg({ text: 'El nombre de la lista es requerido.', type: 'error' });

    setUploading(true);
    setUploadMsg({ text: 'Subiendo...', type: 'loading' });

    let displayName = 'Anónimo';
    try {
      const prefs = JSON.parse(localStorage.getItem('msh_user_prefs') || '{}');
      displayName = prefs.displayName || email?.split('@')[0] || 'Anónimo';
    } catch {}

    try {
      const res = await fetch(`${API}/api/community/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          csvContent: uploadFile.csvContent,
          name: listName.trim(),
          genre: listGenre,
          platform: listPlatform,
          description: listDescription.trim(),
          tracks_count: uploadFile.rowCount,
          uploader_name: displayName,
        }),
      });
      if (res.status === 401) { navigate('/login'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');

      setUploadMsg({ text: '¡Lista subida correctamente!', type: 'success' });
      setUploadFile(null);
      setListName('');
      setListGenre('');
      setListPlatform('');
      setListDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles();
    } catch (err) {
      setUploadMsg({ text: err.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta lista de la comunidad?')) return;
    try {
      const res = await fetch(`${API}/api/community/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.status === 401) { navigate('/login'); return; }
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Error eliminando.');
        return;
      }
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch {
      alert('Error de red al eliminar.');
    }
  };

  // ── Download CSV ──────────────────────────────────────────────────────────
  const downloadCsv = async (id, name) => {
    try {
      const res = await fetch(`${API}/api/community/download/${id}`);
      if (!res.ok) { alert('Error descargando.'); return; }
      const { csvContent } = await res.json();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9_\- ]/gi, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error descargando el archivo.');
    }
  };

  // ── Open modal ────────────────────────────────────────────────────────────
  const openModal = async (id, name) => {
    setModal({ id, name });
    setModalTracks([]);
    setModalSearch('');
    setPlayerTrack(null);
    setVideoId(null);
    setModalLoading(true);
    try {
      const res = await fetch(`${API}/api/community/download/${id}`);
      if (!res.ok) throw new Error();
      const { csvContent } = await res.json();
      setModalTracks(parseCsv(csvContent));
    } catch {
      setModalTracks([]);
    } finally {
      setModalLoading(false);
    }
  };

  // ── YouTube play ──────────────────────────────────────────────────────────
  const playTrack = async (title, artist) => {
    setPlayerTrack({ title, artist });
    setVideoId(null);
    setVideoLoading(true);
    try {
      const q = `${artist} ${title}`.replace(/[^\w\s]/gi, ' ').trim();
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setVideoId(data.videoId || null);
    } catch {
      setVideoId(null);
    } finally {
      setVideoLoading(false);
    }
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = files;
    if (activeTab === 'mine') list = list.filter(f => f.user_id === userId);
    else list = list.filter(f => f.user_id !== userId); // Comunidad: solo listas de otros
    if (filterGenre) list = list.filter(f => f.genre === filterGenre);
    if (filterPlatform) list = list.filter(f => f.platform === filterPlatform);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.uploader_name || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [files, activeTab, filterGenre, filterPlatform, filterSearch, userId]);

  const modalFiltered = useMemo(() => {
    if (!modalSearch.trim()) return modalTracks;
    const q = modalSearch.trim().toLowerCase();
    return modalTracks.filter(t => {
      const title = getField(t, 'Título', 'Titulo', 'Title', 'title', 'Track Title');
      const artist = getField(t, 'Artista', 'Artist', 'artist');
      return (title + artist).toLowerCase().includes(q);
    });
  }, [modalTracks, modalSearch]);

  return (
    <div className="comm-page">
      <div className="comm-header">
        <h1 className="comm-title">Comunidad</h1>
        <p className="comm-subtitle">Comparte tu playlist con la comunidad y descubre los de otros</p>
      </div>

      {/* ── Upload Card ─────────────────────────────────────────────── */}
      <section className="comm-upload-card">
        <h2 className="comm-section-title">Subir tu lista</h2>

        <div
          className={`comm-dropzone ${dragOver ? 'dragover' : ''} ${uploadFile ? 'has-file' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {uploadFile ? (
            <div className="comm-dropzone-info">
              <span className="comm-dz-icon">✓</span>
              <span className="comm-dz-name">{uploadFile.name}</span>
              <span className="comm-dz-count">{uploadFile.rowCount} tracks detectados</span>
            </div>
          ) : (
            <div className="comm-dropzone-placeholder">
              <span className="comm-dz-icon">📁</span>
              <span>Arrastra tu CSV aquí o haz clic para seleccionar</span>
              <span className="comm-dz-hint">Solo archivos .csv · Máx 5 MB</span>
            </div>
          )}
        </div>

        {uploadMsg.text && (
          <div className={`comm-upload-msg comm-upload-msg--${uploadMsg.type}`}>{uploadMsg.text}</div>
        )}

        {uploadFile && (
          <div className="comm-upload-form">
            <div className="comm-form-group">
              <label className="comm-label">Nombre de la lista *</label>
              <input
                className="comm-input"
                type="text"
                placeholder="Ej: House Top 100 Marzo 2026"
                value={listName}
                onChange={e => setListName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="comm-form-row--2">
              <div className="comm-form-group">
                <label className="comm-label">Género</label>
                <select className="comm-select" value={listGenre} onChange={e => setListGenre(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="comm-form-group">
                <label className="comm-label">Plataforma</label>
                <select className="comm-select" value={listPlatform} onChange={e => setListPlatform(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="comm-form-group">
              <label className="comm-label">Descripción (opcional)</label>
              <textarea
                className="comm-textarea"
                placeholder="Fecha de extracción, notas..."
                value={listDescription}
                onChange={e => setListDescription(e.target.value)}
                maxLength={300}
                rows={2}
              />
            </div>
            <button
              className={`comm-upload-btn ${uploading ? 'loading' : ''}`}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Subiendo...' : '↑ Publicar lista'}
            </button>
          </div>
        )}
      </section>

      {/* ── Tabs + Filters ─────────────────────────────────────────── */}
      <div className="comm-controls">
        <div className="comm-tabs">
          <button
            className={`comm-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Comunidad{files.length > 0 && <span className="comm-tab-count">{files.length}</span>}
          </button>
          <button
            className={`comm-tab ${activeTab === 'mine' ? 'active' : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            Mis listas{files.filter(f => f.user_id === userId).length > 0 && (
              <span className="comm-tab-count">{files.filter(f => f.user_id === userId).length}</span>
            )}
          </button>
        </div>

        <div className="comm-filters">
          <input
            className="comm-filter-input"
            type="text"
            placeholder="Buscar listas..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
          />
          <select className="comm-filter-select" value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
            <option value="">Todos los géneros</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="comm-filter-select" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
            <option value="">Todas las plataformas</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* ── Cards Grid ─────────────────────────────────────────────── */}
      {listLoading ? (
        <div className="comm-feedback">Cargando listas...</div>
      ) : listError ? (
        <div className="comm-feedback comm-feedback--error">{listError}</div>
      ) : filtered.length === 0 ? (
        <div className="comm-empty">
          <div className="comm-empty-icon">🎵</div>
          <h3>{activeTab === 'mine' ? 'Aún no has subido ninguna lista' : 'No se encontraron listas'}</h3>
          <p>{activeTab === 'mine' ? 'Usa el formulario de arriba para compartir tu top 100' : 'Sé el primero en compartir tu selección'}</p>
        </div>
      ) : (
        <div className="comm-grid">
          {filtered.map(file => (
            <div key={file.id} className="comm-card">
              <div className="comm-card-head">
                <h3 className="comm-card-name">{file.name}</h3>
                <div className="comm-card-badges">
                  {file.platform && <span className="comm-badge comm-badge--platform">{file.platform}</span>}
                  {file.genre && <span className="comm-badge comm-badge--genre">{file.genre}</span>}
                </div>
              </div>
              {file.description && <p className="comm-card-desc">{file.description}</p>}
              <div className="comm-card-meta">
                <span className="comm-meta-uploader">👤 {file.uploader_name || 'Anónimo'}</span>
                <span className="comm-meta-date">{formatDate(file.created_at)}</span>
              </div>
              <div className="comm-card-stats">🎵 {file.tracks_count} tracks</div>
              <div className="comm-card-actions">
                <button className="comm-btn comm-btn--primary" onClick={() => openModal(file.id, file.name)}>
                  Ver tracks
                </button>
                <button className="comm-btn" onClick={() => downloadCsv(file.id, file.name)}>↓ CSV</button>
                {activeTab === 'mine' && file.user_id === userId && (
                  <button className="comm-btn comm-btn--danger" onClick={() => handleDelete(file.id)}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Track Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="comm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="comm-modal">
            <div className="comm-modal-header">
              <h2 className="comm-modal-title">{modal.name}</h2>
              <button className="comm-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>

            <div className="comm-modal-toolbar">
              <input
                className="comm-filter-input"
                type="text"
                placeholder="Buscar tracks..."
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
              />
              <button className="comm-btn" onClick={() => downloadCsv(modal.id, modal.name)}>
                ↓ Descargar CSV
              </button>
            </div>

            {modalLoading ? (
              <div className="comm-feedback">Cargando tracks...</div>
            ) : modalTracks.length === 0 ? (
              <div className="comm-feedback comm-feedback--error">No se pudieron cargar los tracks.</div>
            ) : (
              <>
                <div className="comm-modal-count">{modalFiltered.length} de {modalTracks.length} tracks</div>
                <div className="comm-track-list">
                  {modalFiltered.map((track, idx) => {
                    const title = getField(track, 'Título', 'Titulo', 'Title', 'title', 'Track Title');
                    const artist = getField(track, 'Artista', 'Artist', 'artist');
                    const label = getField(track, 'Label', 'label', 'Sello', 'sello');
                    const pos = getField(track, 'Posición', 'Posicion', 'Position', 'position', '#');
                    const isPlaying = playerTrack?.title === title && playerTrack?.artist === artist;
                    return (
                      <div key={track._id || idx} className={`comm-track-row ${isPlaying ? 'playing' : ''}`}>
                        <div className="comm-track-pos">{pos || idx + 1}</div>
                        <div className="comm-track-info">
                          <div className="comm-track-title">{title}</div>
                          <div className="comm-track-artist">{artist}{label ? ` · ${label}` : ''}</div>
                        </div>
                        <button
                          className={`comm-track-play ${isPlaying ? 'active' : ''}`}
                          title="Buscar en YouTube"
                          onClick={() => playTrack(title, artist)}
                        >
                          {isPlaying ? '▶' : '▷'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {playerTrack && (
              <div className="comm-player">
                <div className="comm-player-info">♪ {playerTrack.artist} — {playerTrack.title}</div>
                {videoLoading && <div className="comm-player-loading">Buscando en YouTube...</div>}
                {!videoLoading && videoId && (
                  <iframe
                    className="comm-player-frame"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="YouTube player"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                )}
                {!videoLoading && !videoId && (
                  <div className="comm-player-loading">No se encontró el video.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}