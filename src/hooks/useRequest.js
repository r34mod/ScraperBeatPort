import { useState, useCallback } from 'react';

/**
 * Wraps async operations with loading/error state management.
 *
 * Usage:
 *   const { loading, error, setError, run } = useRequest();
 *   await run(async () => {
 *     const res = await fetch('/api/...');
 *     if (!res.ok) throw new Error(await res.text());
 *     const data = await res.json();
 *     setMyState(data);
 *   });
 */
export function useRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (asyncFn) => {
    setLoading(true);
    setError('');
    try {
      return await asyncFn();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
