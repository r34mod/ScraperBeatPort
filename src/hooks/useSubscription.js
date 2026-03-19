import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT = { subscribed: false, downloadsToday: 0, downloadsLeft: 5, loading: true, error: null };

export function useSubscription() {
  const { getValidToken, isLoggedIn } = useAuth();
  const [status, setStatus] = useState(DEFAULT);
  const fetchingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!isLoggedIn || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error fetching subscription');
      const data = await res.json();
      setStatus({ ...data, loading: false, error: null });
    } catch (err) {
      setStatus(prev => ({ ...prev, loading: false, error: err.message }));
    } finally {
      fetchingRef.current = false;
    }
  }, [isLoggedIn, getValidToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /**
   * Llama al backend para verificar si el usuario puede descargar e incrementa
   * el contador. Devuelve { allowed: bool }.
   * Mutar estado local inmediatamente para UX rápida.
   */
  const trackDownload = useCallback(async () => {
    // Subscribed users → always allowed
    if (status.subscribed) return { allowed: true };

    // Optimistic local check
    if (status.downloadsLeft !== null && status.downloadsLeft <= 0) {
      return { allowed: false };
    }

    try {
      const token = await getValidToken();
      if (!token) return { allowed: false };
      const res = await fetch('/api/subscription/track-download', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.allowed) {
        setStatus(prev => ({ ...prev, downloadsLeft: 0 }));
        return { allowed: false };
      }
      // Update local counts
      if (!data.subscribed) {
        setStatus(prev => ({
          ...prev,
          downloadsToday: prev.downloadsToday + 1,
          downloadsLeft: data.downloadsLeft ?? Math.max(0, (prev.downloadsLeft ?? 5) - 1),
        }));
      }
      return { allowed: true };
    } catch {
      // On network error, allow the download (fail open)
      return { allowed: true };
    }
  }, [status.subscribed, status.downloadsLeft, getValidToken]);

  /**
   * Abre Stripe Checkout. Redirige al usuario a la página de pago.
   */
  const startCheckout = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (!token) throw new Error('No autenticado');
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error iniciando pago');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }, [getValidToken]);

  return { ...status, fetchStatus, trackDownload, startCheckout };
}
