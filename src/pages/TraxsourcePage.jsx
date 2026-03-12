import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuplicateGuard, DuplicateModal } from '../hooks/useDuplicateGuard';
import './TraxsourcePage.css';

const PAGE_SIZE = 25;

export default function TraxsourcePage() {
  const { token } = useAuth();
  const { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate } = useDuplicateGuard();
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [resultsPage, setResultsPage] = useState(1);

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
        setResultsPage(1);
        saveTracks({ tracks: data.tracks, platform: 'traxsource', genre: selected, token });
      }
      else throw new Error(data.error || 'Error en el scraping');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pagedResultTracks = useMemo(() => {
    if (!results?.tracks) return [];
    return results.tracks.slice((resultsPage - 1) * PAGE_SIZE, resultsPage * PAGE_SIZE);
  }, [results, resultsPage]);
  const resultsTotalPages = Math.max(1, Math.ceil((results?.tracks?.length || 0) / PAGE_SIZE));

  return (
    <div className="container tx-page">
      <div className="tx-header">
        <div className="tx-badge">Traxsource</div>
        <h1 className="tx-title">House Music Scraper</h1>
        <p className="tx-subtitle">Selecciona un género y extrae el Top 100</p>
      </div>

      <div className="tx-search-wrap">
        <input className="tx-search" placeholder="Buscar género..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

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
        <div className="tx-results">  {/* panel */}
          <div className="tx-msg success">✅ {results.tracksCount} tracks encontrados de {results.genre}</div>
          {results.filename && (
            <a href={`/api/traxsource/download/${selected}/${results.filename}`} className="tx-btn-sm" download>
              💾 Descargar {results.filename}
            </a>
          )}
          {results.tracks?.length > 0 && (
            <>
              <table className="tx-table">
                <thead>
                  <tr><th>#</th><th>Título</th><th>Artista</th><th>Label</th><th>Duración</th><th>BPM</th><th>Key</th></tr>
                </thead>
                <tbody>
                  {pagedResultTracks.map((t, i) => (
                    <tr key={i}>
                      <td>{t.position}</td><td className="tx-track-title">{t.title}</td><td>{t.artist}</td>
                      <td>{t.label}</td><td>{t.duration}</td><td>{t.bpm}</td><td>{t.key}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultsTotalPages > 1 && (
                <div className="tx-pagination">
                  <button className="tx-page-btn" onClick={() => setResultsPage(1)} disabled={resultsPage === 1}>«</button>
                  <button className="tx-page-btn" onClick={() => setResultsPage(p => Math.max(1, p - 1))} disabled={resultsPage === 1}>‹</button>
                  <span className="tx-page-info">Página {resultsPage} de {resultsTotalPages}</span>
                  <button className="tx-page-btn" onClick={() => setResultsPage(p => Math.min(resultsTotalPages, p + 1))} disabled={resultsPage === resultsTotalPages}>›</button>
                  <button className="tx-page-btn" onClick={() => setResultsPage(resultsTotalPages)} disabled={resultsPage === resultsTotalPages}>»</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* Duplicate detection modal */}
      <DuplicateModal info={duplicateInfo} onReplace={confirmReplace} onSkip={dismissDuplicate} />
    </div>
  );
}
