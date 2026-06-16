import CircuitHelixViewer from "../components/CircuitHelixViewer.jsx";
import ProteinViewer3D from "../components/ProteinViewer3D.jsx";
import PartViewer3D from "../components/PartViewer3D.jsx";

function findPart(circuit, type) {
  const aliases =
    type === "cds" || type === "gene"
      ? ["cds", "gene"]
      : [type];
  return circuit.find((p) =>
    aliases.includes((p.part_type || "").toLowerCase()),
  );
}

export default function VisualizePage({ circuit, predictResult }) {
  const promoter = findPart(circuit, "promoter");
  const rbs = findPart(circuit, "rbs");
  const gene = findPart(circuit, "gene");
  const terminator = findPart(circuit, "terminator");

  const aminoAcidSequence =
    predictResult?.amino_acid_sequence ||
    predictResult?.prediction?.protein_yield?.amino_acid_sequence?.replace(
      "…",
      "",
    ) ||
    "";

  if (!circuit.length) {
    return (
      <div className="page visualize-page">
        <header className="visualize-header">
          <h1>3D Visualization</h1>
          <p className="hint">
            Build a circuit on the Build page and run Predict, then open 3D
            Visualization from the results.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="page visualize-page">
      <header className="visualize-header">
        <h1>3D Visualization</h1>
        <p className="visualize-header-desc">
          Structural models for your circuit assembly, predicted protein product,
          and individual regulatory parts.
        </p>
      </header>

      <div className="visualize-grid visualize-grid-top">
        <CircuitHelixViewer circuit={circuit} />
        <ProteinViewer3D
          aminoAcidSequence={aminoAcidSequence}
          genePart={gene}
          large
        />
      </div>

      <div className="visualize-grid visualize-grid-bottom">
        {promoter ? (
          <PartViewer3D part={promoter} variant="regulatory" compact />
        ) : (
          <div className="visualize-panel visualize-panel-small">
            <h3 className="visualize-panel-title">Promoter</h3>
            <p className="hint">No promoter in circuit.</p>
          </div>
        )}
        {rbs ? (
          <PartViewer3D part={rbs} variant="regulatory" compact />
        ) : (
          <div className="visualize-panel visualize-panel-small">
            <h3 className="visualize-panel-title">RBS</h3>
            <p className="hint">No RBS in circuit.</p>
          </div>
        )}
        {terminator ? (
          <PartViewer3D part={terminator} variant="regulatory" compact />
        ) : (
          <div className="visualize-panel visualize-panel-small">
            <h3 className="visualize-panel-title">Terminator</h3>
            <p className="hint">No terminator in circuit.</p>
          </div>
        )}
      </div>
    </div>
  );
}
