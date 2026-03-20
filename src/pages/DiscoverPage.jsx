import { useState, useMemo } from 'react';
import { UPCOMING_SHOWS } from '../data/upcomingShows';
import { useRadio } from '../context/RadioContext';
import './DiscoverPage.css';

/* ── Build genre list from data ──────────────────────────────── */
const ALL = 'All Genres';
const genres = [ALL, ...new Set(UPCOMING_SHOWS.map(s => s.genre))];

export default function DiscoverPage() {
  const [activeGenre, setActiveGenre] = useState(ALL);
  const radio = useRadio();

  const filtered = useMemo(
    () => activeGenre === ALL ? UPCOMING_SHOWS : UPCOMING_SHOWS.filter(s => s.genre === activeGenre),
    [activeGenre],
  );

  const handlePlay = (show) => {
    const embedUrl = show.embed || show.url;
    radio.playSC(embedUrl, show.embedLabel || `${show.show} · ${show.dj}`, show.img);
  };

  const isPlaying = (show) => {
    const embedUrl = show.embed || show.url;
    return radio.scEmbed === embedUrl;
  };

  return (
    <div className="discover-page">
      <header className="discover-header">
        <h1 className="discover-title">Discover New Soundscapes</h1>
      </header>

      {/* ── Genre filter pills ─────────────────────────────────── */}
      <div className="discover-filters">
        <div className="discover-filters-scroll">
          {genres.map(g => (
            <button
              key={g}
              className={`discover-pill${activeGenre === g ? ' active' : ''}`}
              onClick={() => setActiveGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Card grid ──────────────────────────────────────────── */}
      <div className="discover-grid">
        {filtered.map(show => {
          const active = isPlaying(show);
          return (
            <button
              key={show.id}
              className={`discover-card${active ? ' playing' : ''}`}
              style={{ '--card-accent': show.accent || '#ff1744' }}
              onClick={() => handlePlay(show)}
            >
              {/* Background image */}
              <div
                className="discover-card-img"
                style={{ backgroundImage: `url(${show.img})` }}
              />
              <div className="discover-card-overlay" />

              {/* Badges */}
              <div className="discover-card-badges">
                {show.live && <span className="discover-badge live">LIVE</span>}
                <span className="discover-badge sc">SC</span>
              </div>

              {/* Playing indicator */}
              {active && (
                <div className="discover-card-playing">
                  <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                </div>
              )}

              {/* Text */}
              <div className="discover-card-info">
                <span className="discover-card-genre">{show.genre}</span>
                <span className="discover-card-dj">{show.dj}</span>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="discover-empty">No hay soundscapes para este género aún.</p>
      )}
    </div>
  );
}
