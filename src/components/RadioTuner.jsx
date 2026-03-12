import { useState, useRef, useEffect } from 'react';
import { STATIONS } from '../data/stations';
import './RadioTuner.css';

export default function RadioTuner() {
  const [stationIndex, setStationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [knobDeg, setKnobDeg] = useState(0);

  const audioRef = useRef(null);
  const knobRef = useRef(null);
  const isDragging = useRef(false);

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
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(p => !p);
  };

  // Frequency bar ticks
  const ticks = Array.from({ length: 13 });

  return (
    <div className="vr-body">
      <audio ref={audioRef} />

      {/* Top speaker grille */}
      <div className="vr-grille">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="vr-grille-bar" />)}
      </div>

      {/* Dial / frequency strip */}
      <div className="vr-dial-wrap">
        <div className="vr-dial-strip">
          {ticks.map((_, i) => (
            <div key={i} className="vr-tick">
              <div className="vr-tick-line" />
              <span>{88 + i * 2}</span>
            </div>
          ))}
        </div>
        <div
          className="vr-needle"
          style={{ left: `${(stationIndex / (total - 1)) * 90 + 5}%` }}
        />
      </div>

      {/* Screen */}
      <div className="vr-screen">
        <div className="vr-screen-status">
          <span className={`vr-dot ${isPlaying ? 'on' : ''}`} />
          {isPlaying ? 'ON AIR' : 'STANDBY'}
        </div>
        <div className="vr-screen-name">{current.name}</div>
        <div className="vr-screen-meta">
          <span>{current.genre}</span>
          <span>{current.country}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="vr-controls">
        {/* Prev / Next */}
        <button className="vr-nav-btn" onClick={prev} aria-label="Anterior">
          &#9664;
        </button>

        {/* Big tuning knob */}
        <div className="vr-knob-wrap">
          <div
            ref={knobRef}
            className="vr-knob"
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            style={{ transform: `rotate(${knobDeg}deg)` }}
          >
            <div className="vr-knob-mark" />
          </div>
        </div>

        <button className="vr-nav-btn" onClick={next} aria-label="Siguiente">
          &#9654;
        </button>
      </div>

      {/* Play button */}
      <button className={`vr-play-btn ${isPlaying ? 'active' : ''}`} onClick={togglePlay}>
        {isPlaying
          ? <><span className="vr-btn-icon">&#9646;&#9646;</span> STOP</>
          : <><span className="vr-btn-icon">&#9654;</span> LISTEN</>}
      </button>
    </div>
  );
}
