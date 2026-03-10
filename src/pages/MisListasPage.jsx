import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './MisListasPage.css';

function formatGenre(g) {
  return g.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MisListasPage() {
  const { token, clear } = useAuth();
  const navigate = useNavigate();
  const [platformsData, setPlatformsData] = useState({});
  const [platform, setPlatform] = useState(null);
  const [genre, setGenre] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState({ msg: '', type: '' });

  const API = window.location.origin;
  const authHeaders = useCallback(() => ({ 'Authorization': `Bearer ${token}` }), [token]);

  const handleAuth = useCallback((res) => {
    if (res.status === 401) { clear(); navigate('/login'); return true; }
    return false;
  }, [clear, navigate]);

  // Load platforms
  useEffect(() => {
    (async () => {
      setStatus({ msg: 'Cargando listas...', type: 'loading' });
      try {
        const res = await fetch(`${API}/api/tracks/platforms`, { headers: authHeaders() });
        if (handleAuth(res)) return;
        if (!res.ok) throw new Error(await res.text());
        const { platforms } = await res.json();
        setPlatformsData(platforms || {});
        setStatus({ msg: '', type: '' });
        const names = Object.keys(platforms || {});
        if (names.length) setPlatform(names[0]);
      } catch {
        setStatus({ msg: 'No se pudieron cargar las listas.', type: 'error' });
      }
    })();
  }, [API, authHeaders, handleAuth]);

  // When platform changes, pick first genre
  useEffect(() => {
    if (!platform) return;
    const genres = Object.keys(platformsData[platform] || {});
    setGenre(genres.length ? genres[0] : null);
  }, [platform, platformsData]);

  // When genre changes, pick first session
  useEffect(() => {
    if (!platform || !genre) return;
    const sessions = (platformsData[platform] || {})[genre] || [];
    setSessionId(sessions.length ? sessions[0].session_id : null);
  }, [platform, genre, platformsData]);

  // Load tracks
  useEffect(() => {
    if (!platform || !genre) return;
    (async () => {
      setStatus({ msg: 'Cargando tracks...', type: 'loading' });
      const params = new URLSearchParams({ platform, genre, limit: '200' });
      if (sessionId) params.set('session_id', sessionId);
      try {
        const res = await fetch(`${API}/api/tracks?${params}`, { headers: authHeaders() });
        if (handleAuth(res)) return;
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setTracks(data.tracks || []);
        setTotal(data.total || data.tracks?.length || 0);
        setStatus({ msg: '', type: '' });
      } catch {
        setStatus({ msg: 'Error cargando tracks.', type: 'error' });
      }
    })();
  }, [platform, genre, sessionId, API, authHeaders, handleAuth]);

  const exportCSV = async () => {
    const params = new URLSearchParams({ platform, genre });
    if (sessionId) params.set('session_id', sessionId);
    try {
      const res = await fetch(`${API}/api/tracks/export/csv?${params}`, { headers: authHeaders() });
      if (handleAuth(res)) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `tracks_${platform}_${genre}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      setStatus({ msg: 'Error al exportar.', type: 'error' });
    }
  };

  const deleteSession = async () => {
    if (!sessionId || !confirm('¿Eliminar esta sesión y todos sus tracks?')) return;
    setStatus({ msg: 'Eliminando...', type: 'loading' });
    try {
      const res = await fetch(`${API}/api/tracks/session/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
      if (handleAuth(res)) return;
      if (!res.ok) throw new Error(await res.text());
      // Reload platforms
      const r2 = await fetch(`${API}/api/tracks/platforms`, { headers: authHeaders() });
      const { platforms } = await r2.json();
      setPlatformsData(platforms || {});
      setStatus({ msg: '', type: '' });
    } catch {
      setStatus({ msg: 'Error eliminando.', type: 'error' });
    }
  };

  const platformNames = Object.keys(platformsData);
  const genres = platform ? Object.keys(platformsData[platform] || {}) : [];
  const sessions = platform && genre ? (platformsData[platform] || {})[genre] || [] : [];

  return (
    <div className="container ml-page">
      <h1 className="ml-title">Mis Listas</h1>
      <p className="ml-subtitle">Tus tracks guardados en Supabase</p>

      {status.msg && (
        <div className={`ml-status ${status.type}`}>
          {status.type === 'loading' && <span className="spinner-inline" />}
          {status.msg}
        </div>
      )}

      {/* Platform tabs */}
      {platformNames.length > 0 && (
        <div className="ml-tabs">
          {platformNames.map(p => (
            <button key={p} className={`ml-tab${platform === p ? ' active' : ''}`}
              onClick={() => setPlatform(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="ml-genres">
          {genres.map(g => {
            const count = (platformsData[platform][g] || []).reduce((s, ses) => s + ses.tracks_count, 0);
            return (
              <button key={g} className={`ml-genre${genre === g ? ' active' : ''}`}
                onClick={() => setGenre(g)}>
                {formatGenre(g)} <span className="ml-count">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Session selector */}
      {sessions.length > 1 && (
        <div className="ml-session-selector">
          <select value={sessionId || ''} onChange={e => setSessionId(e.target.value)}>
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>
                {formatDate(s.scraped_at)} — {s.tracks_count} tracks
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action bar */}
      {tracks.length > 0 && (
        <div className="ml-action-bar">
          <span className="ml-track-count">{total} tracks</span>
          <button className="ml-btn" onClick={exportCSV}>📥 Exportar CSV</button>
          <button className="ml-btn danger" onClick={deleteSession} disabled={!sessionId}>🗑 Eliminar sesión</button>
        </div>
      )}

      {/* Track list */}
      <div className="ml-track-list">
        {tracks.map(t => (
          <div key={`${t.position}-${t.title}`} className="ml-track-item">
            <div className="ml-track-pos">{t.position}</div>
            <div className="ml-track-info">
              <div className="ml-track-title">{t.title}</div>
              <div className="ml-track-artist">{t.artist}{t.label ? ` · ${t.label}` : ''}</div>
            </div>
            <div className="ml-track-meta">
              {t.bpm ? `${t.bpm} BPM` : ''}
              {t.key ? <><br />{t.key}</> : ''}
            </div>
          </div>
        ))}
      </div>

      {tracks.length === 0 && !status.msg && (
        <div className="ml-empty">
          <div style={{ fontSize: '3rem' }}>📝</div>
          <h3>No hay tracks</h3>
          <p>Scrapea géneros desde Beatport o Traxsource para ver tus listas aquí</p>
        </div>
      )}
    </div>
  );
}
