import type { SeriesPoint } from "../api";
import { niceCeil, runsOf } from "../chart";

const W = 640;
const H = 200;
const PAD = { left: 56, right: 10, top: 10, bottom: 24 };

function label(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResponseChart({
  series,
  from,
  to,
}: {
  series: SeriesPoint[];
  from: number;
  to: number;
}) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = series.map((point) => point.avgMs);
  const known = values.filter((value): value is number => value !== null);
  const top = niceCeil(Math.max(100, ...known));
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  const barWidth = Math.max(2, innerW / Math.max(series.length, 1));
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = [0, top / 2, top];

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Average response time over the selected range, with failed periods highlighted"
    >
      <title>Average response time over the selected range</title>

      {ticks.map((tick) => (
        <g key={tick}>
          <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
          <text className="chart-label" x={PAD.left - 6} y={y(tick) + 4} textAnchor="end">
            {tick} ms
          </text>
        </g>
      ))}

      {series.map((point, i) =>
        point.checks > 0 && point.up < point.checks ? (
          <rect
            key={point.t}
            className="chart-down"
            x={x(i) - barWidth / 2}
            y={PAD.top}
            width={barWidth}
            height={innerH}
          />
        ) : null
      )}

      {runsOf(values).map((run) =>
        run.length === 1 ? (
          <circle
            key={run[0].index}
            className="chart-dot"
            cx={x(run[0].index)}
            cy={y(run[0].value)}
            r={2.5}
          />
        ) : (
          <polyline
            key={run[0].index}
            className="chart-line"
            points={run.map((p) => `${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")}
          />
        )
      )}

      <text className="chart-label" x={PAD.left} y={H - 6}>
        {label(from)}
      </text>
      <text className="chart-label" x={W - PAD.right} y={H - 6} textAnchor="end">
        {label(to)}
      </text>
      {known.length === 0 && (
        <text className="chart-label" x={W / 2} y={H / 2} textAnchor="middle">
          No successful checks in this range
        </text>
      )}
    </svg>
  );
}
