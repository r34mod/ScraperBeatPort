/**
 * Reusable pagination bar.
 *
 * Props:
 *   page          - Current page (1-based).
 *   totalPages    - Total number of pages.
 *   onPageChange  - Callback (newPage: number) => void.
 *   classPrefix   - CSS class prefix (default 'pag'). Generates:
 *                    {prefix}-pagination, {prefix}-page-btn, {prefix}-page-info
 */
export default function Pagination({ page, totalPages, onPageChange, classPrefix = 'pag' }) {
  if (totalPages <= 1) return null;
  const p = classPrefix;
  return (
    <div className={`${p}-pagination`}>
      <button className={`${p}-page-btn`} onClick={() => onPageChange(1)} disabled={page === 1}>«</button>
      <button className={`${p}-page-btn`} onClick={() => onPageChange(page - 1)} disabled={page === 1}>‹</button>
      <span className={`${p}-page-info`}>Página {page} de {totalPages}</span>
      <button className={`${p}-page-btn`} onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>›</button>
      <button className={`${p}-page-btn`} onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>»</button>
    </div>
  );
}
