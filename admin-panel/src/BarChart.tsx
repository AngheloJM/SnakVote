import { Face } from "./Face";
import { SATISFACTION_LEVELS } from "./satisfaction";
import type { Vote } from "./types";

export function BarChart({
  counts,
  total,
}: {
  counts: Record<Vote["satisfaction"], number>;
  total: number;
}) {
  const max = Math.max(1, ...SATISFACTION_LEVELS.map((l) => counts[l.key] ?? 0));

  return (
    <div className="bar-chart">
      {SATISFACTION_LEVELS.map((level) => {
        const count = counts[level.key] ?? 0;
        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
        const widthPct = (count / max) * 100;
        return (
          <div className="bar-row" key={level.key}>
            <div className="bar-row-label">
              <Face mood={level.key} size={22} />
              <span>{level.label}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${widthPct}%`, background: level.color }}
              />
            </div>
            <div className="bar-value">
              {count} <span className="muted">({pct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
