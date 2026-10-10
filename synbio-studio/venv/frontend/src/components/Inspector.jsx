import { Suspense, lazy, useEffect, useState } from "react";
import {
  assembleCircuit,
  baseCounts,
  circuitStatus,
  formatPercent,
  gcContent,
  partLabel,
  predictedNodeMetrics,
  typeKey,
  typeLabel,
} from "../utils/circuit.js";
import { sanitizeDna } from "../utils/previewHelix.js";
import { extractOrganism, stripDescription } from "../utils/partDisplay.js";
import { dnaComplement } from "../utils/aminoAcidColors.js";
import {
  IconCaret,
  IconClose,
  IconCopy,
  IconPlus,
  IconSearch,
  IconTrash,
} from "./Icons.jsx";

// The 3D viewer pulls in NGL and 3Dmol, so it stays out of the initial bundle.
const PartViewer3D = lazy(() => import("./PartViewer3D.jsx"));

function Section({ id, title, tail, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="insp-section">
      <button
        type="button"
        className="insp-section-head"
        aria-expanded={open}
        aria-controls={`insp-${id}`}
        onClick={() => setOpen((value) => !value)}
      >
        <IconCaret className="caret" />
        {title}
        {tail && <span className="tail">{tail}</span>}
      </button>
      {open && (
        <div className="insp-section-body" id={`insp-${id}`}>
          {children}
        </div>
      )}
    </section>
  );
}

function DnaStrands({ sequence }) {
  const seq = sanitizeDna(sequence);
  if (!seq) return <p className="hint">No sequence recorded for this part.</p>;
  return (
    <div className="seq-block">
      <div>
        {seq.split("").map((base, index) => (
          <span key={index} className={`base-${base}`}>
            {base}
          </span>
        ))}
      </div>
      <div className="comp-strand">{dnaComplement(seq)}</div>
    </div>
  );
}

/** Base composition, colour-matched to the sequence above it. */
function Composition({ sequence }) {
  const seq = sanitizeDna(sequence);
  if (!seq.length) return null;
  const counts = baseCounts(seq);
  return (
    <div className="comp-grid">
      {["A", "T", "G", "C"].map((base) => (
        <span className="comp-item" key={base}>
          <span className={`base base-${base}`}>{base}</span>
          <span className="eq" aria-hidden="true">=</span>
          <span className="pct">{formatPercent(counts[base] / seq.length)}</span>
        </span>
      ))}
    </div>
  );
}

function ConstructSummary({ circuit, prediction }) {
  const { length } = assembleCircuit(circuit);
  const status = circuitStatus(circuit);
  const gc = gcContent(circuit.map((p) => p.sequence).join(""));

  if (!circuit.length) {
    return (
      <div className="empty">
        <p className="empty-title">Nothing selected</p>
        <p className="empty-body">
          Pick a part in the library to read its details, or place one on the
          canvas and select it.
        </p>
      </div>
    );
  }

  return (
    <>
      <Section id="construct" title="Construct" tail={`${circuit.length} parts`}>
        <dl className="readout">
          <dt>Total length</dt>
          <dd>{length} bp</dd>
          <dt>GC content</dt>
          <dd>{gc != null ? formatPercent(gc, 1) : "n/a"}</dd>
          <dt>Status</dt>
          <dd>{status.label}</dd>
          <dt>Model run</dt>
          <dd>{prediction ? prediction.model : "not run"}</dd>
        </dl>
      </Section>
      <div className="empty">
        <p className="empty-body">
          Select a part on the canvas, or one in the library, to inspect it.
        </p>
      </div>
    </>
  );
}

function PartPerformance({ part, circuit, prediction }) {
  const metrics = predictedNodeMetrics(circuit, prediction);
  const metric = metrics[part.uid];
  const key = typeKey(part.part_type);

  if (!prediction) {
    return (
      <div className="empty" style={{ padding: "14px 4px" }}>
        <p className="empty-body">
          Run the model to see predicted behaviour for this part.
        </p>
      </div>
    );
  }

  if (!metric) {
    const reason =
      key === "terminator"
        ? "Termination is applied as a circuit-level efficiency factor, not a per-part score."
        : "The model scores the first part of each class in the construct. This one is downstream of another " +
          `${typeLabel(part.part_type).toLowerCase()}.`;
    return <p className="hint">{reason}</p>;
  }

  return (
    <div className="stack-sm" data-type={key}>
      <div className="metric-head" style={{ marginBottom: 0 }}>
        <span className="metric-label">{metric.label}</span>
        <span className={`prov prov-${metric.kind}`}>{metric.kind}</span>
      </div>
      <div className="metric-value">{metric.display}</div>
      {metric.fraction != null && (
        <>
          <div className="scale">
            <div
              className="scale-fill"
              style={{ width: `${metric.fraction * 100}%`, background: "var(--part)" }}
            />
          </div>
          <div className="scale-marks">
            <span>0</span>
            <span>1.0</span>
          </div>
        </>
      )}
      <p className="hint">
        Model estimate from {prediction.model}, not an experimental measurement.
      </p>
    </div>
  );
}

