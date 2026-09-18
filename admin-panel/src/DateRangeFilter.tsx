export type DateRange = { from?: Date; to?: Date; label: string };

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

export const PRESETS: DateRange[] = [
  { label: "Hoy", from: startOfDay(new Date()) },
  { label: "Últimos 7 días", from: daysAgo(6) },
  { label: "Últimos 30 días", from: daysAgo(29) },
  { label: "Todo", from: undefined },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="date-filter">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          className={`date-filter-btn ${value.label === preset.label ? "active" : ""}`}
          onClick={() => onChange(preset)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
