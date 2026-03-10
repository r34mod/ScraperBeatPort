import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDuplicateGuard, DuplicateModal } from '../hooks/useDuplicateGuard';
import './BeatportPage.css';

const genreCategories = {
  house: ['house', 'deep-house', 'tech-house', 'progressive-house', 'afro-house',
    'bass-house', 'funky-house', 'jackin-house', 'melodic-house-techno', 'organic-house'],
  techno: ['techno', 'peak-time-driving-techno', 'raw-deep-hypnotic-techno', 'hard-techno',
    'minimal-deep-tech'],
  trance: ['trance', 'psy-trance', 'trance-raw-deep-hypnotic'],
  bass: ['drum-bass', 'dubstep', 'trap-future-bass', 'bass-club', 'deep-dubstep-grime',
    'hard-dance-hardcore'],
  breakbeat: ['uk-garage-bassline', 'breaks-breakbeat-uk-bass'],
  downtempo: ['ambient-experimental', 'downtempo', 'electronica'],
  dance: ['indie-dance', 'nu-disco-disco', 'electro', 'mainstage', 'dance-pop', 'dj-tools'],
  global: ['amapiano', 'brazilian-funk', 'african', 'caribbean', 'hip-hop', 'latin', 'pop', 'rnb'],
};

const categoryAbbr = { house: 'H', techno: 'T', trance: 'TR', bass: 'B', breakbeat: 'BR', downtempo: 'A', dance: 'D', global: 'G' };

function getGenreCategory(genreId) {
  for (const [cat, ids] of Object.entries(genreCategories)) {
    if (ids.includes(genreId)) return cat;
  }
  return 'otros';
}

export default function BeatportPage() {
  const { token } = useAuth();
  const { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate } = useDuplicateGuard();
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch('/api/genres')
      .then(r => r.json())
      .then(d => setGenres(d.genres || []))
      .catch(e => setError('Error cargando géneros: ' + e.message));
  }, []);

  const filtered = genres.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.id.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'all' || genreCategories[category]?.includes(g.id);
    return matchSearch && matchCat;
  });

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(g => next.add(g.id));
      return next;
    });
  };

  const deselectAll = () => setSelected(new Set());

  const startScraping = async () => {
    if (selected.size === 0) { setError('Selecciona al menos un género'); return; }
    setLoading(true); setError(''); setSuccess(''); setResults([]);
    const arr = Array.from(selected);
    try {
      if (arr.length === 1) {
        const res = await fetch(`/api/scrape?genre=${arr[0]}`);
        const data = await res.json();
        if (data.success) {
          setSuccess(`✅ Extraídos ${data.tracksCount} tracks de ${data.genre}`);
          setResults([data]);
          saveTracks({ tracks: data.tracks, platform: 'beatport', genre: data.genre, token });
        } else {
          setError(data.error || 'Error desconocido');
        }
      } else {
        const res = await fetch('/api/scrape-multiple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genres: arr }),
        });
        const data = await res.json();
        const ok = data.results.filter(r => r.success);
        const fail = data.results.filter(r => r.error);
        if (ok.length) {
          setSuccess(`✅ Completado: ${ok.length} géneros extraídos`);
          setResults(ok);
          ok.forEach(r => saveTracks({ tracks: r.tracks, platform: 'beatport', genre: r.genre, token }));
        }
        if (fail.length) setError(`❌ Errores: ${fail.map(r => `${r.genre}: ${r.error}`).join(', ')}`);
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...Object.keys(genreCategories)];

  return (
    <div className="container bp-page">
      <h1 className="bp-title">Beatport Top 100 Scraper</h1>
      <p className="bp-subtitle">Selecciona géneros y extrae las listas Top 100</p>

      {/* Search & Filters */}
      <div className="bp-controls">
        <input className="bp-search" placeholder="🔍 Buscar género..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="bp-categories">
          {categories.map(c => (
            <button key={c} className={`filter-btn${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
              {c === 'all' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Selection controls */}
      <div className="bp-selection-bar">
        <span className="bp-selection-info">Seleccionados: {selected.size} de {genres.length}</span>
        <button className="bp-btn-sm" onClick={selectVisible}>Seleccionar visibles</button>
        <button className="bp-btn-sm" onClick={deselectAll}>Limpiar</button>
      </div>

      {/* Genre Grid */}
      <div className="bp-genre-grid">
        {filtered.map(g => {
          const cat = getGenreCategory(g.id);
          return (
            <div key={g.id} className={`genre-card${selected.has(g.id) ? ' selected' : ''}`} onClick={() => toggle(g.id)}>
              <div className="genre-category">{categoryAbbr[cat] || 'O'}</div>
              <h3>{g.name}</h3>
              <p>Top 100 tracks</p>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="bp-actions">
        <button className="bp-btn-primary" disabled={selected.size === 0 || loading} onClick={startScraping}>
          {loading ? <><span className="spinner-inline" /> Scraping...</> : `🚀 Extraer Top100 (${selected.size})`}
        </button>
      </div>

      {/* Messages */}
      {error && <div className="bp-msg error">{error}</div>}
      {success && <div className="bp-msg success">{success}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="bp-results">
          {results.map((r, i) => (
            <div key={i} className="bp-result-card">
              <h4>📈 {r.genre?.replace('-', ' ').toUpperCase()} — {r.tracksCount} tracks</h4>
              {r.downloadUrl && <a href={r.downloadUrl} className="bp-btn-sm" download>💾 Descargar {r.fileName}</a>}
              {r.tracks?.length > 0 && (
                <table className="bp-table">
                  <thead><tr><th>#</th><th>Título</th><th>Artista</th><th>Sello</th><th>BPM</th></tr></thead>
                  <tbody>
                    {r.tracks.slice(0, 10).map((t, j) => (
                      <tr key={j}><td>{t.position}</td><td>{t.title}</td><td>{t.artist}</td><td>{t.label}</td><td>{t.bpm}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Duplicate detection modal */}
      <DuplicateModal info={duplicateInfo} onReplace={confirmReplace} onSkip={dismissDuplicate} />
    </div>
  );
}
