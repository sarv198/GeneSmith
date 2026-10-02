import { sanitizeDna } from "./previewHelix.js";

export const PART_TYPES = ["promoter", "rbs", "gene", "terminator"];

export const TYPE_LABEL = {
  promoter: "Promoter",
  rbs: "RBS",
  gene: "Gene",
  cds: "Gene",
  terminator: "Terminator",
};

/** Canonical type key used for colors, glyphs and grouping. */
export function typeKey(partType) {
  const t = String(partType || "").toLowerCase();
  if (t === "cds") return "gene";
  if (PART_TYPES.includes(t)) return t;
  return "other";
}

export function typeLabel(partType) {
  return TYPE_LABEL[String(partType || "").toLowerCase()] || "Part";
}

export function partLabel(part) {
  if (!part) return "";
  const name = part.name || part.label || "";
  const id = part.part_id || "";
  // iGEM rows often repeat the id as the name; prefer the more informative one.
  if (!name || name === id) return id;
  return name;
}

export function hasType(circuit, type) {
  const key = typeKey(type);
  return (circuit || []).some((part) => typeKey(part.part_type) === key);
}

export function firstOfType(circuit, type) {
  const key = typeKey(type);
  return (circuit || []).find((part) => typeKey(part.part_type) === key) || null;
}

/** Build the assembled construct with a byte range per part. */
export function assembleCircuit(circuit) {
  let cursor = 0;
  let sequence = "";
  const segments = (circuit || []).map((part) => {
    const seq = sanitizeDna(part.sequence);
    const start = cursor;
    cursor += seq.length;
    sequence += seq;
    return {
      uid: part.uid,
      part_id: part.part_id,
      part_type: part.part_type,
      key: typeKey(part.part_type),
      name: partLabel(part),
      start,
      end: cursor,
      length: seq.length,
    };
  });
  return { sequence, segments, length: sequence.length };
}

export function gcContent(sequence) {
  const seq = sanitizeDna(sequence);
  if (!seq.length) return null;
  let gc = 0;
  for (let i = 0; i < seq.length; i++) {
    const base = seq[i];
    if (base === "G" || base === "C") gc += 1;
  }
  return gc / seq.length;
}

export function baseCounts(sequence) {
  const seq = sanitizeDna(sequence);
  const counts = { A: 0, T: 0, G: 0, C: 0 };
  for (let i = 0; i < seq.length; i++) {
    if (counts[seq[i]] != null) counts[seq[i]] += 1;
  }
  return counts;
}

export function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value).toFixed(digits);
}

export function formatPercent(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return null;
  return `${(value * 100).toFixed(digits)}%`;
}

/** Missing parts, in assembly order, for status messaging. */
export function missingParts(circuit) {
  return PART_TYPES.filter((type) => !hasType(circuit, type));
}

export function circuitStatus(circuit) {
  if (!circuit || circuit.length === 0) {
    return { level: "empty", label: "Empty", detail: "No parts placed" };
  }
  const missing = missingParts(circuit);
  if (!hasType(circuit, "promoter")) {
    return {
      level: "err",
      label: "Promoter required",
      detail: "A promoter is required before the model can run",
    };
  }
  if (missing.length === 0) {
    return {
      level: "ok",
      label: "Complete construct",
      detail: "Promoter, RBS, gene and terminator present",
    };
  }
  return {
    level: "warn",
    label: `Missing ${missing.map((m) => TYPE_LABEL[m]).join(", ")}`,
    detail: "The model runs, but with reduced scope",
  };
}

/**
 * Map model outputs back onto the exact parts they describe.
 * The API scores the first promoter, the first RBS and the first CDS, so only
 * those nodes may carry a predicted value.
 */
export function predictedNodeMetrics(circuit, prediction) {
  const metrics = {};
  if (!prediction || !circuit?.length) return metrics;

  const promoter = firstOfType(circuit, "promoter");
  const rbs = firstOfType(circuit, "rbs");
  const gene = firstOfType(circuit, "gene");

  const rpu = prediction.promoter_strength?.rpu;
  if (promoter && rpu != null) {
    metrics[promoter.uid] = {
      label: "Predicted strength",
      value: rpu,
      display: `${rpu} RPU`,
      fraction: Math.max(0, Math.min(1, rpu)),
      kind: "predicted",
    };
  }

  const translation = prediction.translation_rate?.value;
  if (rbs && translation != null) {
    metrics[rbs.uid] = {
      label: "Predicted translation rate",
      value: translation,
      display: `${translation}`,
      fraction: Math.max(0, Math.min(1, translation)),
      kind: "predicted",
    };
  }

  const aaLength = prediction.protein_yield?.amino_acid_length;
  if (gene && aaLength != null) {
    metrics[gene.uid] = {
      label: "Translated length",
      value: aaLength,
      display: `${aaLength} aa`,
      fraction: null,
      kind: "computed",
    };
  }

  return metrics;
}

/** FASTA export of the assembled construct — derived entirely from state. */
export function circuitToFasta(circuit, name = "circuit") {
  const { sequence, segments } = assembleCircuit(circuit);
  const header = segments
    .map((s) => `${s.part_id}[${typeLabel(s.part_type)}]`)
    .join(" ");
  const lines = [];
  for (let i = 0; i < sequence.length; i += 70) {
    lines.push(sequence.slice(i, i + 70));
  }
  return `>${name.replace(/\s+/g, "_")} ${sequence.length}bp ${header}\n${lines.join("\n")}\n`;
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
