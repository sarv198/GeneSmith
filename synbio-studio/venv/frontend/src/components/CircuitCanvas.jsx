import { Fragment, useCallback, useRef } from "react";
import { useDrag, useDragLayer, useDrop } from "react-dnd";
import { PART_ITEM_TYPE } from "../utils/partHelpers.js";
import { sanitizeDna } from "../utils/previewHelix.js";
import {
  PART_TYPES,
  TYPE_LABEL,
  hasType,
  partLabel,
  predictedNodeMetrics,
  typeKey,
  typeLabel,
} from "../utils/circuit.js";
import PartGlyph from "./PartGlyph.jsx";
import { IconClose, IconTrash } from "./Icons.jsx";

export const NODE_ITEM_TYPE = "CIRCUIT_NODE";

const ACCEPTS = [PART_ITEM_TYPE, NODE_ITEM_TYPE];

function InsertSlot({ index, onInsert, onMove, armed, end = false }) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ACCEPTS,
    drop: (item, monitor) => {
      if (monitor.getItemType() === NODE_ITEM_TYPE) {
        onMove(item.uid, index);
      } else {
        onInsert(item, index);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <li
      ref={drop}
      className={`slot ${end ? "slot-end" : ""} ${armed && canDrop ? "armed" : ""} ${
        isOver ? "over" : ""
      }`}
      aria-hidden="true"
    />
  );
}

function CircuitNode({
  part,
  index,
  total,
  selected,
  metric,
  onSelect,
  onRemove,
  onMove,
}) {
  const [{ isDragging }, drag] = useDrag({
    type: NODE_ITEM_TYPE,
    item: { uid: part.uid, index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const key = typeKey(part.part_type);
  const bp = sanitizeDna(part.sequence).length;
  const name = partLabel(part);
  const ticks = metric?.fraction != null ? Math.round(metric.fraction * 5) : null;

  const onKeyDown = (event) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(part.uid);
      return;
    }
    if (event.altKey && event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      onMove(part.uid, index - 1);
      return;
    }
    if (event.altKey && event.key === "ArrowRight" && index < total - 1) {
      event.preventDefault();
      onMove(part.uid, index + 2);
    }
  };

  return (
    <li className="node-item">
      <div
        ref={drag}
        className={`node ${key} ${selected ? "selected" : ""} ${
          isDragging ? "dragging" : ""
        }`}
        data-type={key}
      >
        <button
          type="button"
          className="node-hit"
          aria-pressed={selected}
          onClick={() => onSelect(part.uid)}
          onKeyDown={onKeyDown}
          aria-label={`${typeLabel(part.part_type)} ${part.part_id}, position ${
            index + 1
          } of ${total}. Alt plus arrow keys to reorder, Delete to remove.`}
        >
          <span className="node-index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="node-glyph">
            <PartGlyph partType={key} />
          </span>
          <span className="node-box">
            <span className="node-type">{typeLabel(part.part_type)}</span>
            <span className="node-name">{name}</span>
            {name !== part.part_id && (
              <span className="node-id">{part.part_id}</span>
            )}
            <span className="node-foot">
              <span>{bp} bp</span>
              {metric ? (
                <span
                  className="node-strength"
                  data-tip={`${metric.label} · ${metric.display}`}
                >
                  {ticks != null ? (
                    <span className="ticks" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className={`tick ${i < ticks ? "on" : ""}`} />
                      ))}
                    </span>
                  ) : null}
                  {metric.display}
                </span>
              ) : null}
            </span>
          </span>
        </button>

        <button
          type="button"
          className="node-remove"
          onClick={() => onRemove(part.uid)}
          aria-label={`Remove ${part.part_id} from the circuit`}
        >
          <IconClose width={11} height={11} />
        </button>
      </div>
    </li>
  );
}

