import CircuitHelixViewer from "../components/CircuitHelixViewer.jsx";
import ProteinViewer3D from "../components/ProteinViewer3D.jsx";
import PartViewer3D from "../components/PartViewer3D.jsx";
import { PartGlyphMini } from "../components/PartGlyph.jsx";
import { PART_TYPES, TYPE_LABEL, firstOfType, typeLabel } from "../utils/circuit.js";

function MissingPanel({ type }) {
  return (
    <div className="viewer viewer-sm" data-type={type}>
      <div className="viewer-head">
        <div className="viewer-titles">
          <div className="viewer-title">{TYPE_LABEL[type]} reference</div>
          <div className="viewer-subtitle">not in this construct</div>
        </div>
        <div className="viewer-tools">
          <PartGlyphMini partType={type} className="glyph missing-glyph" />
        </div>
      </div>
      <div className="viewer-stage">
        <div className="viewer-overlay">
          <div className="empty">
            <p className="empty-body">
              Add a {TYPE_LABEL[type].toLowerCase()} to the circuit to inspect
              its reference structure here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VisualizePage({
  circuit,
  predictResult,
  selectedUid,
  onNavigate,
}) {
  const promoter = firstOfType(circuit, "promoter");
  const rbs = firstOfType(circuit, "rbs");
  const gene = firstOfType(circuit, "gene");
  const terminator = firstOfType(circuit, "terminator");

  const aminoAcidSequence = predictResult?.amino_acid_sequence || "";
  const proteinCanBeProduced =
    predictResult?.protein_can_be_produced ?? (gene && !rbs ? false : null);

  if (!circuit.length) {
    return (
      <div className="page-scroll">
        <div className="page-wrap">
          <header className="page-head">
            <div>
              <h1>Structure workspace</h1>
              <p>
                Molecular models for the construct, its regulatory parts and the
                protein it encodes.
              </p>
            </div>
          </header>

          <div className="empty" style={{ padding: "60px 20px" }}>
            <p className="empty-title">Nothing to visualise yet</p>
            <p className="empty-body">
              Build a circuit on the Build tab and run the model. The assembled
              DNA, its regulatory parts and the predicted protein structure all
              appear here.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate("home")}
              style={{ marginTop: 8 }}
            >
              Go to the circuit builder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-scroll">
      <div className="page-wrap">
        <header className="page-head">
          <div>
            <h1>Structure workspace</h1>
            <p>
              The same construct seen at three levels: the assembled DNA, the
              reference structures of its regulatory parts, and the protein its
              coding sequence produces.
            </p>
          </div>
          <div className="page-head-actions">
            <span className="chip mono">{circuit.length} parts</span>
            {aminoAcidSequence && (
              <span className="chip mono">{aminoAcidSequence.length} aa</span>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate("home")}
            >
              Back to builder
            </button>
          </div>
        </header>

        <div className="grid-2">
          <CircuitHelixViewer circuit={circuit} selectedUid={selectedUid} />
          <ProteinViewer3D
            aminoAcidSequence={aminoAcidSequence}
            genePart={gene}
            circuit={circuit}
            proteinCanBeProduced={proteinCanBeProduced}
            large
          />
        </div>

        <div className="section-label-row">
          <div className="sub-label">Regulatory parts</div>
          <p className="hint">
            Reference structures for the part classes in this construct — these
            are deposited models of the machinery each part recruits, not of the
            part's own DNA.
          </p>
        </div>

        <div className="grid-3">
          {[
            ["promoter", promoter],
            ["rbs", rbs],
            ["terminator", terminator],
          ].map(([type, part]) =>
            part ? (
              <PartViewer3D
                key={type}
                part={part}
                variant="regulatory"
                compact
              />
            ) : (
              <MissingPanel key={type} type={type} />
            ),
          )}
        </div>

        <div className="pipeline" style={{ marginTop: 16 }}>
          {PART_TYPES.map((type) => {
            const part = firstOfType(circuit, type);
            return (
              <div
                key={type}
                className={`pipeline-step ${part ? "done" : ""}`}
                data-type={type}
              >
                <span className="idx">{typeLabel(type)}</span>
                <span className="name">{part ? part.part_id : "—"}</span>
                <span className="val">
                  {part ? `${(part.sequence || "").length} bp` : "not placed"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
