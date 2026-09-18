import { useMemo, useState } from "react";
import type { Vote } from "./types";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatDayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export function TrendChart({ votes }: { votes: Vote[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    if (votes.length === 0) return [];

    const counts = new Map<string, number>();
    for (const vote of votes) {
      const key = dayKey(vote.created_at);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const days = [...counts.keys()].sort();
    const first = new Date(days[0]);
    const last = new Date(days[days.length - 1]);
    const allDays: string[] = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      allDays.push(d.toISOString().slice(0, 10));
    }

    return allDays.map((key) => ({ key, count: counts.get(key) ?? 0 }));
  }, [votes]);

  if (points.length === 0) {
    return <p className="muted empty">Todavía no hay datos suficientes para una tendencia.</p>;
  }

  const width = 720;
  const height = 200;
  const padding = 28;
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  function xAt(i: number) {
    return padding + i * stepX;
  }
  function yAt(count: number) {
    return height - padding - (count / max) * (height - padding * 2);
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.count)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(points.length - 1)} ${height - padding} L ${xAt(0)} ${height - padding} Z`;

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#e2e8f0"
        />
        <path d={areaPath} fill="rgba(36, 84, 198, 0.12)" stroke="none" />
        <path d={linePath} fill="none" stroke="#2454c6" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.key}>
            {i % labelEvery === 0 && (
              <text x={xAt(i)} y={height - 8} fontSize="10" fill="#667085" textAnchor="middle">
                {formatDayLabel(p.key)}
              </text>
            )}
            <circle
              cx={xAt(i)}
              cy={yAt(p.count)}
              r={hoverIdx === i ? 5 : 3}
              fill="#2454c6"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          </g>
        ))}
      </svg>
      {hoverIdx !== null && (
        <div className="trend-tooltip">
          {formatDayLabel(points[hoverIdx].key)}: <strong>{points[hoverIdx].count}</strong> votos
        </div>
      )}
    </div>
  );
}
