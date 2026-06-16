import CircuitDiagram from "./CircuitDiagram.jsx";
import { aminoAcidColor } from "../utils/aminoAcidColors.js";

function Metric({ label, value, fallback = "—" }) {
  return (
    <div className="output-metric">
      <span className="output-metric-label">{label}</span>
      <strong className="output-metric-value">{value ?? fallback}</strong>
    </div>
  );
}

function ProteinSequence({ sequence }) {
  if (!sequence) return <p className="hint">No protein sequence available.</p>;
  const lines = [];
  for (let i = 0; i < sequence.length; i += 10) {
    lines.push(sequence.slice(i, i + 10));
  }
  return (
    <div className="output-protein-seq">
      {lines.map((line, lineIndex) => {
        const offset = lineIndex * 10;
        return (
          <div key={offset} className="aa-line">
            <span className="aa-line-number">{offset + 1}</span>
            {line.split("").map((residue, index) => (
              <span
                key={`${offset}-${index}`}
                className="aa-residue"
                style={{ color: aminoAcidColor(residue) }}
              >
                {residue}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function PredictionPanel({
  predictResult,
  error,
  loading,
  onVisualize,
}) {
  const prediction = predictResult?.prediction;
  const aminoAcidSequence =
    predictResult?.amino_acid_sequence ||
    prediction?.protein_yield?.amino_acid_sequence?.replace("…", "") ||
    "";

  if (error) {
    return (
      <section className="output-panel">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!prediction && !error && !loading) {
    return null;
  }

  if (loading) {
    return (
      <section className="output-panel">
        <p className="hint">Running prediction…</p>
      </section>
    );
  }

  if (!prediction) {
    return null;
  }

  const proteinYield =
    prediction.protein_yield?.relative_yield ?? prediction.expression_level ?? null;
  const promoterRpu = prediction.promoter_strength?.rpu ?? null;
  const translationRate = prediction.translation_rate?.value ?? null;
  const proteinLength = prediction.protein_yield?.amino_acid_length ?? null;

  return (
    <section className="output-panel">
      <div className="output-metrics-row">
        <Metric label="PROTEIN YIELD" value={proteinYield} />
        <Metric
          label="PROMOTER STRENGTH"
          value={promoterRpu != null ? `${promoterRpu} RPU` : null}
        />
        <Metric label="TRANSLATION RATE" value={translationRate} />
        <Metric
          label="PROTEIN LENGTH"
          value={proteinLength != null ? `${proteinLength} aa` : null}
        />
        <Metric label="MODEL" value={prediction.model} />
      </div>

      <div className="output-circuit-map">
        <h3 className="output-subtitle">CIRCUIT MAP</h3>
        <CircuitDiagram
          circuitSvg={predictResult?.circuit_svg}
          partIds={predictResult?.parts}
          parts={predictResult?.parts_detail}
          showHelix={false}
        />
      </div>

      <div className="output-protein-block">
        <h3 className="output-subtitle">PROTEIN SEQUENCE</h3>
        <ProteinSequence sequence={aminoAcidSequence} />
      </div>

      {onVisualize && (
        <div className="output-visualize-row">
          <button
            type="button"
            className="btn-visualize-3d"
            onClick={onVisualize}
          >
            3D Visualization
          </button>
        </div>
      )}
    </section>
  );
}
