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
  const baseline = PAD.top + innerH;
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
      <defs>
        {/* userSpaceOnUse keeps the gradient visible even when the line is perfectly flat */}
        <linearGradient
          id="rt-line"
          gradientUnits="userSpaceOnUse"
          x1={PAD.left}
          x2={W - PAD.right}
          y1="0"
          y2="0"
        >
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.6" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient
          id="rt-area"
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="0"
          y1={PAD.top}
          y2={baseline}
        >
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

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

      {runsOf(values).map((run) => {
        if (run.length === 1) {
          return (
            <circle
              key={run[0].index}
              className="chart-dot"
              cx={x(run[0].index)}
              cy={y(run[0].value)}
              r={2.5}
            />
          );
        }
        const line = run.map((p) => `${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
        const area = `${line} ${x(run[run.length - 1].index).toFixed(1)},${baseline} ${x(run[0].index).toFixed(1)},${baseline}`;
        return (
          <g key={run[0].index}>
            <polygon points={area} fill="url(#rt-area)" />
            <polyline
              className="chart-line"
              points={line}
              pathLength={1}
              stroke="url(#rt-line)"
            />
          </g>
        );
      })}

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
