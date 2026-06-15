export const PART_ITEM_TYPE = "PART";

export function badgeClass(partType) {
  const t = (partType || "").toLowerCase();
  if (t === "promoter") return "badge-promoter";
  if (t === "rbs") return "badge-rbs";
  if (t === "cds" || t === "gene") return "badge-cds";
  if (t === "terminator") return "badge-terminator";
  return "badge-default";
}

export function displayType(partType) {
  const t = (partType || "").toLowerCase();
  if (t === "cds") return "gene";
  return t;
}
