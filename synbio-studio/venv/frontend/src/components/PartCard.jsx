import { useCallback, useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { typeColor, partToPaletteItem } from "../api/client.js";
import { displayType, PART_ITEM_TYPE } from "../utils/partHelpers.js";
import { extractOrganism, extractTrait } from "../utils/partDisplay.js";

export default function PartCard({ part, onAddPart }) {
  const palettePart = part.label ? part : partToPaletteItem(part);
  const color = palettePart.color || typeColor(palettePart.part_type);
  const dragPayload = {
    part_id: palettePart.part_id,
    part_type: palettePart.part_type,
    label: palettePart.label || palettePart.name,
    name: palettePart.name || palettePart.label,
    description: palettePart.description || "",
    sequence: palettePart.sequence,
    color,
  };

  const [{ isDragging }, drag] = useDrag({
    type: PART_ITEM_TYPE,
    item: dragPayload,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const organism = extractOrganism(palettePart.description, palettePart.source);
  const trait = extractTrait(palettePart.description);

  const handleClick = () => onAddPart?.(dragPayload);

  return (
    <div
      ref={drag}
      role="button"
      tabIndex={0}
      className={`part-tile ${isDragging ? "dragging" : ""}`}
      style={{ borderColor: color, opacity: isDragging ? 0.55 : 1 }}
      onClick={handleClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleClick()}
    >
      <span className="part-tile-type">{displayType(palettePart.part_type)}</span>
      <code className="part-tile-id">{palettePart.part_id}</code>
      <span className="part-tile-organism">{organism}</span>
      <span className="part-tile-trait">{trait}</span>
    </div>
  );
}
