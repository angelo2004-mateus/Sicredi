import { Icon } from "./Icon.jsx";
import { statusLabels } from "../utils/format.js";

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${status}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export function MetricCards({ items, className = "" }) {
  return (
    <div className={`metrics ${className}`}>
      {items.map((item) => (
        <section className="panel" key={item.label}>
          <span className="metric-label">
            {item.icon && <Icon name={item.icon} />}
            {item.label}
          </span>
          <strong className="metric-value">{item.value}</strong>
          {item.description && <p>{item.description}</p>}
        </section>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="pagination">
      <span>
        Mostrando {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="pagination-controls">
        {onPageSizeChange && (
          <>
            <span>Por página</span>
            <select
              aria-label="Registros por página"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          className="secondary"
          aria-label="Página anterior"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevron-left" />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          type="button"
          className="secondary"
          aria-label="Próxima página"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}
