import { useState, useEffect } from 'react';

/**
 * Returns a debounced value that only updates after `delay` ms of inactivity.
 * Prevents expensive recalculations on every keystroke.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
