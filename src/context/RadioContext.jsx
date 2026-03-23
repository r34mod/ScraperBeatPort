import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const RadioContext = createContext(null);

const EQ_BANDS = [
  { freq: 60,    type: 'lowshelf' },
  { freq: 200,   type: 'peaking'  },
  { freq: 500,   type: 'peaking'  },
  { freq: 1000,  type: 'peaking'  },
  { freq: 4000,  type: 'peaking'  },
  { freq: 8000,  type: 'peaking'  },
  { freq: 16000, type: 'highshelf' },
];

const STUDIO_MONITOR = [2, 1, 0, -1, 2, 3, 2];

// Generates a Blob URL for a silent WAV with tiny non-zero samples.
// The audio is 30 s long (fewer looping gaps) and each sample has amplitude +1
// (−90 dBFS), which is inaudible through any speaker but keeps iOS/Android from
// classifying the stream as truly silent and suspending the audio session.
function buildSilenceURL() {
  const SR = 8000, secs = 30, n = SR * secs * 2; // 16-bit mono PCM, 30 s
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n, true);
  // Fill every sample with +1 (signed 16-bit). iOS will not suspend a stream
  // whose PCM data is non-zero, even though the output level is −90 dBFS.
  for (let i = 44; i < 44 + n; i += 2) v.setInt16(i, 1, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const filtersRef = useRef([]);
  const sourceRef = useRef(null);
  const eqActiveRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [stationName, setStationName] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [visible, setVisible] = useState(false);
  const [volume, setVolumeSt] = useState(1);
  const [eqGains, setEqGainsSt] = useState(STUDIO_MONITOR.slice());
  const [eqEnabled, setEqEnabled] = useState(false);

  // SoundCloud embed state
  const [scEmbed, setScEmbed] = useState(null);   // iframe src URL
  const [scLabel, setScLabel] = useState('');
  const [scImg, setScImg] = useState('');
  const [scPlaying, setScPlaying] = useState(false);
  const [scTrackTitle, setScTrackTitle] = useState('');
  const [scArtwork, setScArtwork] = useState('');   // artwork_url from getCurrentSound
  const scIframeRef = useRef(null);
  const scWidgetRef = useRef(null);
  const silenceAudioRef = useRef(null);  // silent looping <audio> – keepalive on mobile
  const silenceUrlRef = useRef(null);    // blob URL for the silent WAV
  const scPlayingRef = useRef(false);    // stable mirror of scPlaying for no-dep effects
  const acKeepaliveRef = useRef(null);   // AudioContext oscillator backup keepalive (Android Chrome)

  // Restore from localStorage on mount
  useEffect(() => {
    const url = localStorage.getItem('radio_stream_url');
    const name = localStorage.getItem('radio_stream_name');
    if (url && name) {
      setStreamUrl(url);
      setStationName(name);
      setVisible(true);
    }
  }, []);

  // Lazily create audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
  }, []);

  // Enable EQ: sets crossOrigin, builds Web Audio graph, reloads stream
  const enableEQ = useCallback(() => {
    if (eqActiveRef.current) return; // already built
    const audio = audioRef.current;
    if (!audio) return;

    try {
      // Must set crossOrigin before loading src for Web Audio to work
      audio.crossOrigin = 'anonymous';
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaElementSource(audio);
      sourceRef.current = src;
      const filters = EQ_BANDS.map(({ freq, type }, i) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = 1.4;
        f.gain.value = 0;
        return f;
      });
      filtersRef.current = filters;
      src.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
      filters[filters.length - 1].connect(ctx.destination);
      eqActiveRef.current = true;
      setEqEnabled(true);

      // Reload stream so crossOrigin takes effect
      if (audio.src) {
        const currentSrc = audio.src;
        const wasPlaying = !audio.paused;
        audio.src = currentSrc;
        if (wasPlaying) {
          if (ctx.state === 'suspended') ctx.resume();
          audio.play().catch(() => {
            // CORS failed — fall back to no-EQ playback
            _disableEQ();
          });
        }
      }
    } catch {
      // Web Audio API not available
    }
  }, []);

  // Fallback: recreate audio element without crossOrigin/Web Audio
  const _disableEQ = useCallback(() => {
    const oldAudio = audioRef.current;
    const currentSrc = oldAudio?.src || '';
    const wasPlaying = oldAudio && !oldAudio.paused;
    const vol = oldAudio?.volume ?? 1;

    // Disconnect Web Audio graph
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }
    audioCtxRef.current = null;
    filtersRef.current = [];
    sourceRef.current = null;
    eqActiveRef.current = false;
    setEqEnabled(false);

    // New clean audio element
    const newAudio = new Audio();
    newAudio.volume = vol;
    audioRef.current = newAudio;

    if (currentSrc) {
      newAudio.src = currentSrc;
      if (wasPlaying) newAudio.play().catch(() => {});
    }
  }, []);

  // Apply gains to filters whenever eqGains changes
  useEffect(() => {
    filtersRef.current.forEach((f, i) => { f.gain.value = eqGains[i] ?? 0; });
  }, [eqGains]);

  const setEqGains = useCallback((gains) => {
    setEqGainsSt(gains);
  }, []);

  const play = useCallback((url, name) => {
    // Stop SC if playing
    stopSC();
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    audio.src = url;
    audio.play().catch(() => {});
    setStreamUrl(url);
    setStationName(name);
    setPlaying(true);
    setVisible(true);
    localStorage.setItem('radio_stream_url', url);
    localStorage.setItem('radio_stream_name', name);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (audio.paused) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeSt(v);
    if (audioRef.current) audioRef.current.volume = v;
    // Also update SoundCloud widget volume (widget API uses 0–100 scale)
    try { scWidgetRef.current?.setVolume(Math.round(v * 100)); } catch {}
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ''; }
    setPlaying(false);
    setVisible(false);
    setStreamUrl('');
    setStationName('');
    localStorage.removeItem('radio_stream_url');
    localStorage.removeItem('radio_stream_name');
  }, []);

  // ── SoundCloud embed functions ──────────────────────────────────
  const playSC = useCallback((embedUrl, label, img) => {
    // Stop radio stream if active
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ''; }
    setPlaying(false);
    setStreamUrl('');
    setStationName('');
    localStorage.removeItem('radio_stream_url');
    localStorage.removeItem('radio_stream_name');

    setScEmbed(embedUrl);
    setScLabel(label);
    setScImg(img || '');
    setScPlaying(true);
    setScTrackTitle('');
    setVisible(true);

    // ── Keepalive 1: silent looping <audio> ───────────────────────────────
    // A non-zero WAV played in a loop at low volume. iOS Safari requires an
    // active <audio> element (started via user gesture) to allow background
    // audio. Volume 0.01 × amplitude −90 dBFS ≈ −130 dBFS — inaudible.
    if (!silenceUrlRef.current) silenceUrlRef.current = buildSilenceURL();
    if (!silenceAudioRef.current) {
      const sa = new Audio(silenceUrlRef.current);
      sa.loop = true;
      sa.volume = 0.01;
      sa.setAttribute('playsinline', ''); // prevents iOS from requiring fullscreen
      silenceAudioRef.current = sa;
    }
    silenceAudioRef.current.play().catch(() => {});

    // ── Keepalive 2: Web Audio oscillator (Android Chrome) ────────────────
    // An AudioContext with an oscillator at gain 0.00001 (−100 dBFS) keeps
    // the browser's audio thread scheduled, redundant but very reliable on
    // Android. Created here (in a user-gesture callback) to satisfy policy.
    try {
      if (!acKeepaliveRef.current) {
        const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 8000 });
        acKeepaliveRef.current = ac;
        const g = ac.createGain();
        g.gain.value = 0.00001; // −100 dBFS, completely inaudible
        g.connect(ac.destination);
        const osc = ac.createOscillator();
        osc.frequency.value = 440;
        osc.connect(g);
        osc.start();
        if (ac.state === 'suspended') ac.resume();
      } else if (acKeepaliveRef.current.state === 'suspended') {
        acKeepaliveRef.current.resume();
      }
    } catch {}

    // Register Media Session → OS shows lock-screen controls and won't kill audio
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: label || 'SoundCloud',
          artist: 'SoundCloud',
          artwork: img ? [{ src: img, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }
  }, []);

  const stopSC = useCallback(() => {
    if (scWidgetRef.current) {
      try { scWidgetRef.current.pause(); } catch {}
    }
    setScEmbed(null);
    setScLabel('');
    setScImg('');
    setScPlaying(false);
    setScTrackTitle('');
    setScArtwork('');
    setVisible(false);
    // Stop keepalive silence audio
    if (silenceAudioRef.current) silenceAudioRef.current.pause();
    // Stop Web Audio keepalive
    try { acKeepaliveRef.current?.close(); } catch {}
    acKeepaliveRef.current = null;
    // Clear Media Session
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.metadata = null; } catch {}
      try { navigator.mediaSession.playbackState = 'none'; } catch {}
    }
  }, []);

  const toggleSC = useCallback(() => {
    const w = scWidgetRef.current;
    if (!w) return;
    if (scPlaying) {
      w.pause();
      setScPlaying(false);
      silenceAudioRef.current?.pause();
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'paused'; } catch {}
      }
    } else {
      w.play();
      setScPlaying(true);
      silenceAudioRef.current?.play().catch(() => {});
      // Resume Web Audio keepalive if the browser suspended the AudioContext
      try {
        if (acKeepaliveRef.current?.state === 'suspended') acKeepaliveRef.current.resume();
      } catch {}
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
    }
  }, [scPlaying]);

  const scNext = useCallback(() => {
    scWidgetRef.current?.next();
  }, []);

  const scPrev = useCallback(() => {
    scWidgetRef.current?.prev();
  }, []);

  // Keep scPlayingRef in sync for use inside stable (no-dep) effects
  useEffect(() => { scPlayingRef.current = scPlaying; }, [scPlaying]);

  // Update Media Session metadata when track title or artwork changes
  useEffect(() => {
    if (!scEmbed || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: scTrackTitle || scLabel || 'SoundCloud',
        artist: 'SoundCloud',
        artwork: scImg ? [{ src: scImg, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    } catch {}
  }, [scEmbed, scTrackTitle, scLabel, scImg]);

  // Wire up lock-screen / notification-area media controls (registered once)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const actions = {
      play: () => {
        if (scWidgetRef.current) {
          scWidgetRef.current.play();
          setScPlaying(true);
          silenceAudioRef.current?.play().catch(() => {});
        }
      },
      pause: () => {
        if (scWidgetRef.current) {
          scWidgetRef.current.pause();
          setScPlaying(false);
          silenceAudioRef.current?.pause();
        }
      },
      nexttrack: () => { scWidgetRef.current?.next(); },
      previoustrack: () => { scWidgetRef.current?.prev(); },
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    });
    return () => {
      ['play', 'pause', 'nexttrack', 'previoustrack'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch {}
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When the tab becomes visible again (screen unlocked / app foregrounded):
  // resume the keepalives and try to restart the SC widget if it was paused.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && scPlayingRef.current) {
        // Resume silence audio loop
        silenceAudioRef.current?.play().catch(() => {});
        // Resume Web Audio oscillator if the browser suspended the AudioContext
        try {
          if (acKeepaliveRef.current?.state === 'suspended') acKeepaliveRef.current.resume();
        } catch {}
        // SC widget may have been paused by the browser — tell it to play again
        try { scWidgetRef.current?.play(); } catch {}
        // Notify OS media controls
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []); // stable: only references refs

  // Page Lifecycle API: 'resume' fires when a frozen page comes back (Chrome 68+).
  // Best-effort recovery to restart playback on Android after longer screen-off periods.
  useEffect(() => {
    const onResume = () => {
      if (!scPlayingRef.current) return;
      silenceAudioRef.current?.play().catch(() => {});
      try {
        if (acKeepaliveRef.current?.state === 'suspended') acKeepaliveRef.current.resume();
      } catch {}
      try { scWidgetRef.current?.play(); } catch {}
    };
    document.addEventListener('resume', onResume);
    return () => document.removeEventListener('resume', onResume);
  }, []); // stable: only references refs

  // Cleanup on unmount – stop silence audio, Web Audio keepalive, and revoke blob URL
  useEffect(() => {
    return () => {
      if (silenceAudioRef.current) silenceAudioRef.current.pause();
      if (silenceUrlRef.current) URL.revokeObjectURL(silenceUrlRef.current);
      try { acKeepaliveRef.current?.close(); } catch {}
    };
  }, []);

  return (
    <RadioContext.Provider value={{
      playing, stationName, streamUrl, visible, play, togglePlay, stop,
      volume, setVolume, audioRef, eqGains, setEqGains, eqEnabled, enableEQ,
      scEmbed, scLabel, scImg, scPlaying, setScPlaying, scTrackTitle, setScTrackTitle,
      scArtwork, setScArtwork,
      playSC, stopSC, toggleSC, scNext, scPrev,
      scIframeRef, scWidgetRef
    }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}
