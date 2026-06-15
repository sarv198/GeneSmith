import CircuitDiagram from "./CircuitDiagram.jsx";
import ProteinViewer3D from "./ProteinViewer3D.jsx";

function NullMetric({ label, missingPart }) {
  return (
    <div className="metric null-metric">
      <span>{label}</span>
      <strong>—</strong>
      <span className="requires-badge">Requires {missingPart}</span>
    </div>
  );
}

export default function PredictionPanel({ predictResult, error }) {
  const prediction = predictResult?.prediction;
  const genePart = predictResult?.parts_detail?.find(
    (part) => part.part_type === "cds" || part.part_type === "gene",
  );
  const aminoAcidSequence = predictResult?.amino_acid_sequence;

  if (error) return <p className="error">{error}</p>;
  if (!prediction) {
    return <p className="hint">Add a promoter and click Predict expression.</p>;
  }

  const status = prediction.circuit_status;
  const translationValue = prediction.translation_rate?.value ?? null;
  const proteinYield =
    prediction.protein_yield?.relative_yield ?? prediction.expression_level ?? null;

  return (
    <div className="prediction-result">
      {status && (
        <div className="circuit-status-block">
          <span
            className={`status-badge ${status.is_complete ? "ok" : "warn-partial"}`}
          >
            {status.is_complete ? "Circuit Complete" : "Partial Circuit"}
          </span>
          {!status.is_complete && status.warnings?.length > 0 && (
            <ul className="warning-list">
              {status.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {proteinYield != null ? (
        <div className="metric">
          <span>Protein yield (relative)</span>
          <strong>{proteinYield}</strong>
          {prediction.confidence_interval && (
            <small>
              CI: {prediction.confidence_interval[0]} – {prediction.confidence_interval[1]}
            </small>
          )}
        </div>
      ) : (
        <NullMetric label="Protein yield (relative)" missingPart="gene" />
      )}

      {prediction.promoter_strength?.rpu != null ? (
        <div className="metric">
          <span>Promoter strength</span>
          <strong>{prediction.promoter_strength.rpu} RPU</strong>
        </div>
      ) : (
        <NullMetric label="Promoter strength" missingPart="promoter" />
      )}

      {translationValue != null ? (
        <div className="metric">
          <span>Translation rate</span>
          <strong>
            {translationValue} ({prediction.translation_rate?.model || "model"})
          </strong>
        </div>
      ) : (
        <NullMetric label="Translation rate" missingPart="RBS" />
      )}

      {prediction.protein_yield?.amino_acid_length != null && (
        <>
          <div className="metric">
            <span>Protein length</span>
            <strong>{prediction.protein_yield.amino_acid_length} aa</strong>
          </div>
          {prediction.protein_yield.amino_acid_sequence && (
            <div className="metric seq-metric">
              <span>Amino acid sequence</span>
              <code>{prediction.protein_yield.amino_acid_sequence}</code>
            </div>
          )}
        </>
      )}

      <div className="metric">
        <span>Model</span>
        <strong>{prediction.model}</strong>
      </div>

      {prediction.protein_yield?.note && (
        <p className="hint">{prediction.protein_yield.note}</p>
      )}

      {genePart && aminoAcidSequence && (
        <ProteinViewer3D
          aminoAcidSequence={aminoAcidSequence}
          genePart={genePart}
        />
      )}

      <CircuitDiagram
        circuitSvg={predictResult?.circuit_svg}
        partIds={predictResult?.parts}
        parts={predictResult?.parts_detail}
      />
    </div>
  );
}
