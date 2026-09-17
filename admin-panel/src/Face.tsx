import type { Satisfaction } from "./types";

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
    <img
      className="face"
      style={{ width: size, height: size, animationDelay: `${delay}s` }}
      src={`/emoji/${mood}.png`}
      alt=""
      aria-hidden="true"
    />
  );
}