export default function Inspector({
  part,
  previewPart,
  index,
  circuit,
  prediction,
  onRemove,
  onDuplicate,
  onAddPreview,
  onFocusSequence,
  onOpenStructure,
  onClose,
}) {
  const [structureOpen, setStructureOpen] = useState(false);

  const subject = part || previewPart;
  const isPreview = !part && Boolean(previewPart);
  const subjectId = part?.uid || previewPart?.part_id || null;

  useEffect(() => {
    setStructureOpen(false);
  }, [subjectId]);

  const key = subject ? typeKey(subject.part_type) : "other";

  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">Inspector</h2>
        <div className="panel-head-actions">
          <button
            type="button"
            className="btn-icon drawer-close"
            onClick={onClose}
            aria-label="Close inspector"
          >
            <IconClose />
          </button>
        </div>
      </div>

      {!subject ? (
        <div className="panel-body">
          <ConstructSummary circuit={circuit} prediction={prediction} />
        </div>
      ) : (
        <>
          <div className="insp-head" data-type={key}>
            <div className="insp-head-top">
              <span className="type-tag" data-type={key}>
                {typeLabel(subject.part_type)}
              </span>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-4)" }}>
                {isPreview ? "library preview" : `position ${index + 1}`}
              </span>
            </div>
            <div className="insp-name">{partLabel(subject)}</div>
            <code className="insp-id">{subject.part_id}</code>
          </div>

          <div className="panel-body">
            {isPreview && (
              <div className="insp-actions insp-actions-top">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onAddPreview?.(subject)}
                  data-tip="Append this part to the construct"
                  data-tip-align="start"
                >
                  <IconPlus width={12} height={12} />
                  Add to circuit
                </button>
                <span className="hint">Not placed yet</span>
              </div>
            )}

            <Section id="identity" title="Identity">
              <dl className="readout">
                <dt>Class</dt>
                <dd>{typeLabel(subject.part_type)}</dd>
                <dt>Part ID</dt>
                <dd>{subject.part_id}</dd>
                <dt>Host</dt>
                <dd>{extractOrganism(subject.description, subject.source)}</dd>
                {!isPreview && (
                  <>
                    <dt>Position</dt>
                    <dd>
                      {index + 1} of {circuit.length}
                    </dd>
                  </>
                )}
              </dl>
              {subject.description && (
                <p className="hint" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  {stripDescription(subject.description)}
                </p>
              )}
            </Section>

            <Section
              id="sequence"
              title="Sequence"
              tail={`${sanitizeDna(subject.sequence).length} bp`}
            >
              <dl className="readout">
                <dt>Length</dt>
                <dd>{sanitizeDna(subject.sequence).length} bp</dd>
                <dt>GC content</dt>
                <dd>
                  {gcContent(subject.sequence) != null
                    ? formatPercent(gcContent(subject.sequence), 1)
                    : "n/a"}
                </dd>
              </dl>
              <div className="stack-sm" style={{ marginTop: 9 }}>
                <DnaStrands sequence={subject.sequence} />
                <div className="insp-inline-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      navigator.clipboard?.writeText(sanitizeDna(subject.sequence))
                    }
                    data-tip="Copy this part's DNA sequence"
                    data-tip-align="start"
                  >
                    <IconCopy width={12} height={12} />
                    Copy
                  </button>
                  {!isPreview && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={onFocusSequence}
                      data-tip="Highlight this region in the construct sequence"
                    >
                      <IconSearch width={12} height={12} />
                      Show in construct
                    </button>
                  )}
                </div>
              </div>
              <Composition sequence={subject.sequence} />
            </Section>

            {!isPreview && (
              <Section id="performance" title="Model output">
                <PartPerformance
                  part={subject}
                  circuit={circuit}
                  prediction={prediction}
                />
              </Section>
            )}

            <Section id="structure" title="Structure" defaultOpen={false}>
              {structureOpen ? (
                <Suspense
                  fallback={
                    <div className="loading-row">
                      <span className="pulse-bar" aria-hidden="true" />
                      Loading molecular viewer
                    </div>
                  }
                >
                  <PartViewer3D part={subject} variant="regulatory" compact />
                </Suspense>
              ) : (
                <div className="stack-sm">
                  <p className="hint">
                    Loads the reference structure recorded for this part class.
                  </p>
                  <div className="insp-inline-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setStructureOpen(true)}
                    >
                      Load 3D structure
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={onOpenStructure}
                    >
                      Open workspace
                    </button>
                  </div>
                </div>
              )}
            </Section>

            {!isPreview && (
              <div className="insp-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onDuplicate(subject)}
                  data-tip="Insert a copy directly after this part"
                  data-tip-align="start"
                >
                  <IconCopy width={12} height={12} />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onRemove(subject.uid)}
                >
                  <IconTrash width={12} height={12} />
                  Remove
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
