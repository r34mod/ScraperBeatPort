import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useLikes } from '../hooks/useLikes';
import { STATIONS } from '../data/stations';
import './ProfilePage.css';

const PREFS_KEY = 'msh_user_prefs';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function storePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

function fmtMonth(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* ── Icon helpers (keep JSX clean) ──────────────────────────── */
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconSub = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconHeart = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24"
    fill={filled ? '#ff1744' : 'none'} stroke="#ff1744" strokeWidth="2" strokeLinecap="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IconClose = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconNote = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);

export default function ProfilePage() {
  const { isLoggedIn, email, session } = useAuth();
  const navigate = useNavigate();
  const { subscribed, downloadsLeft, loading: subLoading } = useSubscription();
  const { likes, loading: likesLoading, removeLike } = useLikes();

  const [activeSection, setActiveSection] = useState('account');
  const tracksRef = useRef(null);

  /* ── Prefs ────────────────────────────────────────────────── */
  const [prefs, setPrefs] = useState(loadPrefs);
  const [displayName, setDisplayName] = useState(() => loadPrefs().displayName || '');
  const [favStation, setFavStation]   = useState(() => loadPrefs().favStation   || '');
  const [editing, setEditing]         = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');
  const nameInputRef = useRef(null);

  /* ── Guard ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  const commitName = () => {
    const trimmed = displayName.trim();
    const p = { ...loadPrefs(), displayName: trimmed };
    storePrefs(p);
    setPrefs(p);
    setEditing(false);
    flash('✓ Guardado');
  };

  const commitStation = (val) => {
    setFavStation(val);
    const p = { ...loadPrefs(), favStation: val };
    storePrefs(p);
    setPrefs(p);
    flash('✓ Guardado');
  };

  const flash = (msg) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  /* ── CSV export ───────────────────────────────────────────── */
  const exportCSV = () => {
    if (!likes.length) return;
    const userName = prefs.displayName || email?.split('@')[0] || 'user';
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${userName.replace(/\s+/g, '_')}_liked_songs_${ts}.csv`;
    const header = 'Position,Title,Artist,Playlist,Liked At';
    const rows = likes.map((l, i) => [
      i + 1,
      `"${(l.title    || '').replace(/"/g, '""')}"`,
      `"${(l.artist   || '').replace(/"/g, '""')}"`,
      `"${(l.sc_label || '').replace(/"/g, '""')}"`,
      l.liked_at ? new Date(l.liked_at).toLocaleDateString('es-ES') : '',
    ].join(','));
    const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToTracks = () =>
    tracksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!isLoggedIn) return null;

  const userName  = prefs.displayName || email?.split('@')[0] || 'Usuario';
  const joinMonth = fmtMonth(session?.user?.created_at);
  const tier      = subscribed ? 'Premium Tier' : 'Free Tier';

  return (
    <div className="pf-root">

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className="pf-sidebar">
        <div className="pf-sidebar-top">
          <p className="pf-nav-label">NAVIGATION</p>

          <button
            className={`pf-nav-item${activeSection === 'account' ? ' active' : ''}`}
            onClick={() => { setActiveSection('account'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <IconUser />
            Account
          </button>

          <button
            className="pf-nav-item"
            onClick={() => navigate('/subscription')}
          >
            <IconSub />
            Subscription
          </button>
        </div>

        <div className="pf-sidebar-footer">
          <p className="pf-plan-label">Current Plan</p>
          <p className="pf-plan-name">{subLoading ? '…' : subscribed ? 'Premium Member' : 'Free Member'}</p>
          <button className="pf-upgrade-btn" disabled title="Próximamente disponible">
            Upgrade to Pro
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN ══════════════════ */}
      <main className="pf-main">

        {/* ── Hero (no banner) ────────────────────────── */}
        <div className="pf-hero">
          <div className="pf-hero-avatar">{userName[0].toUpperCase()}</div>

          <div className="pf-hero-info">
            {editing ? (
              <div className="pf-name-edit-row">
                <input
                  ref={nameInputRef}
                  className="pf-name-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') { setDisplayName(prefs.displayName || ''); setEditing(false); }
                  }}
                  maxLength={40}
                  placeholder="Tu nombre…"
                />
                <button className="pf-name-save"  onClick={commitName}>Guardar</button>
                <button className="pf-name-cancel" onClick={() => { setDisplayName(prefs.displayName || ''); setEditing(false); }}>✕</button>
              </div>
            ) : (
              <div className="pf-name-row">
                <h1 className="pf-hero-name">{userName}</h1>
                <button className="pf-edit-btn" onClick={() => setEditing(true)} aria-label="Editar nombre">
                  <IconEdit />
                </button>
                {savedMsg && <span className="pf-saved-flash">{savedMsg}</span>}
              </div>
            )}
            <p className="pf-hero-meta">
              {joinMonth && <><span>Joined {joinMonth}</span><span className="pf-sep">•</span></>}
              <span className={`pf-tier-pill${subscribed ? ' pro' : ''}`}>{tier}</span>
            </p>
          </div>
        </div>

        {/* ── Cards grid (2-col desktop / 1-col mobile) ── */}
        <div className="pf-cards-grid">

          {/* Card — Preferences */}
          <div className="pf-card">
            <div className="pf-card-hd">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Preferences
            </div>

            <label className="pf-field-label">CHOOSE FAVORITE RADIO</label>
            <select
              className="pf-select"
              value={favStation}
              onChange={e => commitStation(e.target.value)}
            >
              <option value="">— None —</option>
              {STATIONS.map(s => (
                <option key={s.url} value={s.url}>{s.name}</option>
              ))}
            </select>

            <div className="pf-tiles-row">
              <div className="pf-tile">
                <span className="pf-tile-label">AUDIO QUALITY</span>
                <span className="pf-tile-value pf-tile-accent">
                  {subscribed ? 'Lossless (24-bit)' : 'Standard'}
                </span>
              </div>
              <div className="pf-tile">
                <span className="pf-tile-label">DATA USAGE</span>
                <span className="pf-tile-value">
                  {subscribed ? 'Unlimited' : 'Limited'}
                </span>
              </div>
            </div>
          </div>

          {/* Card — Stats */}
          <div className="pf-card">
            <div className="pf-card-hd">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
              Stats
            </div>

            <div className="pf-stats">
              <div className="pf-stat">
                <span className="pf-stat-label">Tracks Liked</span>
                <span className="pf-stat-val accent">
                  {likesLoading ? '…' : likes.length}
                </span>
              </div>
              <div className="pf-stat">
                <span className="pf-stat-label">Downloads Left</span>
                <span className="pf-stat-val">
                  {subLoading ? '…' : subscribed ? '∞' : downloadsLeft}
                </span>
              </div>
              <div className="pf-stat">
                <span className="pf-stat-label">Plan</span>
                <span className={`pf-stat-val${subscribed ? ' accent' : ''}`}>
                  {subLoading ? '…' : subscribed ? 'Premium' : 'Free'}
                </span>
              </div>
            </div>

            <button className="pf-view-liked-btn" onClick={scrollToTracks}>
              View Liked Songs
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

        </div>{/* /pf-cards-grid */}

        {/* ── Favorite Tracks ─────────────────────────── */}
        <section ref={tracksRef} className="pf-tracks">
          <div className="pf-tracks-hd">
            <h2 className="pf-tracks-title">
              <IconHeart filled />
              Favorite Tracks
            </h2>
            <button
              className="pf-export-btn"
              onClick={exportCSV}
              disabled={!likes.length}
              title={!likes.length ? 'No hay canciones guardadas' : 'Descargar como CSV'}
            >
              <IconDownload />
              Export CSV
            </button>
          </div>

          {likesLoading ? (
            <div className="pf-tracks-empty">
              <div className="pf-spinner" />
              <span>Cargando…</span>
            </div>
          ) : likes.length === 0 ? (
            <div className="pf-tracks-empty">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <p>No has guardado ninguna canción todavía.</p>
              <p className="pf-tracks-hint">
                Pulsa el ❤️ en el reproductor a pantalla completa mientras escuchas una playlist de SoundCloud.
              </p>
            </div>
          ) : (
            <div className="pf-track-list">
              {/* Header row */}
              <div className="pf-track-row pf-track-row--hd">
                <span className="pf-col-num">#</span>
                <span className="pf-col-art" />
                <span className="pf-col-info">Title</span>
                <span className="pf-col-playlist">Playlist</span>
                <span className="pf-col-date">Saved</span>
                <span className="pf-col-action" />
              </div>

              {likes.map((like, i) => (
                <div key={like.id} className="pf-track-row">
                  <span className="pf-col-num">{i + 1}</span>

                  {/* Artwork */}
                  <div className="pf-col-art">
                    {like.artwork_url ? (
                      <img src={like.artwork_url} alt="" className="pf-art-img" />
                    ) : (
                      <div className="pf-art-img pf-art-empty"><IconNote /></div>
                    )}
                  </div>

                  {/* Title + artist */}
                  <div className="pf-col-info">
                    <span className="pf-t-name">{like.title}</span>
                    {like.artist && <span className="pf-t-artist">{like.artist}</span>}
                  </div>

                  {/* Playlist label badge */}
                  {like.sc_label
                    ? <span className="pf-col-playlist"><span className="pf-label-badge">{like.sc_label}</span></span>
                    : <span className="pf-col-playlist" />
                  }

                  {/* Date */}
                  <span className="pf-col-date">
                    {like.liked_at
                      ? new Date(like.liked_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
                      : ''}
                  </span>

                  {/* Remove */}
                  <span className="pf-col-action">
                    <button
                      className="pf-remove-btn"
                      aria-label="Quitar de guardadas"
                      onClick={() => removeLike(like.id)}
                    >
                      <IconClose />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
