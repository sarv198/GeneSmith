import { useEffect, useState } from "react";
import { useDrop } from "react-dnd";
import { PART_ITEM_TYPE } from "../utils/partHelpers.js";
import PartViewer3D from "./PartViewer3D.jsx";

function hasType(circuit, type) {
  const aliases = type === "cds" ? ["cds", "gene"] : [type];
  return circuit.some((p) => aliases.includes((p.part_type || "").toLowerCase()));
}

export default function CircuitCanvas({
  circuit,
  onAddPart,
  onRemovePart,
  onClear,
  onPredict,
  loading,
}) {
  const [selectedPart, setSelectedPart] = useState(null);

  const [{ isOver }, drop] = useDrop({
    accept: PART_ITEM_TYPE,
    drop: (item) => onAddPart({ ...item, uid: crypto.randomUUID() }),
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const isComplete =
    hasType(circuit, "promoter") &&
    hasType(circuit, "rbs") &&
    hasType(circuit, "cds") &&
    hasType(circuit, "terminator");

  useEffect(() => {
    if (!selectedPart) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedPart(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPart]);

  return (
    <section
      ref={drop}
      className={`circuit-builder-zone ${isOver ? "drag-over" : ""} ${circuit.length === 0 ? "empty" : ""}`}
    >
      <div className="circuit-builder-header">
        <h2 className="section-title">Circuit Builder</h2>
        <div className="circuit-builder-actions">
          <button type="button" onClick={onClear} disabled={!circuit.length}>
            Clear
          </button>
          <button
            type="button"
            className="btn-dark"
            onClick={onPredict}
            disabled={!circuit.length || loading}
          >
            {loading ? "Predicting…" : isComplete ? "Predict" : "Predict (partial)"}
          </button>
        </div>
      </div>

      <ul className="circuit-checklist">
        <li className={hasType(circuit, "promoter") ? "checked" : ""}>Promoter</li>
        <li className={hasType(circuit, "rbs") ? "checked" : ""}>RBS</li>
        <li className={hasType(circuit, "gene") ? "checked" : ""}>Gene</li>
        <li className={hasType(circuit, "terminator") ? "checked" : ""}>Terminator</li>
      </ul>

      {circuit.length === 0 ? (
        <p className="circuit-drop-hint">Drag or click parts to build your construct</p>
      ) : (
        <ol className="circuit-list">
          {circuit.map((part, i) => (
            <li key={part.uid} className="circuit-item">
              <span className="index">{i + 1}</span>
              <button
                type="button"
                className="circuit-part-btn"
                style={{ borderColor: part.color }}
                onClick={() => setSelectedPart(part)}
              >
                <span className="part-type">{part.part_type}</span>
                <strong>{part.label || part.name}</strong>
              </button>
              <button type="button" className="remove" onClick={() => onRemovePart(part.uid)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      {selectedPart && (
        <div
          className="viewer-modal-overlay"
          role="presentation"
          onClick={() => setSelectedPart(null)}
        >
          <div
            className="viewer-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="viewer-modal-close"
              onClick={() => setSelectedPart(null)}
            >
              ×
            </button>
            <PartViewer3D part={selectedPart} />
          </div>
        </div>
      )}
    </section>
  );
}
