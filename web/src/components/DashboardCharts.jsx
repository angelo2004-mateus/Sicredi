import { EmptyState } from "./Feedback.jsx";

export function ChartCard({ title, description, children }) {
  return (
    <section className="panel chart-card">
      <div className="chart-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="chart-wrap">{children}</div>
    </section>
  );
}

export function PeriodChart({ rows }) {
  if (!rows.length) return <EmptyState />;

  const width = 640;
  const height = 240;
  const left = 46;
  const bottom = 210;
  const max = Math.max(...rows.map((row) => Number(row.total_weight_kg)), 1);
  const points = rows.map((row, index) => ({
    x:
      rows.length === 1
        ? width / 2
        : left + (index * (width - left - 20)) / (rows.length - 1),
    y: bottom - (Number(row.total_weight_kg) / max) * (bottom - 16),
    row,
  }));
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Evolução do peso registrado em quilogramas"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <g key={ratio}>
          <line
            className="chart-grid-line"
            x1={left}
            x2={width - 20}
            y1={bottom - ratio * (bottom - 16)}
            y2={bottom - ratio * (bottom - 16)}
          />
          <text
            className="chart-label"
            x={left - 8}
            y={bottom - ratio * (bottom - 16) + 4}
            textAnchor="end"
          >
            {new Intl.NumberFormat("pt-BR", {
              maximumFractionDigits: 1,
            }).format(max * ratio)}
          </text>
        </g>
      ))}
      <polygon
        points={`${points[0].x},${bottom} ${path} ${points.at(-1).x},${bottom}`}
        fill="var(--primary)"
        opacity=".1"
      />
      <polyline
        points={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      {points.map((point, index) => (
        <g key={point.row.period}>
          <circle cx={point.x} cy={point.y} r="4" fill="var(--primary)">
            <title>
              {new Date(point.row.period).toLocaleDateString("pt-BR", {
                timeZone: "UTC",
              })}
              : {point.row.total_weight_kg} kg
            </title>
          </circle>
          {(index === 0 ||
            index === points.length - 1 ||
            index % Math.max(1, Math.ceil(points.length / 5)) === 0) && (
            <text
              className="chart-label"
              x={point.x}
              y={233}
              textAnchor="middle"
            >
              {new Date(point.row.period).toLocaleDateString("pt-BR", {
                month: "short",
                day: "2-digit",
                timeZone: "UTC",
              })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ rows, labelFor }) {
  if (!rows.length) return <EmptyState />;

  const max = Math.max(...rows.map((row) => Number(row.total_weight_kg)), 1);

  return (
    <div>
      {rows.slice(0, 8).map((row, index) => (
        <div className="bar-row" key={index}>
          <span title={labelFor(row)}>{labelFor(row)}</span>
          <div className="bar-track">
            <div
              style={{ width: `${(Number(row.total_weight_kg) / max) * 100}%` }}
            />
          </div>
          <span>
            {new Intl.NumberFormat("pt-BR", {
              maximumFractionDigits: 1,
            }).format(Number(row.total_weight_kg))}{" "}
            kg
          </span>
        </div>
      ))}
    </div>
  );
}
