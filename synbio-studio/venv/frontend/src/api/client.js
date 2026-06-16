import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD ? "" : "http://localhost:8000");

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export function partToPaletteItem(part) {
  return {
    part_id: part.part_id,
    part_type: part.part_type,
    label: part.name || part.part_id,
    name: part.name || part.part_id,
    description: part.description || "",
    sequence: part.sequence || "",
    color: typeColor(part.part_type),
  };
}

export function typeColor(partType) {
  const t = (partType || "").toLowerCase();
  if (t === "promoter") return "#e85d4c";
  if (t === "rbs") return "#4c9be8";
  if (t === "cds" || t === "gene") return "#5cb85c";
  if (t === "terminator") return "#f0ad4e";
  return "#888888";
}
