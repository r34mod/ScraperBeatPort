import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { autoSaveTracks } from '../utils/autoSave';
import './TraxsourcePage.css';

export default function TraxsourcePage() {
  const { token } = useAuth();
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch('/api/traxsource/genres')
      .then(r => r.json())
      .then(d => setGenres(d))
      .catch(e => setError('Error cargando géneros: ' + e.message));
  }, []);

  const filtered = genres.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) || g.id.toLowerCase().includes(search.toLowerCase())
  );

  const scrape = async () => {
    if (!selected || loading) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await fetch('/api/traxsource/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: selected }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
        autoSaveTracks({ tracks: data.tracks, platform: 'traxsource', genre: selected, token });
      }
      else throw new Error(data.error || 'Error en el scraping');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container tx-page">
      <h1 className="tx-title">Traxsource Scraper</h1>
      <p className="tx-subtitle">House Music Paradise — Selecciona un género</p>

      <input className="tx-search" placeholder="🔍 Buscar género..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="tx-genre-grid">
        {filtered.map(g => (
          <div key={g.id} className={`tx-genre-card${selected === g.id ? ' selected' : ''}`} onClick={() => setSelected(g.id)}>
            <div className="tx-genre-name">{g.name}</div>
          </div>
        ))}
      </div>

      <div className="tx-actions">
        <button className="tx-btn-primary" disabled={!selected || loading} onClick={scrape}>
          {loading ? <><span className="spinner-inline" /> Extrayendo...</> : 'Extraer Top 100 Tracks'}
        </button>
      </div>

      {error && <div className="tx-msg error">{error}</div>}

      {results && (
        <div className="tx-results">
          <div className="tx-msg success">✅ {results.tracksCount} tracks encontrados de {results.genre}</div>
          {results.filename && (
            <a href={`/api/traxsource/download/${selected}/${results.filename}`} className="tx-btn-sm" download>
              💾 Descargar {results.filename}
            </a>
          )}
          {results.tracks?.length > 0 && (
            <table className="tx-table">
              <thead>
                <tr><th>#</th><th>Título</th><th>Artista</th><th>Label</th><th>Duración</th><th>BPM</th><th>Key</th></tr>
              </thead>
              <tbody>
                {results.tracks.map((t, i) => (
                  <tr key={i}>
                    <td>{t.position}</td><td className="tx-track-title">{t.title}</td><td>{t.artist}</td>
                    <td>{t.label}</td><td>{t.duration}</td><td>{t.bpm}</td><td>{t.key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
