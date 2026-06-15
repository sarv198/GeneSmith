export function aminoAcidColor(residue) {
  const aa = (residue || "").toUpperCase();
  if ("AILMFWYV".includes(aa)) return "#f97316";
  if ("STNQ".includes(aa)) return "#22c55e";
  if ("KRH".includes(aa)) return "#3b82f6";
  if ("DE".includes(aa)) return "#ef4444";
  return "#94a3b8";
}

export function complementBase(base) {
  return { A: "T", T: "A", G: "C", C: "G" }[base?.toUpperCase()] || "A";
}

export function dnaComplement(sequence) {
  return (sequence || "")
    .split("")
    .map((base) => complementBase(base))
    .join("");
}
