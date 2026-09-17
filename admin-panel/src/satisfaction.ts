import type { Satisfaction } from "./types";

// Paleta NOVA reducida a azul/naranja/neutro (sin verde ni rojo):
// azul principal -> azul medio -> gris neutro -> naranja suave -> naranja conecta.
export const SATISFACTION_LEVELS: {
  key: Satisfaction;
  label: string;
  color: string;
}[] = [
  { key: "muy_satisfecho", label: "Muy satisfecho", color: "#2454C6" },
  { key: "satisfecho", label: "Satisfecho", color: "#5B7FE5" },
  { key: "regular", label: "Regular", color: "#667085" },
  { key: "poco_satisfecho", label: "Poco satisfecho", color: "#F59A45" },
  { key: "insatisfecho", label: "Insatisfecho", color: "#E47704" },
];

export const SATISFACTION_BY_KEY = Object.fromEntries(
  SATISFACTION_LEVELS.map((level) => [level.key, level]),
) as Record<Satisfaction, (typeof SATISFACTION_LEVELS)[number]>;
