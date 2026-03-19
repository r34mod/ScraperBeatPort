import './SubscriptionBanner.css';

const FREE_LIMIT = 5;

export default function SubscriptionBanner({ subscribed, downloadsLeft, downloadsToday, loading, onCheckout }) {
  if (loading) return null;

  if (subscribed) {
    return (
      <div className="sub-card sub-card--pro">
        <div className="sub-card-header">
          <span className="sub-icon">⚡</span>
          <div>
            <p className="sub-plan-label">Tu plan</p>
            <h4 className="sub-plan-name">Pro · Ilimitado</h4>
          </div>
          <span className="sub-badge sub-badge--pro">ACTIVO</span>
        </div>
        <p className="sub-desc">Descargas ilimitadas desde Tidal y YouTube en alta calidad.</p>
      </div>
    );
  }

  const pct = ((FREE_LIMIT - (downloadsLeft ?? 0)) / FREE_LIMIT) * 100;
  const isExhausted = downloadsLeft !== null && downloadsLeft <= 0;

  return (
    <div className={`sub-card${isExhausted ? ' sub-card--exhausted' : ''}`}>
      <div className="sub-card-header">
        <span className="sub-icon">🎵</span>
        <div>
          <p className="sub-plan-label">Tu plan</p>
          <h4 className="sub-plan-name">Gratuito</h4>
        </div>
        <span className="sub-badge sub-badge--free">FREE</span>
      </div>

      <div className="sub-progress-row">
        <span className="sub-progress-label">Descargas hoy</span>
        <span className={`sub-progress-count${isExhausted ? ' sub-progress-count--empty' : ''}`}>
          {downloadsToday ?? 0} / {FREE_LIMIT}
        </span>
      </div>
      <div className="sub-bar-wrap">
        <div
          className={`sub-bar-fill${isExhausted ? ' sub-bar-fill--full' : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      {isExhausted && (
        <p className="sub-limit-msg">Has alcanzado el límite diario.</p>
      )}

      <div className="sub-upgrade-box">
        <p className="sub-upgrade-tagline">Get unlimited hi-res downloads</p>
        <button className="sub-btn-upgrade" onClick={onCheckout}>
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
