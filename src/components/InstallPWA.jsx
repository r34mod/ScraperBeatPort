import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export default function InstallPWA() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed || !canInstall) return null;

  const handleInstall = async () => {
    await install();
  };

  // Detect iOS (no beforeinstallprompt support)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <div style={styles.icon}>📱</div>
        <div style={styles.text}>
          <strong style={styles.title}>Instalar Music Scraper Hub</strong>
          <span style={styles.subtitle}>
            {isIOS
              ? 'Toca el botón de compartir y "Añadir a pantalla de inicio"'
              : 'Instálala como app en tu dispositivo'}
          </span>
        </div>
      </div>
      <div style={styles.actions}>
        {!isIOS && (
          <button onClick={handleInstall} style={styles.installBtn}>
            Instalar
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={styles.dismissBtn}>
          ✕
        </button>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(135deg, rgba(30,30,30,0.98), rgba(20,20,20,0.98))',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10000,
    gap: '12px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    minWidth: 0,
  },
  icon: {
    fontSize: '28px',
    flexShrink: 0,
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  subtitle: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  installBtn: {
    background: 'linear-gradient(135deg, #ff4444, #cc0000)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  dismissBtn: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
};
