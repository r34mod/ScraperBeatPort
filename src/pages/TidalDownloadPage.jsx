import { useState, useEffect } from 'react';
import './TidalDownloadPage.css';
import { QUALITY_OPTIONS, YT_QUALITY_OPTIONS } from '../utils/downloadUtils';
import SingleDownloader from '../components/SingleDownloader';
import BatchDownloader from '../components/BatchDownloader';
import SubscriptionBanner from '../components/SubscriptionBanner';
import { useSubscription } from '../hooks/useSubscription';

export default function TidalDownloadPage() {
  const [tab, setTab]             = useState('single');
  const [provider, setProvider]   = useState('tidal');
  const [quality, setQuality]     = useState('LOSSLESS');
  const [ytQuality, setYtQuality] = useState('mp3_320');
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('td-recent') || '[]'); } catch { return []; }
  });

  const subscription = useSubscription();

  // After a successful Stripe payment redirect, re-fetch subscription status
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sub') === 'ok') {
      subscription.fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTidal          = provider === 'tidal';
  const currentQuality   = isTidal ? quality : ytQuality;
  const qualityOptions   = isTidal ? QUALITY_OPTIONS : YT_QUALITY_OPTIONS;
  const setCurrentQuality = isTidal ? setQuality : setYtQuality;

  function handleTrackFound(track) {
    setRecentSearches(prev => {
      const entry = { title: track.title, artist: track.artist, cover: track.cover || track.thumbnail };
      const filtered = prev.filter(s => !(s.title === track.title && s.artist === track.artist));
      const updated = [entry, ...filtered].slice(0, 5);
      try { localStorage.setItem('td-recent', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  const qualityContent = (
    <div className="td-quality-section">
      <p className="td-section-label">CALIDAD DE AUDIO</p>
      <div className="td-quality-btns">
        {qualityOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`td-quality-btn${currentQuality === opt.value ? ' active' : ''}`}
            onClick={() => setCurrentQuality(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="td-page">
      <div className="td-layout">

        {/* ── Left (main) ────────────────────────────────────────────────────── */}
        <div className="td-main">
          <div className="td-header">
            <h1 className="td-title">Descargar Música</h1>
            <p className="td-subtitle">
              Capture the pure essence of sound. Sonic Vault bridges the gap between
              streaming and your local library with bit-perfect accuracy.
            </p>
          </div>

          {/* Tabs single / batch */}
          <div className="td-tabs">
            <button
              className={`td-tab${tab === 'single' ? ' active' : ''}`}
              onClick={() => setTab('single')}
            >
              🎵 Canción individual
            </button>
            <button
              className={`td-tab${tab === 'batch' ? ' active' : ''}`}
              onClick={() => setTab('batch')}
            >
              📋 Importar CSV
            </button>
          </div>

          {tab === 'single' && (
            <div className="td-card td-form-card">
              {/* Source selector */}
              <p className="td-section-label">SELECCIONAR ORIGEN</p>
              <div className="td-source-tabs">
                <button
                  className={`td-source-tab${isTidal ? ' active' : ''}`}
                  onClick={() => setProvider('tidal')}
                >
                  <span className="td-src-icon">🎵</span> Tidal
                </button>
                <button
                  className={`td-source-tab${!isTidal ? ' active' : ''}`}
                  onClick={() => setProvider('youtube')}
                >
                  <span className="td-src-icon td-src-icon--yt">▶</span> YouTube
                </button>
              </div>

              <SingleDownloader
                provider={provider}
                quality={currentQuality}
                qualityContent={qualityContent}
                onTrackFound={handleTrackFound}
                trackDownload={subscription.trackDownload}
                onNeedUpgrade={subscription.startCheckout}
                embedded
              />
            </div>
          )}

          {tab === 'batch' && (
            <>
              <div className="td-card td-form-card">
                <p className="td-section-label">SELECCIONAR ORIGEN</p>
                <div className="td-source-tabs">
                  <button
                    className={`td-source-tab${isTidal ? ' active' : ''}`}
                    onClick={() => setProvider('tidal')}
                  >
                    <span className="td-src-icon">🎵</span> Tidal
                  </button>
                  <button
                    className={`td-source-tab${!isTidal ? ' active' : ''}`}
                    onClick={() => setProvider('youtube')}
                  >
                    <span className="td-src-icon td-src-icon--yt">▶</span> YouTube
                  </button>
                </div>
                <div className="td-quality-section">
                  <p className="td-section-label">CALIDAD DE AUDIO</p>
                  <div className="td-quality-btns">
                    {qualityOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`td-quality-btn${currentQuality === opt.value ? ' active' : ''}`}
                        onClick={() => setCurrentQuality(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <BatchDownloader
                provider={provider}
                quality={currentQuality}
                trackDownload={subscription.trackDownload}
                onNeedUpgrade={subscription.startCheckout}
              />
            </>
          )}
        </div>

        {/* ── Right (sidebar) ─────────────────────────────────────────────────── */}
        <aside className="td-sidebar">
          {/* Subscription plan card */}
          <SubscriptionBanner
            subscribed={subscription.subscribed}
            downloadsLeft={subscription.downloadsLeft}
            downloadsToday={subscription.downloadsToday}
            loading={subscription.loading}
            onCheckout={subscription.startCheckout}
          />

          {/* Engine info card */}
          <div className="td-card td-engine-card">
            <div className="td-engine-header">
              <div className="td-engine-icon">⚡</div>
              <h3 className="td-engine-title">High Fidelity Engine</h3>
            </div>
            <p className="td-engine-desc">
              Nuestra tecnología de captura garantiza que no se pierda ni un solo bit del stream
              original. Compatible con FLAC y MQA.
            </p>
            <div className="td-network-row">
              <span className="td-network-label">NETWORK STATUS</span>
              <span className="td-network-connected">● CONNECTED</span>
            </div>
            <div className="td-network-bar">
              <div className="td-network-bar-fill" />
            </div>
          </div>

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="td-recent-card">
              <h4 className="td-recent-title">Últimas Búsquedas</h4>
              {recentSearches.map((s, i) => (
                <div key={i} className="td-recent-row">
                  <div className="td-recent-thumb">
                    {s.cover
                      ? <img src={s.cover} alt="" className="td-recent-img" />
                      : <span className="td-recent-placeholder">🎵</span>
                    }
                  </div>
                  <div className="td-recent-info">
                    <p className="td-recent-track">{s.title}</p>
                    <p className="td-recent-artist">{s.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
