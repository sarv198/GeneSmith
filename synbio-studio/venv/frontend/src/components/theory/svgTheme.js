/**
 * Palette for the theory diagrams.
 * These resolve through CSS custom properties, so the diagrams follow the
 * workspace theme — a promoter is the same colour everywhere in GeneSmith,
 * in both light and dark.
 */

export const FILL = "var(--surface-1)";
export const FILL_ALT = "var(--surface-2)";
export const TXT = "var(--text)";
export const TXT_SEC = "var(--text-3)";
export const TXT_BLACK = "var(--text)";
export const STROKE = "var(--line-strong)";
export const STROKE_BLACK = "var(--text-3)";
export const FLOW_MRNA = "var(--mrna)";
export const FLOW_RIBO = "var(--ribo)";
export const GLASS_FILL = "var(--glass-fill)";
export const GLASS_STROKE = "var(--line-strong)";

export const LEGEND = {
  promoter: { border: "var(--promoter)", stroke: "var(--promoter)" },
  rbs: { border: "var(--rbs)", stroke: "var(--rbs)" },
  gene: { border: "var(--gene)", stroke: "var(--gene)" },
  term: { border: "var(--terminator)", stroke: "var(--terminator)" },
  mrna: { border: "var(--mrna)", stroke: "var(--mrna)" },
};
