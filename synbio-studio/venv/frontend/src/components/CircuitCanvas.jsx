import { useDrop } from "react-dnd";
import { PART_ITEM_TYPE } from "../utils/partHelpers.js";

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

  const fullSequence = circuit.map((p) => p.sequence).join("");

  return (
    <section
      ref={drop}
      className={`canvas ${isOver ? "drag-over" : ""} ${circuit.length === 0 ? "empty" : ""}`}
    >
      <div className="canvas-header">
        <h2>Circuit</h2>
        <div className="canvas-actions">
          <button type="button" onClick={onClear} disabled={!circuit.length}>
            Clear
          </button>
          <button
            type="button"
            className="primary"
            onClick={onPredict}
            disabled={!circuit.length || loading}
          >
            {loading ? "Predicting…" : isComplete ? "Predict Performance" : "Predict (partial)"}
          </button>
        </div>
      </div>

      <ul className="circuit-checklist">
        <li className={hasType(circuit, "promoter") ? "checked" : ""}>□ Promoter</li>
        <li className={hasType(circuit, "rbs") ? "checked" : ""}>□ RBS</li>
        <li className={hasType(circuit, "gene") ? "checked" : ""}>□ Gene</li>
        <li className={hasType(circuit, "terminator") ? "checked" : ""}>□ Terminator</li>
      </ul>

      {circuit.length === 0 ? (
        <p className="drop-hint">Drop parts here to build your construct</p>
      ) : (
        <ol className="circuit-list">
          {circuit.map((part, i) => (
            <li key={part.uid} className="circuit-item">
              <span className="index">{i + 1}</span>
              <div className="circuit-part" style={{ borderColor: part.color }}>
                <span className="part-type">{part.part_type}</span>
                <strong>{part.label || part.name}</strong>
                <span className="seq-preview">
                  {part.sequence.slice(0, 40)}
                  {part.sequence.length > 40 ? "…" : ""}
                </span>
              </div>
              <button type="button" className="remove" onClick={() => onRemovePart(part.uid)}>
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      {fullSequence && (
        <div className="full-sequence">
          <h3>Full sequence ({fullSequence.length} bp)</h3>
          <code>{fullSequence}</code>
        </div>
      )}
    </section>
  );
}
