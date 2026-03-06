import { useState, useMemo } from 'react';
import { useRadio } from '../context/RadioContext';
import { STATIONS } from '../data/stations';
import './RadioPage.css';

export default function RadioPage() {
  const { play, streamUrl, playing } = useRadio();
  const [filter, setFilter] = useState('');

  const genres = useMemo(() => {
    const set = new Set();
    STATIONS.forEach(s => s.genre.split(',').forEach(g => set.add(g.trim())));
    return ['Todas', ...Array.from(set).sort()];
  }, []);

  const [selectedGenre, setSelectedGenre] = useState('Todas');

  const filtered = useMemo(() => {
    return STATIONS.filter(s => {
      const matchGenre = selectedGenre === 'Todas' || s.genre.includes(selectedGenre);
      const matchFilter = !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.genre.toLowerCase().includes(filter.toLowerCase());
      return matchGenre && matchFilter;
    });
  }, [selectedGenre, filter]);

  const getInitials = (name) => {
    const parts = name.split(' ');
    return parts[0][0] + (parts[1] ? parts[1][0] : '');
  };

  return (
    <div className="radio-page">
      <h1 className="radio-title">Emisoras de Radio</h1>

      <div className="radio-filters">
        <input
          type="text"
          placeholder="Buscar emisora..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="radio-search"
        />
        <div className="radio-genre-tags">
          {genres.map(g => (
            <button
              key={g}
              className={`radio-genre-tag ${selectedGenre === g ? 'active' : ''}`}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="radio-grid">
        {filtered.map((station, i) => {
          const isPlaying = playing && streamUrl === station.url;
          return (
            <div key={i} className={`radio-card ${isPlaying ? 'playing' : ''}`}>
              <div className="radio-logo">{getInitials(station.name)}</div>
              <div className="radio-name">{station.name}</div>
              <div className="radio-description">{station.genre}</div>
              <div className="radio-country">{station.country}</div>
              <button
                className={`radio-listen-btn ${isPlaying ? 'active' : ''}`}
                onClick={() => play(station.url, station.name)}
              >
                {isPlaying ? '⏸ Reproduciendo' : '▶ Escuchar'}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="radio-empty">No se encontraron emisoras</div>
        )}
      </div>
    </div>
  );
}
