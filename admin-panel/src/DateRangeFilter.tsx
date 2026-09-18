import { useState } from "react";

export type DateRange = { from?: Date; to?: Date; label: string };

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
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

const CUSTOM_LABEL = "Personalizado";

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rangeError, setRangeError] = useState("");

  function applyCustom(fromStr: string, toStr: string) {
    setRangeError("");
    if (!fromStr || !toStr) return;

    const from = startOfDay(new Date(`${fromStr}T00:00:00`));
    const to = endOfDay(new Date(`${toStr}T00:00:00`));

    if (from > to) {
      setRangeError("La fecha de inicio no puede ser posterior a la de fin");
      return;
    }

    onChange({ label: CUSTOM_LABEL, from, to });
  }

  return (
    <div className="date-filter-wrap">
      <div className="date-filter">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            className={`date-filter-btn ${value.label === preset.label ? "active" : ""}`}
            onClick={() => {
              setCustomFrom("");
              setCustomTo("");
              setRangeError("");
              onChange(preset);
            }}
          >
            {preset.label}
          </button>
        ))}

        <div className={`date-filter-custom ${value.label === CUSTOM_LABEL ? "active" : ""}`}>
          <label>
            Fecha inicio
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                applyCustom(e.target.value, customTo);
              }}
            />
          </label>
          <label>
            Fecha fin
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                applyCustom(customFrom, e.target.value);
              }}
            />
          </label>
        </div>
      </div>
      {rangeError && <p className="date-filter-error">{rangeError}</p>}
    </div>
  );
}
