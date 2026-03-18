import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Generic pagination hook.
 *
 * @param {Array}  items     - Full array to paginate.
 * @param {number} pageSize  - Items per page.
 * @param {Array}  resetDeps - Reset to page 1 whenever any of these values change (e.g. a search string).
 *
 * Returns:
 *   page        - Current page number (1-based, clamped to totalPages).
 *   totalPages  - Total number of pages.
 *   pagedItems  - Sliced array for the current page.
 *   goPage      - (n: number) => void — navigate to a specific page.
 */
export function usePagination(items, pageSize, resetDeps = []) {
  const [page, setPage] = useState(1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, resetDeps);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const goPage = useCallback(
    (p) => setPage(Math.max(1, Math.min(p, totalPages))),
    [totalPages],
  );

  const pagedItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  );

  return { page: currentPage, totalPages, pagedItems, goPage };
}
