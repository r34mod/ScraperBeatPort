import { useState, useRef, useEffect, useCallback } from 'react';
import { STATIONS } from '../data/stations';
import './RadioTuner.css';

const EQ_BANDS = [
  { label: '60',   freq: 60,    type: 'lowshelf' },
  { label: '200',  freq: 200,   type: 'peaking'  },
  { label: '500',  freq: 500,   type: 'peaking'  },
  { label: '1K',   freq: 1000,  type: 'peaking'  },
  { label: '4K',   freq: 4000,  type: 'peaking'  },
  { label: '8K',   freq: 8000,  type: 'peaking'  },
  { label: '16K',  freq: 16000, type: 'highshelf' },
];

const PRESETS = {
  'Flat':          [ 0,  0,  0,  0,  0,  0,  0],
  'Bass Boost':    [ 8,  5,  2,  0, -1, -1,  0],
  'Studio Monitor':[ 2,  1,  0, -1,  2,  3,  2],
  'Vocal Boost':   [-2, -2,  3,  5,  3,  0, -1],
  'Electronic':    [ 5,  3, -2, -2,  3,  4,  3],
};

export default function RadioTuner() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [knobDeg, setKnobDeg] = useState(0);
  const [gains, setGains] = useState(PRESETS['Studio Monitor'].slice());
  const [activePreset, setActivePreset] = useState('Studio Monitor');

  const audioRef = useRef(null);
  const knobRef = useRef(null);
  const isDragging = useRef(false);
  const audioCtxRef = useRef(null);
  const filtersRef = useRef([]);
  const sourceRef = useRef(null);

  // Build audio graph once
  const buildGraph = useCallback(() => {
    if (audioCtxRef.current || !audioRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = src;
    const filters = EQ_BANDS.map(({ freq, type }) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = 1.4;
      f.gain.value = 0;
      return f;
    });
    filtersRef.current = filters;
    // Chain: src → f0 → f1 → … → destination
    src.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(ctx.destination);
    // Apply initial preset
    PRESETS['Studio Monitor'].forEach((g, i) => { filters[i].gain.value = g; });
  }, []);

  // Sync filter gains whenever gains state changes
  useEffect(() => {
    filtersRef.current.forEach((f, i) => { f.gain.value = gains[i]; });
  }, [gains]);

  const applyPreset = (name) => {
    setActivePreset(name);
    setGains(PRESETS[name].slice());
  };

  const setBand = (idx, val) => {
    setActivePreset('');
    setGains(prev => { const g = prev.slice(); g[idx] = Number(val); return g; });
  };

  const total = STATIONS.length;
  const current = STATIONS[stationIndex];

  const goTo = (idx) => {
    const next = (idx + total) % total;
    setStationIndex(next);
    setKnobDeg(prev => prev + (360 / total));
  };

  const prev = () => goTo(stationIndex - 1);
  const next = () => goTo(stationIndex + 1);

  // Drag knob support
  const handleMove = (e) => {
    if (!isDragging.current || !knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    setKnobDeg(angle);
    const idx = Math.floor((angle / 360) * total) % total;
    setStationIndex(idx);
  };

  const stopDrag = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', handleMove);
    document.removeEventListener('touchend', stopDrag);
  };

  const startDrag = () => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', stopDrag);
  };

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = current.url;
    if (isPlaying) audioRef.current.play().catch(() => {});
  }, [stationIndex]);

  const togglePlay = () => {
    buildGraph();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(p => !p);
  };

  const freq = (88 + (stationIndex / Math.max(total - 1, 1)) * 20).toFixed(1);
  const needleDeg = (stationIndex / Math.max(total - 1, 1)) * 270 - 135;

  return (
    <div className="rt-body">
      <audio ref={audioRef} />

      {/* Header */}
      <div className="rt-header">
        <div className="rt-live-label">
          <span className={`rt-dot${isPlaying ? ' on' : ''}`} />
          LIVE BROADCAST
        </div>
        <span className="rt-freq-badge">{freq} MHZ</span>
      </div>

      {/* Station info */}
      <div className="rt-station">{current.name}</div>
      <div className="rt-genre">{current.genre} · {current.country}</div>

      {/* Tuner row: arrow | circle | arrow */}
      <div className="rt-tuner-row">
        <button className="rt-arrow" onClick={prev} aria-label="Anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="rt-circle-wrap">
          <div className="rt-ring rt-ring-1" />
          <div className="rt-ring rt-ring-2" />
          <div className="rt-ring rt-ring-3" />
          <div className="rt-needle" style={{ transform: `translateX(-50%) rotate(${needleDeg}deg)` }} />
          <div className="rt-circle-center">
            <span className="rt-freq-num">{freq}</span>
            <span className="rt-freq-unit">MHz</span>
            <span className="rt-tuning-lbl">TUNING</span>
          </div>
        </div>

        <button className="rt-arrow" onClick={next} aria-label="Siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Waveform bars */}
      <div className="rt-wave">
        {Array.from({ length: 22 }).map((_, i) => (
          <div
            key={i}
            className="rt-wbar"
            style={{
              '--h': `${8 + Math.abs(Math.sin(i * 0.85 + 0.3)) * 24}px`,
              animationDelay: `${(i * 0.07) % 1.4}s`,
              animationDuration: `${0.65 + (i % 5) * 0.11}s`,
            }}
          />
        ))}
      </div>

      {/* Play button */}
      <button className={`rt-play${isPlaying ? ' active' : ''}`} onClick={togglePlay}>
        {isPlaying ? '⏸ Stop' : '▶ Listen Live'}
      </button>

      {/* ── Equalizer ─────────────────────────────────────────── */}
      <div className="rt-eq">
        <div className="rt-eq-header">
          <span className="rt-eq-title">Equalizer</span>
          <span className="rt-eq-preset-name">{activePreset || 'Custom'}</span>
        </div>

        {/* Band sliders */}
        <div className="rt-eq-bands">
          {EQ_BANDS.map(({ label }, i) => (
            <div key={i} className="rt-eq-band">
              <span className="rt-eq-val">{gains[i] > 0 ? '+' : ''}{gains[i]}</span>
              <div className="rt-eq-track">
                <input
                  type="range"
                  className="rt-eq-slider"
                  min="-12" max="12" step="1"
                  value={gains[i]}
                  onChange={e => setBand(i, e.target.value)}
                  orient="vertical"
                  style={{ '--pct': `${((gains[i] + 12) / 24) * 100}%` }}
                />
              </div>
              <span className="rt-eq-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Presets */}
        <div className="rt-eq-presets">
          {Object.keys(PRESETS).map(name => (
            <button
              key={name}
              className={`rt-eq-preset${activePreset === name ? ' active' : ''}`}
              onClick={() => applyPreset(name)}
            >{name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
