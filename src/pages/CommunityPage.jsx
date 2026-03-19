import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import './CommunityPage.css';

const GENRES = ['Afro House', 'Dance Pop', 'Deep House', 'Drum & Bass', 'Electro', 'Electro House', 'House', 'Latin House', 'Melodic House & Techno', 'Minimal', 'Nu Disco', 'Organic House', 'Progressive House', 'Tech House', 'Techno', 'Trance', 'Tribal House', 'Other'];
const PLATFORMS = ['Beatport', 'Traxsource', '1001Tracklists', 'Manual'];

// ── CSV helpers ──────────────────────────────────────────────────────────────
function parseCsv(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data.map((row, idx) => ({ _id: `r_${idx}`, ...row }));
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
  const { token, userId, email, getValidToken } = useAuth();
  const navigate = useNavigate();
  const API = window.location.origin;

  // Returns headers with a fresh token, redirecting to /login if the session is gone
  const authHeaders = useCallback(async () => {
    const t = await getValidToken();
    if (!t) { navigate('/login'); return null; }
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` };
  }, [getValidToken, navigate]);

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
  const [listView, setListView] = useState('grid');

  const ART_GRADIENTS = {
    'Afro House':             'linear-gradient(135deg,#1a0800 0%,#3d1500 100%)',
    'Deep House':             'linear-gradient(135deg,#001318 0%,#002535 100%)',
    'House':                  'linear-gradient(135deg,#12001e 0%,#28004a 100%)',
    'Tech House':             'linear-gradient(135deg,#001208 0%,#003018 100%)',
    'Techno':                 'linear-gradient(135deg,#050510 0%,#0f0f24 100%)',
    'Trance':                 'linear-gradient(135deg,#00011a 0%,#000338 100%)',
    'Melodic House & Techno': 'linear-gradient(135deg,#080018 0%,#14002e 100%)',
    'Drum & Bass':            'linear-gradient(135deg,#1a0000 0%,#380500 100%)',
    'Dance Pop':              'linear-gradient(135deg,#1a0015 0%,#350028 100%)',
    'Electro':                'linear-gradient(135deg,#001015 0%,#002030 100%)',
    'Electro House':          'linear-gradient(135deg,#001018 0%,#002038 100%)',
    'Latin House':            'linear-gradient(135deg,#1a0a00 0%,#3a1800 100%)',
    'Minimal':                'linear-gradient(135deg,#080808 0%,#181818 100%)',
    'Nu Disco':               'linear-gradient(135deg,#1a0018 0%,#350035 100%)',
    'Organic House':          'linear-gradient(135deg,#050e00 0%,#0e2400 100%)',
    'Progressive House':      'linear-gradient(135deg,#000818 0%,#001030 100%)',
    'Tribal House':           'linear-gradient(135deg,#120200 0%,#280800 100%)',
  };
  const getArtGradient = (genre) => ART_GRADIENTS[genre] || 'linear-gradient(135deg,#0d0d14 0%,#1a1a28 100%)';

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
      const headers = await authHeaders();
      if (!headers) return; // redirected to /login
      const res = await fetch(`${API}/api/community/upload`, {
        method: 'POST',
        headers,
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
      const headers = await authHeaders();
      if (!headers) return; // redirected to /login
      const res = await fetch(`${API}/api/community/${id}`, {
        method: 'DELETE',
        headers,
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

  const SIDEBAR_NAV = [
    {
      id: 'feed', label: 'Feed', tab: 'all',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>,
    },
    {
      id: 'trending', label: 'Trending', tab: 'all',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      id: 'uploads', label: 'Uploads', tab: 'mine',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    },
    {
      id: 'vault', label: 'My Vault', tab: 'mine',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9v0m0 6v0m-3-3h0m6 0h0"/></svg>,
    },
  ];
  const [sidebarActive, setSidebarActive] = useState('trending');

  return (
    <div className="comm-layout">

      {/* ── Sidebar ── */}
      <aside className="comm-sidebar">
        <div className="comm-sidebar-brand">
          <span className="comm-sidebar-logo">SETTINGS</span>
          <span className="comm-sidebar-tagline">Djs Community</span>
        </div>

        <nav className="comm-sidebar-nav">
          {SIDEBAR_NAV.map(item => (
            <button
              key={item.id}
              className={`comm-sidebar-item${sidebarActive === item.id ? ' active' : ''}`}
              onClick={() => {
                setSidebarActive(item.id);
                setActiveTab(item.tab);
              }}
            >
              <span className="comm-sidebar-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="comm-sidebar-footer">
          <button
            className="comm-sidebar-new-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Playlist
          </button>
        </div>
      </aside>

    <div className="comm-page">

      {/* ── Header ── */}
      <div className="comm-header">
        <h1 className="comm-title">Sync Your Library</h1>
        <p className="comm-subtitle">Contribute to the vault by importing your metadata. Drag and drop your curated CSV exports here.</p>
      </div>

      {/* ── Upload Card ── */}
      <section className="comm-upload-card">
        <div
          className={`comm-dropzone${dragOver ? ' dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploadFile && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
          <div className="comm-dz-icon-wrap">
            {uploadFile ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M12 18v-6"/><path d="M9 15l3-3 3 3"/>
              </svg>
            )}
          </div>
          <span className="comm-dz-label">{uploadFile ? uploadFile.name : 'Drop playlist CSV here'}</span>
          <span className="comm-dz-hint">{uploadFile ? `${uploadFile.rowCount} tracks detectados` : 'Supports Rekordbox, Serato, and iTunes exported lists'}</span>
        </div>

        {uploadMsg.text && (
          <div className={`comm-upload-msg comm-upload-msg--${uploadMsg.type}`}>{uploadMsg.text}</div>
        )}

        {uploadFile && (
          <div className="comm-upload-form">
            <div className="comm-form-group">
              <label className="comm-label">Nombre de la lista *</label>
              <input className="comm-input" type="text" placeholder="Ej: House Top 100 Marzo 2026" value={listName} onChange={e => setListName(e.target.value)} maxLength={100} />
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
              <textarea className="comm-textarea" placeholder="Fecha de extracción, notas..." value={listDescription} onChange={e => setListDescription(e.target.value)} maxLength={300} rows={2} />
            </div>
          </div>
        )}

        <button
          className="comm-upload-btn"
          onClick={uploadFile ? handleUpload : () => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Subiendo...' : 'UPLOAD'}
        </button>
      </section>

      {/* ── Section Header ── */}
      <div className="comm-section-header">
        <div className="comm-section-header-left">
          <h2 className="comm-section-label">Community Playlists</h2>
          <span className="comm-live-badge">LIVE SYNC</span>
        </div>
        <div className="comm-section-header-right">
          <div className="comm-view-toggle">
            <button className={`comm-view-btn${listView === 'grid' ? ' active' : ''}`} onClick={() => setListView('grid')} title="Grid view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
            <button className={`comm-view-btn${listView === 'list' ? ' active' : ''}`} onClick={() => setListView('list')} title="List view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
          <div className="comm-tabs">
            <button className={`comm-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>
              Comunidad{files.length > 0 && <span className="comm-tab-count"> {files.length}</span>}
            </button>
            <button className={`comm-tab${activeTab === 'mine' ? ' active' : ''}`} onClick={() => setActiveTab('mine')}>
              Mis listas
            </button>
          </div>
          <div className="comm-filters">
            <input className="comm-search-input" type="text" placeholder="Buscar..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
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
      </div>

      {/* ── Cards ── */}
      {listLoading ? (
        <div className="comm-feedback">Cargando listas...</div>
      ) : listError ? (
        <div className="comm-feedback comm-feedback--error">{listError}</div>
      ) : filtered.length === 0 ? (
        <div className="comm-empty">
          <p>{activeTab === 'mine' ? 'Aún no has subido ninguna lista.' : 'No se encontraron listas.'}</p>
        </div>
      ) : (
        <div className={listView === 'list' ? 'comm-list' : 'comm-grid'}>
          {filtered.map(file => (
            <div key={file.id} className="comm-card">
              <div className="comm-card-art" style={{ background: getArtGradient(file.genre) }}>
                <div className="comm-card-art-grain" />
                <div className="comm-card-badges">
                  {file.platform && <span className="comm-badge comm-badge--platform">{file.platform}</span>}
                  {file.genre && <span className="comm-badge comm-badge--genre">{file.genre}</span>}
                </div>
              </div>
              <div className="comm-card-body">
                <h3 className="comm-card-name">{file.name}</h3>
                <p className="comm-card-uploader">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  By {file.uploader_name || 'Anónimo'}
                </p>
              </div>
              <div className="comm-card-actions">
                <button className="comm-btn--preview" onClick={() => openModal(file.id, file.name)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  PREVIEW
                </button>
                <button className="comm-btn--csv" onClick={() => downloadCsv(file.id, file.name)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  GET CSV
                </button>
                <span className="comm-card-count">{file.tracks_count || 0} TRACKS</span>
                {file.user_id === userId && (
                  <button className="comm-btn--icon" title="Eliminar" onClick={() => handleDelete(file.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Track Modal ── */}
      {modal && (
        <div className="comm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="comm-modal">
            <div className="comm-modal-header">
              <h2 className="comm-modal-title">{modal.name}</h2>
              <button className="comm-modal-close" onClick={() => setModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="comm-modal-toolbar">
              <input className="comm-search-input" type="text" placeholder="Buscar tracks..." value={modalSearch} onChange={e => setModalSearch(e.target.value)} />
              <button className="comm-modal-dl-btn" onClick={() => downloadCsv(modal.id, modal.name)}>↓ CSV</button>
            </div>
            {modalLoading ? (
              <div className="comm-feedback">Cargando tracks...</div>
            ) : modalTracks.length === 0 ? (
              <div className="comm-feedback comm-feedback--error">No se pudieron cargar los tracks.</div>
            ) : (
              <>
                <div className="comm-modal-count">{modalFiltered.length} de {modalTracks.length} tracks</div>
                <div className="comm-modal-tracks">
                  {modalFiltered.map((track, idx) => {
                    const title = getField(track, 'Título', 'Titulo', 'Title', 'title', 'Track Title');
                    const artist = getField(track, 'Artista', 'Artist', 'artist');
                    const label = getField(track, 'Label', 'label', 'Sello', 'sello');
                    const pos = getField(track, 'Posición', 'Posicion', 'Position', 'position', '#');
                    const isPlaying = playerTrack?.title === title && playerTrack?.artist === artist;
                    return (
                      <div key={track._id || idx} className={`comm-track-row${isPlaying ? ' playing' : ''}`}>
                        <div className="comm-track-pos">{pos || idx + 1}</div>
                        <div className="comm-track-info">
                          <div className="comm-track-title">{title}</div>
                          <div className="comm-track-artist">{artist}{label ? ` · ${label}` : ''}</div>
                        </div>
                        <button className={`comm-track-play${isPlaying ? ' active' : ''}`} title="Buscar en YouTube" onClick={() => playTrack(title, artist)}>
                          {isPlaying ? '▶' : '▷'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {playerTrack && (
              <div className="comm-yt-player-wrap">
                {videoLoading && <div className="comm-feedback">Buscando en YouTube...</div>}
                {!videoLoading && videoId && (
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="YouTube player"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    style={{ height: 200 }}
                  />
                )}
                {!videoLoading && !videoId && <div className="comm-feedback">No se encontró el video.</div>}
                <div className="comm-player-info">
                  <span className="comm-player-info-title">♪ {playerTrack.artist} — {playerTrack.title}</span>
                  <button className="comm-player-stop-btn" onClick={() => { setPlayerTrack(null); setVideoId(null); }}>✕ Detener</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}