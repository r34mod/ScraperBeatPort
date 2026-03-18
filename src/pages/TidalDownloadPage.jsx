import { useState } from 'react';
import './TidalDownloadPage.css';
import { QUALITY_OPTIONS, YT_QUALITY_OPTIONS } from '../utils/downloadUtils';
import SingleDownloader from '../components/SingleDownloader';
import BatchDownloader from '../components/BatchDownloader';

export default function TidalDownloadPage() {
  const [tab, setTab] = useState('single'); // 'single' | 'batch'
  const [provider, setProvider] = useState('tidal'); // 'tidal' | 'youtube'
  const [quality, setQuality]   = useState('LOSSLESS');
  const [ytQuality, setYtQuality]     = useState('mp3_320');

  const selectedQualityInfo   = QUALITY_OPTIONS.find(q => q.value === quality)?.info ?? '';
  const selectedYtQualityInfo = YT_QUALITY_OPTIONS.find(q => q.value === ytQuality)?.info ?? '';

  return (
    <div className="td-page">
      {/* Header */}
      <div className="td-header">
        <div className="td-logo">🌊</div>
        <h1 className="td-title">Tidal Downloader</h1>
        <p className="td-subtitle">Descarga canciones de Tidal en alta calidad</p>
      </div>

      {/* Provider selector */}
      <div className="td-source-tabs">
        <button
          className={`td-source-tab${provider === 'tidal' ? ' active' : ''}`}
          onClick={() => setProvider('tidal')}
        >
          🌊 Tidal
        </button>
        <button
          className={`td-source-tab${provider === 'youtube' ? ' active' : ''}`}
          onClick={() => setProvider('youtube')}
        >
          🎬 YouTube
        </button>
      </div>

      {/* Quality selector (adapts to provider) */}
      <div className="td-card td-quality-card">
        <div className="td-quality-row">
          <span className="td-quality-label">Calidad:</span>
          {provider === 'tidal' ? (
            QUALITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`td-quality-btn${quality === opt.value ? ' active' : ''}`}
                onClick={() => setQuality(opt.value)}
              >
                {opt.label}
              </button>
            ))
          ) : (
            YT_QUALITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`td-quality-btn${ytQuality === opt.value ? ' active' : ''}`}
                onClick={() => setYtQuality(opt.value)}
              >
                {opt.label}
              </button>
            ))
          )}
          <span className="td-quality-info td-quality-info--inline">
            {provider === 'tidal' ? selectedQualityInfo : selectedYtQualityInfo}
          </span>
        </div>
      </div>

      {/* Tabs */}
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
        <SingleDownloader 
          provider={provider} 
          quality={provider === 'tidal' ? quality : ytQuality} 
          selectedQualityInfo={provider === 'tidal' ? selectedQualityInfo : selectedYtQualityInfo} 
        />
      )}
      {tab === 'batch' && (
        <BatchDownloader 
          provider={provider} 
          quality={provider === 'tidal' ? quality : ytQuality} 
        />
      )}
    </div>
  );
}
