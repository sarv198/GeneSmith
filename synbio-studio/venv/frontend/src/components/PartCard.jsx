import { useDrag } from "react-dnd";
import { typeColor, partToPaletteItem } from "../api/client.js";
import { badgeClass, displayType, PART_ITEM_TYPE } from "../utils/partHelpers.js";

export default function PartCard({ part, onAddPart, showAddButton = true }) {
  const palettePart = part.label ? part : partToPaletteItem(part);
  const dragPayload = {
    part_id: palettePart.part_id,
    part_type: palettePart.part_type,
    label: palettePart.label || palettePart.name,
    name: palettePart.name || palettePart.label,
    description: palettePart.description || "",
    sequence: palettePart.sequence,
    color: palettePart.color || typeColor(palettePart.part_type),
  };

  const [{ isDragging }, drag] = useDrag({
    type: PART_ITEM_TYPE,
    item: dragPayload,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const description = (palettePart.description || "").slice(0, 80);

  return (
    <div
      ref={drag}
      className={`part-card draggable-part ${isDragging ? "dragging" : ""}`}
      style={{ borderLeftColor: dragPayload.color, opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="part-card-header">
        <span className={`type-badge ${badgeClass(palettePart.part_type)}`}>
          {displayType(palettePart.part_type)}
        </span>
        <code className="part-id">{palettePart.part_id}</code>
      </div>
      <strong>{palettePart.label || palettePart.name}</strong>
      {description && <p className="part-desc">{description}{palettePart.description?.length > 80 ? "…" : ""}</p>}
      {showAddButton && onAddPart && (
        <button
          type="button"
          className="add-btn"
          onClick={() => onAddPart(dragPayload)}
        >
          + Add to Circuit
        </button>
      )}
    </div>
  );
}
