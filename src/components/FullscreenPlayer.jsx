import { useState, useEffect, useRef } from 'react';
import { useRadio } from '../context/RadioContext';
import { useAuth } from '../context/AuthContext';
import { useLikes } from '../hooks/useLikes';

const EQ_BANDS = [
  { label: '60',  freq: 60,    type: 'lowshelf' },
  { label: '200', freq: 200,   type: 'peaking'  },
  { label: '500', freq: 500,   type: 'peaking'  },
  { label: '1K',  freq: 1000,  type: 'peaking'  },
  { label: '4K',  freq: 4000,  type: 'peaking'  },
  { label: '8K',  freq: 8000,  type: 'peaking'  },
  { label: '16K', freq: 16000, type: 'highshelf' },
];

const PRESETS = {
  'Flat':           [ 0,  0,  0,  0,  0,  0,  0],
  'Bass Boost':     [ 8,  5,  2,  0, -1, -1,  0],
  'Studio Monitor': [ 2,  1,  0, -1,  2,  3,  2],
  'Vocal Boost':    [-2, -2,  3,  5,  3,  0, -1],
  'Electronic':     [ 5,  3, -2, -2,  3,  4,  3],
};

export default function FullscreenPlayer({ onClose }) {
  const radio = useRadio();
  const { isLoggedIn } = useAuth();
  const { isLiked, toggleLike } = useLikes();
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeToast, setLikeToast] = useState(''); // brief feedback message
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [eqOpen, setEqOpen] = useState(false);
  const [gains, setGainsLocal] = useState(() => radio.eqGains.slice());
  const [activePreset, setActivePreset] = useState('Studio Monitor');
  const [btActive, setBtActive] = useState(false);
  const seekingRef = useRef(false);

  const isSC      = !!radio.scEmbed;
  const isPlaying = isSC ? radio.scPlaying : radio.playing;
  const img       = isSC ? radio.scImg : null;
  const title     = isSC ? (radio.scTrackTitle || radio.scLabel) : radio.stationName;
  const artist    = isSC && radio.scLabel !== radio.scTrackTitle ? radio.scLabel : '';

  /* ── Poll SC widget position / duration ────────────────── */
  useEffect(() => {
    if (!isSC) return;
    const w = radio.scWidgetRef?.current;
    if (!w) return;

    const update = () => {
      if (seekingRef.current) return;
      try {
        w.getDuration(d => { if (d > 0) setDuration(d); });
        w.getPosition(p => { if (p != null) setPosition(p); });
      } catch {}
    };

    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [isSC, radio.scEmbed]); // re-run when track changes

  /* ── EQ sync ───────────────────────────────────────────── */
  useEffect(() => { radio.setEqGains(gains); }, [gains]); // eslint-disable-line

  useEffect(() => {
    const cg = radio.eqGains;
    setGainsLocal(prev => prev.every((g, i) => g === cg[i]) ? prev : cg.slice());
  }, [radio.eqGains]);

  const handleEnableEQ = () => { if (!radio.eqEnabled) radio.enableEQ(); };

  const applyPreset = (name) => {
    handleEnableEQ();
    setActivePreset(name);
    setGainsLocal(PRESETS[name].slice());
  };

  const setBand = (idx, val) => {
    handleEnableEQ();
    setActivePreset('');
    setGainsLocal(prev => { const g = prev.slice(); g[idx] = Number(val); return g; });
  };

  /* ── Like / unlike ─────────────────────────────────────── */
  const handleLike = async () => {
    if (!isLoggedIn) {
      setLikeToast('Inicia sesión para guardar canciones');
      setTimeout(() => setLikeToast(''), 2500);
      return;
    }
    if (!isSC || !title) return;
    setLikeLoading(true);
    try {
      const nowLiked = await toggleLike({
        title,
        artist,
        artwork_url: radio.scArtwork || radio.scImg || '',
        sc_label: radio.scLabel || '',
      });
      setLikeToast(nowLiked ? '❤️ Guardada' : 'Eliminada de guardadas');
      setTimeout(() => setLikeToast(''), 2000);
    } finally {
      setLikeLoading(false);
    }
  };

  /* ── Bluetooth ─────────────────────────────────────────── */
  const handleBluetooth = () => {    if (navigator.bluetooth) {
      navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] })
        .then(() => setBtActive(true))
        .catch(() => {});
    } else {
      alert('El Bluetooth web no está disponible en este navegador.');
    }
  };

  /* ── Keyboard / scroll lock ────────────────────────────── */
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Helpers ───────────────────────────────────────────── */
  const fmt = ms => {
    const s = Math.floor((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="fp" role="dialog" aria-modal="true" aria-label="Reproductor a pantalla completa">

      {/* Blurred art background */}
      {img && <div className="fp-bg-art" style={{ backgroundImage: `url(${img})` }} />}
      <div className="fp-bg-scrim" />

      {/* ── Header bar ── */}
      <div className="fp-header">
        <button className="fp-icon-btn" onClick={onClose} aria-label="Cerrar reproductor">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        <div className="fp-header-center">
          <span className="fp-label-now-playing">NOW PLAYING</span>
          <span className="fp-label-source">{isSC ? 'SoundCloud' : 'Radio en vivo'}</span>
        </div>

        {/* Spacer keeps title centred */}
        <div className="fp-icon-btn" aria-hidden="true" style={{ visibility: 'hidden' }} />
      </div>

      {/* ── Art + panel (two-col on desktop) ── */}
      <div className="fp-main">

      {/* ── Album art ── */}
      <div className="fp-art-section">
        {img
          ? <img src={img} alt={title} className="fp-art-img" />
          : (
            <div className="fp-art-empty">
              <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4
                         4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          )
        }
      </div>

      {/* ── Bottom panel ── */}
      <div className="fp-panel">

        {/* Track info + heart */}
        <div className="fp-track-row">
          <div className="fp-track-text">
            <p className="fp-track-name">{title}</p>
            {artist && <p className="fp-track-sub">{artist}</p>}
          </div>
          <button
            className={`fp-icon-btn fp-btn-heart${isSC && isLiked(title, artist) ? ' fp-btn-heart--active' : ''}`}
            aria-label={isSC && isLiked(title, artist) ? 'Quitar de guardadas' : 'Guardar canción'}
            title={!isLoggedIn ? 'Inicia sesión para guardar canciones' : isSC ? (isLiked(title, artist) ? 'Quitar de guardadas' : 'Guardar canción') : 'Solo disponible para playlists'}
            onClick={handleLike}
            disabled={likeLoading || !isSC}
            style={!isSC ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
          >
            {isSC && isLiked(title, artist) ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78
                         l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78
                         l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Like toast */}
        {likeToast && (
          <div className="fp-like-toast">{likeToast}</div>
        )}

        {/* Progress (SC) or live badge (radio) */}
        {isSC ? (
          <div className="fp-seek-wrap">
            <input
              type="range"
              className="fp-seek-bar"
              min="0"
              max={duration || 100}
              value={position}
              style={{ '--p': `${pct}%` }}
              onPointerDown={() => { seekingRef.current = true; }}
              onChange={e => setPosition(Number(e.target.value))}
              onPointerUp={e => {
                const v = Number(e.currentTarget.value);
                seekingRef.current = false;
                try { radio.scWidgetRef?.current?.seekTo(v); } catch {}
              }}
            />
            <div className="fp-seek-times">
              <span>{fmt(position)}</span>
              <span>-{fmt(Math.max(0, duration - position))}</span>
            </div>
          </div>
        ) : (
          <div className="fp-live-badge">
            <span className="fp-live-dot" />
            <span>EN VIVO</span>
          </div>
        )}

        {/* Playback controls */}
        <div className="fp-controls">
          <button className="fp-btn-ctrl" disabled={!isSC} aria-label="Aleatorio">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>

          <button className="fp-btn-skip" onClick={isSC ? radio.scPrev : undefined}
                  disabled={!isSC} aria-label="Anterior">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19,20 9,12 19,4"/>
              <rect x="5" y="4" width="2.5" height="16" rx="1"/>
            </svg>
          </button>

          <button className="fp-btn-play"
                  onClick={isSC ? radio.toggleSC : radio.togglePlay}
                  aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying
              ? <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="4" width="4" height="16" rx="1"/>
                  <rect x="15" y="4" width="4" height="16" rx="1"/>
                </svg>
              : <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 20,12 5,21"/>
                </svg>
            }
          </button>

          <button className="fp-btn-skip" onClick={isSC ? radio.scNext : undefined}
                  disabled={!isSC} aria-label="Siguiente">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,4 15,12 5,20"/>
              <rect x="16.5" y="4" width="2.5" height="16" rx="1"/>
            </svg>
          </button>

          <button className="fp-btn-ctrl" disabled={!isSC} aria-label="Repetir">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>
        </div>

        {/* Volume + Bluetooth + EQ toggle */}
        <div className="fp-util-row">
          {/* Mute toggle */}
          <button
            className="fp-icon-btn"
            onClick={() => radio.setVolume(radio.volume > 0 ? 0 : 1)}
            aria-label={radio.volume === 0 ? 'Activar sonido' : 'Silenciar'}
            title={radio.volume === 0 ? 'Activar sonido' : 'Silenciar'}
          >
            {radio.volume === 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            ) : radio.volume < 0.5 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            )}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            className="fp-vol-bar"
            min="0" max="1" step="0.02"
            value={radio.volume}
            style={{ '--p': `${radio.volume * 100}%` }}
            onChange={e => radio.setVolume(Number(e.target.value))}
            aria-label="Volumen"
          />

          {/* Bluetooth */}
          <button
            className={`fp-icon-btn fp-bt-btn${btActive ? ' fp-bt-btn--active' : ''}`}
            onClick={handleBluetooth}
            title="Conectar vía Bluetooth"
            aria-label="Bluetooth"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
            </svg>
          </button>

          {/* EQ toggle (disabled for SoundCloud — EQ needs direct audio access) */}
          <button
            className={`fp-icon-btn fp-eq-toggle${eqOpen ? ' fp-eq-toggle--active' : ''}${isSC ? ' fp-eq-toggle--disabled' : ''}`}
            onClick={() => !isSC && setEqOpen(v => !v)}
            title={isSC ? 'EQ no disponible para playlists (solo radio en vivo)' : 'Ecualizador'}
            aria-label="Ecualizador"
            style={isSC ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
          </button>
        </div>

        {/* ── Equalizer panel ── */}
        {eqOpen && (
          <div className="fp-eq-panel">
            <div className="fp-eq-header">
              <span className="fp-eq-title">Ecualizador</span>
              {!radio.eqEnabled && (
                <button className="fp-eq-enable-btn" onClick={handleEnableEQ}>
                  Activar EQ
                </button>
              )}
              <span className="fp-eq-preset-name">
                {radio.eqEnabled ? (activePreset || 'Custom') : 'OFF'}
              </span>
            </div>

            {/* Band sliders */}
            <div className="fp-eq-bands">
              {EQ_BANDS.map(({ label }, i) => (
                <div key={i} className="fp-eq-band">
                  <span className="fp-eq-val">{gains[i] > 0 ? '+' : ''}{gains[i]}</span>
                  <div className="fp-eq-track">
                    <input
                      type="range"
                      className="fp-eq-slider"
                      min="-12" max="12" step="1"
                      value={gains[i]}
                      onChange={e => setBand(i, e.target.value)}
                      orient="vertical"
                      style={{ '--pct': `${((gains[i] + 12) / 24) * 100}%` }}
                    />
                  </div>
                  <span className="fp-eq-label">{label}</span>
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="fp-eq-presets">
              {Object.keys(PRESETS).map(name => (
                <button
                  key={name}
                  className={`fp-eq-preset${activePreset === name ? ' active' : ''}`}
                  onClick={() => applyPreset(name)}
                >{name}</button>
              ))}
            </div>
          </div>
        )}

      </div>{/* /fp-panel */}

      </div>{/* /fp-main */}
    </div>
  );
}
