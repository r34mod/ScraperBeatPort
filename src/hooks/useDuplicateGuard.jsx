import { useState, useCallback } from 'react';
import { autoSaveTracks } from '../utils/autoSave';

/**
 * Hook that wraps autoSaveTracks with duplicate detection and user confirmation.
 * Returns { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate, DuplicateModal }
 */
export function useDuplicateGuard() {
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [pendingSave, setPendingSave] = useState(null);

  const saveTracks = useCallback(async (params) => {
    const result = await autoSaveTracks(params);

    if (result?.duplicate) {
      setDuplicateInfo({
        platform: params.platform,
        genre: params.genre,
        sessions: result.existing_sessions,
      });
      setPendingSave(params);
      return result;
    }

    return result;
  }, []);

  const confirmReplace = useCallback(async () => {
    if (!pendingSave) return null;
    const result = await autoSaveTracks({ ...pendingSave, replaceExisting: true });
    setDuplicateInfo(null);
    setPendingSave(null);
    return result;
  }, [pendingSave]);

  const dismissDuplicate = useCallback(() => {
    setDuplicateInfo(null);
    setPendingSave(null);
  }, []);

  return { saveTracks, duplicateInfo, confirmReplace, dismissDuplicate };
}

/** Inline modal component for duplicate warnings */
export function DuplicateModal({ info, onReplace, onSkip }) {
  if (!info) return null;

  const latestDate = info.sessions?.[0]?.scraped_at
    ? new Date(info.sessions[0].scraped_at).toLocaleString()
    : 'desconocida';

  return (
    <div style={styles.overlay} onClick={onSkip}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>⚠️ Datos duplicados</h3>
        <p style={styles.text}>
          Ya existen <strong>{info.sessions.length}</strong> sesión(es) guardadas para{' '}
          <strong>{info.platform}</strong> / <strong>{info.genre}</strong>.
        </p>
        <p style={styles.subtext}>
          Última: {latestDate} — {info.sessions[0]?.tracks_count} tracks
        </p>
        <div style={styles.actions}>
          <button style={styles.replaceBtn} onClick={onReplace}>
            🔄 Reemplazar datos anteriores
          </button>
          <button style={styles.keepBtn} onClick={onSkip}>
            Mantener ambos (no guardar)
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
  },
  modal: {
    background: 'linear-gradient(135deg, #222, #1a1a1a)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)', padding: '28px 32px',
    maxWidth: 440, width: '90vw', textAlign: 'center',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#ffaa00', marginBottom: 12 },
  text: { fontSize: 14, color: '#ddd', lineHeight: 1.5, marginBottom: 8 },
  subtext: { fontSize: 12, color: '#999', marginBottom: 20 },
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  replaceBtn: {
    background: 'linear-gradient(135deg, #ff4444, #cc0000)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '12px 20px',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  keepBtn: {
    background: 'transparent', color: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
    padding: '10px 20px', fontSize: 13, cursor: 'pointer',
  },
};
