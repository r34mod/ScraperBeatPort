import { useState, useEffect, useRef } from 'react';
import { useRadio } from '../context/RadioContext';

export default function FullscreenPlayer({ onClose }) {
  const radio = useRadio();
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
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
          <button className="fp-icon-btn fp-btn-heart" aria-label="Me gusta">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78
                       l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>

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

        {/* Volume */}
        <div className="fp-volume-row">
          {/* quiet icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          </svg>
          <input
            type="range"
            className="fp-vol-bar"
            min="0" max="1" step="0.02"
            value={radio.volume}
            style={{ '--p': `${radio.volume * 100}%` }}
            onChange={e => radio.setVolume(Number(e.target.value))}
            aria-label="Volumen"
          />
          {/* loud icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </div>

        

      </div>{/* /fp-panel */}

      </div>{/* /fp-main */}
    </div>
  );
}
