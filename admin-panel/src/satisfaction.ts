import type { Satisfaction } from "./types";

// Paleta NOVA aplicada a la escala ordinal: verde éxito -> naranja de marca -> rojo error.
export const SATISFACTION_LEVELS: {
  key: Satisfaction;
  label: string;
  color: string;
}[] = [
  { key: "muy_satisfecho", label: "Muy satisfecho", color: "#16A344" },
  { key: "satisfecho", label: "Satisfecho", color: "#6FCB8B" },
  { key: "regular", label: "Regular", color: "#F59E0B" },
  { key: "poco_satisfecho", label: "Poco satisfecho", color: "#E47704" },
  { key: "insatisfecho", label: "Insatisfecho", color: "#EF4444" },
];

export const SATISFACTION_BY_KEY = Object.fromEntries(
  SATISFACTION_LEVELS.map((level) => [level.key, level]),
) as Record<Satisfaction, (typeof SATISFACTION_LEVELS)[number]>;
