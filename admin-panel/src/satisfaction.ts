import type { Satisfaction } from "./types";

// Escala ordinal good -> critical (paleta de estado de la skill de dataviz,
// con dos tintes de verde porque son 5 niveles y solo 4 roles de estado fijos).
export const SATISFACTION_LEVELS: {
  key: Satisfaction;
  emoji: string;
  label: string;
  color: string;
}[] = [
  { key: "muy_satisfecho", emoji: "😊", label: "Muy satisfecho", color: "#0ca30c" },
  { key: "satisfecho", emoji: "🙂", label: "Satisfecho", color: "#4caf50" },
  { key: "regular", emoji: "😐", label: "Regular", color: "#fab219" },
  { key: "poco_satisfecho", emoji: "🙁", label: "Poco satisfecho", color: "#ec835a" },
  { key: "insatisfecho", emoji: "😞", label: "Insatisfecho", color: "#d03b3b" },
];

export const SATISFACTION_BY_KEY = Object.fromEntries(
  SATISFACTION_LEVELS.map((level) => [level.key, level]),
) as Record<Satisfaction, (typeof SATISFACTION_LEVELS)[number]>;
