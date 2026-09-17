import { Face } from "./Face";
import { SATISFACTION_LEVELS } from "./satisfaction";
import type { Vote } from "./types";

export function DonutChart({
  counts,
  total,
}: {
  counts: Record<Vote["satisfaction"], number>;
  total: number;
}) {
  let cumulative = 0;
  const stops: string[] = [];

  for (const level of SATISFACTION_LEVELS) {
    const pct = total === 0 ? 0 : (counts[level.key] / total) * 100;
    if (pct <= 0) continue;
    const start = cumulative;
    cumulative += pct;
    stops.push(`${level.color} ${start}% ${cumulative}%`);
  }

  const gradient = stops.length > 0 ? stops.join(", ") : "#e1e0d9 0% 100%";

  return (
    <div className="donut-section">
      <div className="donut-callouts">
        {SATISFACTION_LEVELS.map((level, i) => {
          const count = counts[level.key] ?? 0;
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div className="callout" key={level.key}>
              <div className="callout-badge">
                <Face mood={level.key} size={40} delay={i * 0.15} />
              </div>
              <div className="callout-pct" style={{ color: level.color }}>
                {pct}%
              </div>
              <div className="callout-count">{count}</div>
            </div>
          );
        })}
      </div>

      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="donut-hole">
          <div className="donut-total">{total}</div>
          <div className="donut-total-label">votos totales</div>
        </div>
      </div>
    </div>
  );
}
