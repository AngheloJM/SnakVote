import { SATISFACTION_BY_KEY } from "./satisfaction";
import type { Satisfaction } from "./types";

const MOUTHS: Record<Satisfaction, string> = {
  muy_satisfecho: "M 20 62 Q 50 92 80 62",
  satisfecho: "M 24 60 Q 50 78 76 60",
  regular: "M 26 66 L 74 66",
  poco_satisfecho: "M 24 78 Q 50 62 76 78",
  insatisfecho: "M 18 84 Q 50 56 82 84",
};

export function Face({
  mood,
  size = 40,
  delay = 0,
}: {
  mood: Satisfaction;
  size?: number;
  delay?: number;
}) {
  return (
    <svg
      className="face"
      style={{ width: size, height: size, animationDelay: `${delay}s` }}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill={SATISFACTION_BY_KEY[mood].color} />
      <g className="face-eyes">
        <circle cx="34" cy="42" r="6" fill="#101828" />
        <circle cx="66" cy="42" r="6" fill="#101828" />
      </g>
      <path d={MOUTHS[mood]} stroke="#101828" strokeWidth={6} fill="none" strokeLinecap="round" />
    </svg>
  );
}
