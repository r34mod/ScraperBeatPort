import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const RadioContext = createContext(null);

export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [stationName, setStationName] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [visible, setVisible] = useState(false);

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
      audioRef.current.loop = true;
    }
  }, []);

  const play = useCallback((url, name) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    audio.play();
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
    if (audio.paused) {
      audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
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

  return (
    <RadioContext.Provider value={{ playing, stationName, streamUrl, visible, play, togglePlay, stop }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used within RadioProvider');
  return ctx;
}
