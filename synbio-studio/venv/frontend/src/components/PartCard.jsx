import { useDrag } from "react-dnd";
import { typeColor, partToPaletteItem } from "../api/client.js";
import { PART_ITEM_TYPE } from "../utils/partHelpers.js";
import { extractOrganism, stripDescription } from "../utils/partDisplay.js";
import { partLabel, typeKey, typeLabel } from "../utils/circuit.js";
import { sanitizeDna } from "../utils/previewHelix.js";
import { IconPlus } from "./Icons.jsx";
import { PartGlyphMini } from "./PartGlyph.jsx";

/** Reported RPU values live in the iGEM/Anderson descriptions — surface, don't invent. */
function reportedRpu(description) {
  const match = stripDescription(description).match(/RPU\s*[:=]?\s*([0-9]*\.?[0-9]+)/i);
  return match ? match[1] : null;
}

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

  const key = typeKey(palettePart.part_type);
  const organism = extractOrganism(palettePart.description, palettePart.source);
  const description = stripDescription(palettePart.description);
  const label = partLabel(palettePart);
  const showName = label && label !== palettePart.part_id;
  const bp = sanitizeDna(palettePart.sequence).length;
  const rpu = reportedRpu(palettePart.description);

  return (
    <div
      ref={drag}
      className={`part-card ${isDragging ? "dragging" : ""}`}
      data-type={key}
    >
      <button
        type="button"
        className="part-card-main"
        onClick={() => onAddPart?.(dragPayload)}
        aria-label={`Add ${palettePart.part_id} (${typeLabel(palettePart.part_type)}) to the circuit`}
      >
        <span className="part-card-top">
          <PartGlyphMini partType={key} className="glyph part-card-glyph" />
          <span className="type-tag">{typeLabel(palettePart.part_type)}</span>
          <span className="part-card-id">{palettePart.part_id}</span>
        </span>

        {showName && <span className="part-card-name">{label}</span>}
        {description && <span className="part-card-desc">{description}</span>}

        <span className="part-card-foot">
          {bp > 0 && <span>{bp} bp</span>}
          {rpu && (
            <span className="prov prov-source" title="Value quoted in the part record">
              {rpu} RPU
            </span>
          )}
          <span className="org">{organism}</span>
        </span>
      </button>

      <span className="part-card-side" aria-hidden="true">
        {addCount > 0 && <span className="part-add-count">×{addCount}</span>}
        <span className="part-add-btn">
          <IconPlus width={13} height={13} />
        </span>
      </span>
    </div>
  );
}
