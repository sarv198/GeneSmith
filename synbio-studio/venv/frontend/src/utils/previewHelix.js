/** Display-scaled B-DNA helix geometry for 3Dmol preview (not physical Angstroms). */

export const HELIX = {
  rise: 0.42,
  radius: 1.75,
  twist: 36,
  maxPointsPerPart: 50,
};

export function sanitizeDna(seq) {
  return (seq || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .toUpperCase()
    .replace(/[^ATCG]/g, "");
}

export function subsampleSequence(seq, maxPoints) {
  if (seq.length <= maxPoints) return seq;
  if (maxPoints < 2) return seq.slice(0, 1);
  const chars = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.floor((i / (maxPoints - 1)) * (seq.length - 1));
    chars.push(seq[idx]);
  }
  return chars.join("");
}

export function helixPoint(globalIndex, strandOffsetDeg = 0) {
  const angleRad = ((globalIndex * HELIX.twist) + strandOffsetDeg) * (Math.PI / 180);
  return {
    x: HELIX.radius * Math.cos(angleRad),
    y: HELIX.radius * Math.sin(angleRad),
    z: globalIndex * HELIX.rise,
  };
}

/** Build XYZ + metadata for one colored segment along a continuous helix. */
export function segmentHelixGeometry(segment, globalStartIndex, color) {
  const maxPts =
    segment.length > 80 ? HELIX.maxPointsPerPart : Math.max(segment.length, 2);
  const sampled = subsampleSequence(segment, maxPts);
  const atoms = [];
  const backbone = [];

  sampled.split("").forEach((_base, i) => {
    const idx = globalStartIndex + i;
    const p1 = helixPoint(idx, 0);
    const p2 = helixPoint(idx, 180);
    atoms.push(`C  ${p1.x.toFixed(3)}  ${p1.y.toFixed(3)}  ${p1.z.toFixed(3)}`);
    atoms.push(`N  ${p2.x.toFixed(3)}  ${p2.y.toFixed(3)}  ${p2.z.toFixed(3)}`);
    backbone.push(p1);
  });

  return {
    xyz: `${atoms.length}\nDNA segment\n${atoms.join("\n")}`,
    backbone,
    color,
    pointCount: sampled.length,
  };
}

export function buildStructureFromCircuit(circuit, typeColorFn) {
  let full = "";
  const parts_map = circuit.map((part) => {
    const start = full.length;
    const seq = sanitizeDna(part.sequence);
    full += seq;
    return {
      part_id: part.part_id,
      part_type: part.part_type,
      start,
      end: full.length,
      color: part.color || typeColorFn(part.part_type),
    };
  });
  return {
    assembled_sequence: full,
    parts_map,
    total_length: full.length,
    trimmed: false,
  };
}

/** Fingerprint for tests — differs when circuit composition changes. */
export function helixFingerprint(dnaStructure) {
  const assembled = sanitizeDna(dnaStructure.assembled_sequence);
  let globalIndex = 0;
  const chunks = [];

  dnaStructure.parts_map.forEach((part) => {
    const segment = sanitizeDna(assembled.slice(part.start, part.end));
    if (segment.length < 2) return;
    const geom = segmentHelixGeometry(segment, globalIndex, part.color);
    globalIndex += geom.pointCount;
    const last = geom.backbone[geom.backbone.length - 1];
    chunks.push(
      `${part.part_id}:${segment.length}:${last.x.toFixed(2)},${last.y.toFixed(2)},${last.z.toFixed(2)}`,
    );
  });

  return chunks.join("|");
}
