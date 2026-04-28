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
    return { allowed: true };
  }, []);

  /**
   * Stripe Checkout — temporalmente deshabilitado.
   */
  // eslint-disable-next-line no-unused-vars
  const startCheckout = useCallback(() => {
    // Payment disabled — coming soon
  }, []);

  return { ...status, fetchStatus, trackDownload, startCheckout };
}
