import { useDrag } from "react-dnd";
import { typeColor, partToPaletteItem } from "../api/client.js";
import { displayType, PART_ITEM_TYPE } from "../utils/partHelpers.js";
import { extractOrganism, extractTrait } from "../utils/partDisplay.js";

export default function PartCard({ part, onAddPart, addCount = 0 }) {
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

  const handleAdd = (event) => {
    event.stopPropagation();
    onAddPart?.(dragPayload);
  };

  return (
    <div
      ref={drag}
      className={`part-tile ${isDragging ? "dragging" : ""}`}
      style={{ borderColor: color, opacity: isDragging ? 0.55 : 1 }}
    >
      <div className="part-tile-actions">
        {addCount > 1 && (
          <span className="part-add-count" aria-label={`Added ${addCount} times`}>
            ×{addCount}
          </span>
        )}
        {addCount > 0 && (
          <span className="part-add-check" aria-hidden="true">
            ✓
          </span>
        )}
        <button
          type="button"
          className="part-add-btn"
          onClick={handleAdd}
          aria-label={`Add ${palettePart.part_id} to circuit`}
          title="Add to circuit"
        >
          +
        </button>
      </div>
      <span className="part-tile-type">{displayType(palettePart.part_type)}</span>
      <code className="part-tile-id">{palettePart.part_id}</code>
      <span className="part-tile-organism">{organism}</span>
      <span className="part-tile-trait">{trait}</span>
    </div>
  );
}