export default function CircuitCanvas({
  circuit,
  selectedUid,
  onSelect,
  onInsertPart,
  onRemovePart,
  onMovePart,
  onClear,
  prediction,
}) {
  const { isDragging } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
  }));

  // Grab the backdrop to pan; the construct itself keeps its own interactions.
  const scrollRef = useRef(null);
  const panRef = useRef(null);

  const onPanStart = useCallback((event) => {
    if (event.button !== 0 && event.button !== 1) return;
    const surface = scrollRef.current;
    if (!surface) return;
    if (event.button === 0 && event.target.closest(".node, .slot, button, a, input")) {
      return;
    }
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: surface.scrollLeft,
      top: surface.scrollTop,
      pointerId: event.pointerId,
    };
    surface.classList.add("panning");
    surface.setPointerCapture?.(event.pointerId);
  }, []);

  const onPanMove = useCallback((event) => {
    const pan = panRef.current;
    const surface = scrollRef.current;
    if (!pan || !surface) return;
    surface.scrollLeft = pan.left - (event.clientX - pan.x);
    surface.scrollTop = pan.top - (event.clientY - pan.y);
  }, []);

  const onPanEnd = useCallback((event) => {
    const surface = scrollRef.current;
    if (!panRef.current || !surface) return;
    surface.releasePointerCapture?.(panRef.current.pointerId ?? event.pointerId);
    panRef.current = null;
    surface.classList.remove("panning");
  }, []);

  const [{ isOverCanvas }, dropCanvas] = useDrop({
    accept: ACCEPTS,
    drop: (item, monitor) => {
      if (monitor.didDrop()) return;
      if (monitor.getItemType() === NODE_ITEM_TYPE) return;
      onInsertPart(item, circuit.length);
    },
    collect: (monitor) => ({ isOverCanvas: monitor.isOver() }),
  });

  const metrics = predictedNodeMetrics(circuit, prediction);
  const total = circuit.length;

  return (
    <section
      ref={dropCanvas}
      className={`canvas ${isDragging || isOverCanvas ? "drag-active" : ""}`}
      aria-label="Circuit canvas"
    >
      <div className="canvas-head">
        <h2 className="panel-title">Construct</h2>
        <div className="assembly" role="list" aria-label="Assembly checklist">
          {PART_TYPES.map((type) => {
            const present = hasType(circuit, type);
            return (
              <span
                key={type}
                role="listitem"
                className={`assembly-item ${present ? "present" : ""}`}
                data-type={type}
                data-tip={
                  present
                    ? `${TYPE_LABEL[type]} present`
                    : `No ${TYPE_LABEL[type].toLowerCase()} in this construct`
                }
              >
                <span className="mark" aria-hidden="true">
                  {present ? "✓" : ""}
                </span>
                {TYPE_LABEL[type]}
                <span className="sr-only">
                  {present ? " present" : " missing"}
                </span>
              </span>
            );
          })}
        </div>

        <div className="panel-head-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClear}
            disabled={!total}
            data-tip="Remove every part from the canvas"
            data-tip-align="end"
          >
            <IconTrash width={12} height={12} />
            Clear
          </button>
        </div>
      </div>

      <div
        className="canvas-scroll"
        ref={scrollRef}
        onPointerDown={onPanStart}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerCancel={onPanEnd}
      >
        {total === 0 ? (
          <div className="canvas-empty">
            <h3>Start building your circuit</h3>
            <p>
              Drag a promoter from the library onto the canvas — or press its
              card — then add an RBS, a gene and a terminator to complete the
              transcription unit.
            </p>
            <div className="empty-schema" aria-hidden="true">
              {PART_TYPES.map((type, index) => (
                <span key={type} className="seg" data-type={type}>
                  <span className="box">{TYPE_LABEL[type]}</span>
                  {index < PART_TYPES.length - 1 && <span>→</span>}
                </span>
              ))}
            </div>
            <p className="hint">
              Parts snap into the construct in the order you place them.
            </p>
          </div>
        ) : (
          <div className="track-wrap">
            <ol className="track" aria-label="Genetic construct, 5 prime to 3 prime">
              <InsertSlot
                index={0}
                armed={isDragging}
                onInsert={onInsertPart}
                onMove={onMovePart}
              />
              {circuit.map((part, index) => (
                <Fragment key={part.uid}>
                  <CircuitNode
                    part={part}
                    index={index}
                    total={total}
                    selected={selectedUid === part.uid}
                    metric={metrics[part.uid]}
                    onSelect={onSelect}
                    onRemove={onRemovePart}
                    onMove={onMovePart}
                  />
                  <InsertSlot
                    index={index + 1}
                    armed={isDragging}
                    onInsert={onInsertPart}
                    onMove={onMovePart}
                    end={index === total - 1}
                  />
                </Fragment>
              ))}
            </ol>

            <div className="track-axis" aria-hidden="true">
              <span>5′</span>
              <span className="rule" />
              <span>transcription →</span>
              <span className="rule" />
              <span>3′</span>
            </div>

            <p className="hint canvas-tip">
              Drag the canvas to pan · drag a part to reorder ·{" "}
              <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> to move the selected part
              · <kbd>Del</kbd> to remove
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
