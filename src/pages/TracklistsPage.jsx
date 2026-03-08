import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuplicateGuard, DuplicateModal } from '../hooks/useDuplicateGuard';
import './TracklistsPage.css';

const searchTypes = [
  { id: 'dj', label: 'DJ / Artista', placeholder: 'Buscar DJ o artista (ej: Martin Garrix, Tiesto)' },
  { id: 'event', label: 'Evento / Festival', placeholder: 'Buscar evento o festival (ej: Tomorrowland, Ultra)' },
  { id: 'popular', label: 'Popular', placeholder: 'Déjalo vacío para los más populares' },
];

export default function TracklistsPage() {
  const { token } = useAuth();
  const { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate } = useDuplicateGuard();
  const [searchType, setSearchType] = useState('dj');
  const [query, setQuery] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const current = searchTypes.find(t => t.id === searchType);

  const scrape = async () => {
    if (loading) return;
    if (searchType !== 'popular' && !query.trim()) { setError('Introduce una búsqueda'); return; }
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await fetch('/api/1001tracklists/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchType, query: query.trim(), event: eventQuery.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
        if (data.tracklists?.length) {
          const tracks = data.tracklists.map((tl, i) => ({
            position: i + 1, title: tl.title, artist: tl.artist,
            label: tl.event || '', duration: tl.duration || '',
          }));
          saveTracks({ tracks, platform: '1001tracklists', genre: query.trim() || 'popular', token });
        }
      }
      else throw new Error(data.error || 'Error en el scraping');
    } catch (e) {
      setError(e.message + '\n\nNota: 1001Tracklists está actualmente en desarrollo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container tl-page">
      <h1 className="tl-title">1001Tracklists</h1>
      <p className="tl-subtitle">Descubre los setlists de los mejores DJs</p>

      {/* Search Type */}
      <div className="tl-type-btns">
        {searchTypes.map(t => (
          <button key={t.id} className={`tl-type-btn${searchType === t.id ? ' active' : ''}`}
            onClick={() => setSearchType(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <input className="tl-search" placeholder={current.placeholder}
        value={query} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && scrape()} />

      {searchType === 'dj' && (
        <input className="tl-search" placeholder="Evento opcional (ej: Tomorrowland)"
          value={eventQuery} onChange={e => setEventQuery(e.target.value)} style={{ marginTop: 12 }} />
      )}

      <div className="tl-actions">
        <button className="tl-btn-primary" disabled={loading} onClick={scrape}>
          {loading ? <><span className="spinner-inline" /> Extrayendo...</> : '🎵 Extraer Tracklists'}
        </button>
      </div>

      {error && <div className="tl-msg error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

      {results && (
        <div className="tl-results">
          <div className="tl-msg success">✅ {results.tracklistsCount || 0} tracklists encontradas</div>
          {results.filename && (
            <a href={`/api/1001tracklists/download/${results.filename}`} className="tl-btn-sm" download>
              💾 Descargar {results.filename}
            </a>
          )}
          {results.tracklists?.length > 0 && (
            <table className="tl-table">
              <thead>
                <tr><th>#</th><th>Título del Set</th><th>DJ / Artista</th><th>Evento</th><th>Fecha</th><th>Duración</th><th>Tracks</th></tr>
              </thead>
              <tbody>
                {results.tracklists.map((tl, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td><td className="tl-track-title">{tl.title}</td><td>{tl.artist}</td>
                    <td>{tl.event}</td><td>{tl.date}</td><td>{tl.duration}</td><td>{tl.trackCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* Duplicate detection modal */}
      <DuplicateModal info={duplicateInfo} onReplace={confirmReplace} onSkip={dismissDuplicate} />
    </div>
  );
}
