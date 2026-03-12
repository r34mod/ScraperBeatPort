import { useState, useEffect, useRef } from 'react';
import {
  IconMusic,
  IconPlaylist,
  IconListCheck,
  IconChartBar,
  IconHeart,
  IconRadio,
  IconDownload,
  IconUsers,
} from '@tabler/icons-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import { STATIONS } from '../data/stations';

const PREFS_KEY = 'msh_user_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}
function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

export default function Layout() {
  const { email, clear } = useAuth();
  const radio = useRadio();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // User preferences
  const [prefs, setPrefs] = useState(loadPrefs);
  const [displayName, setDisplayName] = useState(prefs.displayName || '');
  const [favStation, setFavStation] = useState(prefs.favStation || '');
  const [saved, setSaved] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleLogout = () => {
    clear();
    setDropdownOpen(false);
    navigate('/login');
  };

  const openProfile = () => {
    setDropdownOpen(false);
    const p = loadPrefs();
    setDisplayName(p.displayName || '');
    setFavStation(p.favStation || '');
    setSaved(false);
    setPanelOpen(true);
  };

  const saveProfile = () => {
    const p = { displayName: displayName.trim(), favStation };
    savePrefs(p);
    setPrefs(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const userName = prefs.displayName || email?.split('@')[0] || 'Usuario';

  const links = [
    { to: '/beatport',        label: 'Beatport',       icon: <IconMusic size={22} stroke={1.7} /> },
    { to: '/traxsource',      label: 'Traxsource',     icon: <IconPlaylist size={22} stroke={1.7} /> },
    { to: '/1001tracklists',  label: '1001Tracklists', icon: <IconListCheck size={22} stroke={1.7} /> },
    { to: '/visualice',       label: 'Previsualizar Canciones', icon: <IconChartBar size={22} stroke={1.7} /> },
    { to: '/radio',           label: 'Radio',          icon: <IconRadio size={22} stroke={1.7} /> },
    { to: '/tidal',           label: 'Descarga Musica', icon: <IconDownload size={22} stroke={1.7} /> },
    { to: '/community',       label: 'Comunidad',      icon: <IconUsers size={22} stroke={1.7} /> },
  ];

  const closeMobile = () => { setMobileOpen(false); document.body.style.overflow = ''; };

  return (
    <>
      {/* Background blobs */}
      <div className="background-orbs" aria-hidden="true">
        <div className="orb orb-red" />
        <div className="orb orb-cyan" />
      </div>

      {/* Nav Header */}
      <nav className="nav-header">
        <div className="nav-container">
          <NavLink to="/" className="nav-logo">
            <img src="/images/icon.PNG" alt="Logo" className="nav-logo-icon" />
          </NavLink>

          <ul className="nav-menu">
            {links.map(l => (
              <li key={l.to} className="nav-item">
                <NavLink to={l.to} className="nav-link">{l.label}</NavLink>
              </li>
            ))}
          </ul>

          <div className="nav-actions">
            {/* User icon with dropdown */}
            <div className="nav-user-wrapper" ref={dropdownRef}>
              <button
                className="nav-login-btn"
                title="Mi cuenta"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-avatar">{userName[0].toUpperCase()}</div>
                    <div>
                      <div className="user-dropdown-name">{userName}</div>
                      <div className="user-dropdown-email">{email}</div>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item" onClick={openProfile}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ajustes de perfil
                  </button>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item danger" onClick={handleLogout}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            <NavLink to="/radio" className="nav-listen-btn">♪</NavLink>
          </div>

          <button
            className="nav-mobile-toggle"
            onClick={() => {
              setMobileOpen(!mobileOpen);
              document.body.style.overflow = mobileOpen ? '' : 'hidden';
            }}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="nav-mobile-backdrop" onClick={closeMobile} />
      )}

      {/* Mobile Menu - Side Drawer */}
      <div className={`nav-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <div className="mobile-menu-header">
          <div className="mobile-menu-user">
            <div className="mobile-user-avatar">{userName[0].toUpperCase()}</div>
            <div>
              <div className="mobile-user-name">{userName}</div>
              <div className="mobile-user-email">{email}</div>
            </div>
          </div>
          <button className="mobile-menu-close" onClick={closeMobile}>✕</button>
        </div>

        <div className="mobile-menu-divider" />

        <nav className="mobile-menu-nav">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} className="mobile-nav-link" onClick={closeMobile}>
              <span className="mobile-nav-icon">{l.icon}</span>
              <span className="mobile-nav-label">{l.label}</span>
              <svg className="mobile-nav-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </NavLink>
          ))}
        </nav>

        <div className="mobile-menu-footer">
          <button className="mobile-logout-btn" onClick={() => { closeMobile(); handleLogout(); }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div className={`page-content${radio.visible ? ' radio-active' : ''}`}>
        <Outlet />
      </div>

      {/* Radio Footer Player */}
      {radio.visible && (
        <div className="radio-footer">
          <div className="radio-footer-info">
            <svg width="48" height="48" viewBox="0 0 256 256" fill="currentColor" style={{ borderRadius: 12 }}>
              <path d="M199.641 113.351C198.353 117.933 193.96 120.61 189.337 119.393C183.956 117.976 179.319 118.749 175.67 123.245C173.924 125.393 173.18 127.87 173.194 130.633C173.208 147.715 173.237 164.811 173.151 181.893C173.151 183.726 172.808 185.745 172.021 187.363C170.174 191.1 165.953 192.803 162.06 191.773C158.396 190.799 155.649 187.191 155.62 183.11C155.591 178.557 155.591 173.989 155.591 169.436C155.591 164.883 155.591 160.315 155.591 155.762C155.591 147.343 155.563 138.924 155.591 130.504C155.663 114.081 168.829 100.908 185.044 101.166C188.035 101.209 191.083 101.853 193.974 102.655C198.597 103.944 200.944 108.64 199.613 113.337L199.641 113.351ZM132.922 189.009C130.418 191.787 127.312 192.689 123.806 191.558C120.171 190.384 118.11 187.735 117.624 183.912C117.552 183.353 117.567 182.781 117.567 182.208C117.567 145.997 117.567 109.786 117.567 73.5746C117.567 67.8902 121.273 63.8524 126.454 63.8524C130.833 63.8524 134.583 67.2315 135.055 71.6273C135.141 72.4434 135.141 73.2739 135.141 74.09C135.141 92.0739 135.141 110.043 135.141 128.027C135.141 146.068 135.141 164.109 135.141 182.165C135.141 184.714 134.668 187.062 132.908 189.023L132.922 189.009ZM96.6865 183.21C96.6865 187.62 93.6239 191.372 89.7027 191.901C85.0515 192.531 81.0587 190.069 79.8566 185.773C79.5846 184.814 79.556 183.769 79.556 182.766C79.5417 170.538 79.556 158.325 79.556 146.097C79.556 133.869 79.556 121.899 79.556 109.814C79.556 104.559 83.1768 100.751 88.1714 100.751C93.1373 100.751 96.7008 104.459 96.7008 109.685C96.7008 114.912 96.7008 183.21 96.7008 183.21H96.6865ZM128.071 0.00688847C60.2645 -0.709029 0.0859603 54.4596 9.31497e-05 127.827C-0.085774 200.378 59.2055 256.849 129.531 255.99C198.954 255.131 254.51 199.118 255.97 130.819C257.53 57.4521 197.809 -0.608801 128.071 0.00688847Z" />
            </svg>
            <div>
              <div className="radio-footer-name">{radio.stationName}</div>
              <div className="radio-footer-status">En reproducción</div>
            </div>
          </div>
          <button className="radio-footer-play" onClick={radio.togglePlay}>
            {radio.playing ? '⏸' : '▶'}
          </button>
          <button className="radio-footer-close" onClick={radio.stop}>✖</button>
        </div>
      )}

      {/* Profile Panel Modal */}
      {panelOpen && (
        <div className="profile-overlay" onClick={() => setPanelOpen(false)}>
          <div className="profile-panel" onClick={e => e.stopPropagation()}>
            <div className="profile-panel-header">
              <h2>Ajustes de perfil</h2>
              <button className="profile-close" onClick={() => setPanelOpen(false)}>✕</button>
            </div>

            <div className="profile-panel-body">
              <div className="profile-avatar-big">{userName[0].toUpperCase()}</div>
              <div className="profile-email">{email}</div>

              <label className="profile-label">Nombre de usuario</label>
              <input
                type="text"
                className="profile-input"
                placeholder="Tu nombre..."
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />

              <label className="profile-label">Radio favorita</label>
              <select
                className="profile-select"
                value={favStation}
                onChange={e => setFavStation(e.target.value)}
              >
                <option value="">— Ninguna —</option>
                {STATIONS.map(s => (
                  <option key={s.url} value={s.url}>{s.name} ({s.genre})</option>
                ))}
              </select>

              {favStation && (
                <button
                  className="profile-play-fav"
                  onClick={() => {
                    const st = STATIONS.find(s => s.url === favStation);
                    if (st) radio.play(st.url, st.name);
                  }}
                >
                  ▶ Reproducir favorita
                </button>
              )}

              <button className="profile-save" onClick={saveProfile}>
                {saved ? '✓ Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
