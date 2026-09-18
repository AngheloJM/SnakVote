import { useMemo } from "react";
import type { Vote } from "./types";

export function CommentsFrequency({
  votes,
  selected,
  onSelect,
}: {
  votes: Vote[];
  selected: string | null;
  onSelect: (comment: string | null) => void;
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const vote of votes) {
      if (!vote.attention_or_food) continue;
      map.set(vote.attention_or_food, (map.get(vote.attention_or_food) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [votes]);

  if (counts.length === 0) {
    return <p className="muted empty">Todavía no hay comentarios registrados.</p>;
  }

  const max = counts[0][1];

  return (
    <div className="comments-freq">
      {counts.map(([comment, count]) => (
        <button
          key={comment}
          className={`comment-freq-row ${selected === comment ? "active" : ""}`}
          onClick={() => onSelect(selected === comment ? null : comment)}
        >
          <span className="comment-freq-label">{comment}</span>
          <div className="comment-freq-track">
            <div className="comment-freq-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="comment-freq-count">{count}</span>
        </button>
      ))}
      {selected && (
        <button className="comment-freq-clear" onClick={() => onSelect(null)}>
          Quitar filtro "{selected}"
        </button>
      )}
    </div>
  );
}
