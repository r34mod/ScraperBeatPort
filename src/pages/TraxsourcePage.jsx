import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuplicateGuard, DuplicateModal } from '../hooks/useDuplicateGuard';
import { useRequest } from '../hooks/useRequest';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import './TraxsourcePage.css';

const PAGE_SIZE = 25;

export default function TraxsourcePage() {
  const { token } = useAuth();
  const { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate } = useDuplicateGuard();
  const { loading, error, setError, run } = useRequest();
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetch('/api/traxsource/genres')
      .then(r => r.json())
      .then(d => setGenres(d))
      .catch(e => setError('Error cargando géneros: ' + e.message));
  }, [setError]);

  const filtered = genres.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) || g.id.toLowerCase().includes(search.toLowerCase())
  );

  const scrape = async () => {
    if (!selected || loading) return;
    setResults(null);
    await run(async () => {
      const res = await fetch('/api/traxsource/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: selected }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error en el scraping');
      setResults(data);
      saveTracks({ tracks: data.tracks, platform: 'traxsource', genre: selected, token });
    });
  };

  const resultTracks = useMemo(() => results?.tracks || [], [results]);
  const { pagedItems: pagedResultTracks, page: resultsPage, totalPages: resultsTotalPages, goPage: goResultsPage } = usePagination(resultTracks, PAGE_SIZE, [results]);

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
              <Pagination page={resultsPage} totalPages={resultsTotalPages} onPageChange={goResultsPage} classPrefix="tx" />
            </>
          )}
        </div>
      )}
      {/* Duplicate detection modal */}
      <DuplicateModal info={duplicateInfo} onReplace={confirmReplace} onSkip={dismissDuplicate} />
    </div>
  );
}
