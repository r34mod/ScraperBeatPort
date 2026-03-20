import { useState, useRef, useEffect } from 'react';
import { STATIONS } from '../data/stations';
import { useRadio } from '../context/RadioContext';
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
  const radio = useRadio();
  const [stationIndex, setStationIndex] = useState(() => {
    if (radio.streamUrl) {
      const idx = STATIONS.findIndex(s => s.url === radio.streamUrl);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [knobDeg, setKnobDeg] = useState(0);
  const [gains, setGains] = useState(radio.eqGains.slice());
  const [activePreset, setActivePreset] = useState('Studio Monitor');

  const knobRef = useRef(null);
  const isDragging = useRef(false);

  const isPlaying = radio.playing && radio.streamUrl === STATIONS[stationIndex]?.url;

  // Sync filter gains to context whenever local gains change
  useEffect(() => {
    radio.setEqGains(gains);
  }, [gains]);

  // Sync local gains from context (e.g. if changed elsewhere)
  useEffect(() => {
    const contextGains = radio.eqGains;
    setGains(prev => {
      if (prev.every((g, i) => g === contextGains[i])) return prev;
      return contextGains.slice();
    });
  }, [radio.eqGains]);

  // Enable EQ through context (sets crossOrigin + builds Web Audio graph)
  const handleEnableEQ = () => {
    if (!radio.eqEnabled) radio.enableEQ();
  };

  const applyPreset = (name) => {
    handleEnableEQ();
    setActivePreset(name);
    setGains(PRESETS[name].slice());
  };

  const setBand = (idx, val) => {
    handleEnableEQ();
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

  // When station index changes while playing this tuner, update the context
  useEffect(() => {
    if (radio.playing && radio.streamUrl && STATIONS.some(s => s.url === radio.streamUrl)) {
      // If the user changes station via tuner while playing, switch stream
      const prevIdx = STATIONS.findIndex(s => s.url === radio.streamUrl);
      if (prevIdx !== stationIndex && prevIdx >= 0) {
        radio.play(current.url, current.name);
      }
    }
  }, [stationIndex]);

  // Sync tuner index when context changes from outside (e.g. RadioPage)
  useEffect(() => {
    if (radio.streamUrl) {
      const idx = STATIONS.findIndex(s => s.url === radio.streamUrl);
      if (idx >= 0 && idx !== stationIndex) {
        setStationIndex(idx);
        setKnobDeg((idx / Math.max(STATIONS.length - 1, 1)) * 360);
      }
    }
  }, [radio.streamUrl]);

  const togglePlay = async () => {
    if (isPlaying) {
      radio.togglePlay();
    } else {
      radio.play(current.url, current.name);
    }
  };

  const freq = (88 + (stationIndex / Math.max(total - 1, 1)) * 20).toFixed(1);
  const needleDeg = (stationIndex / Math.max(total - 1, 1)) * 270 - 135;

  return (
    <div className="rt-body">

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
          {!radio.eqEnabled && (
            <button className="rt-eq-enable" onClick={handleEnableEQ} title="Activar ecualizador (requiere recarga del stream)">
              Activar EQ
            </button>
          )}
          <span className="rt-eq-preset-name">{radio.eqEnabled ? (activePreset || 'Custom') : 'OFF'}</span>
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
