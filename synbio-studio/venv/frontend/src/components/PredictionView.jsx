import { useState } from "react";
import { typeKey, typeLabel } from "../utils/circuit.js";
import { sanitizeDna } from "../utils/previewHelix.js";
import { IconAlert, IconCaret } from "./Icons.jsx";

const TIPS = {
  yield:
    "Relative protein yield on a 0–1 scale: promoter strength × translation rate × coding-sequence factor.",
  rpu: "Relative Promoter Units — transcription initiation rate relative to a reference promoter.",
  translation:
    "Normalised translation initiation rate predicted from the RBS sequence.",
  length:
    "Residue count of the protein translated from the coding sequence, stop codon excluded.",
  ci: "Model interval around the yield estimate, not an experimental error bar.",
};

function Metric({
  label,
  value,
  unit,
  tip,
  provenance,
  fraction,
  band,
  scaleMax = "1.0",
  foot,
}) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span className="metric-label">
          {label}
          {tip && (
            <span
              className="info-dot"
              data-tip={tip}
              data-tip-pos="below"
              tabIndex={0}
              role="note"
            >
              i
            </span>
          )}
        </span>
        {provenance && <span className={`prov prov-${provenance}`}>{provenance}</span>}
      </div>

      {value == null ? (
        <div className="metric-value metric-none">—</div>
      ) : (
        <div className="metric-value">
          {value}
          {unit && <span className="metric-unit">{unit}</span>}
        </div>
      )}

      {fraction != null && (
        <>
          <div className="scale">
            {band && (
              <div
                className="scale-band"
                style={{
                  left: `${band[0] * 100}%`,
                  width: `${Math.max(1, (band[1] - band[0]) * 100)}%`,
                }}
              />
            )}
            <div className="scale-fill" style={{ width: `${fraction * 100}%` }} />
          </div>
          <div className="scale-marks">
            <span>0</span>
            <span>{scaleMax}</span>
          </div>
        </>
      )}

      {foot && <div className="metric-foot">{foot}</div>}
    </div>
  );
}

function PartsUsed({ parts }) {
  if (!parts?.length) return null;
  return (
    <div className="stack-sm">
      <div className="sub-label">Parts used by the model</div>
      <div className="used-table" role="table">
        <div className="used-row used-head" role="row">
          <span role="columnheader">Class</span>
          <span role="columnheader">Part</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Length</span>
        </div>
        {parts.map((part, index) => (
          <div
            className="used-row"
            role="row"
            key={`${part.part_id}-${index}`}
            data-type={typeKey(part.part_type)}
          >
            <span role="cell">
              <span className="type-tag">{typeLabel(part.part_type)}</span>
            </span>
            <span role="cell" className="mono">
              {part.part_id}
            </span>
            <span role="cell" className="used-name">
              {part.name}
            </span>
            <span role="cell" className="mono">
              {sanitizeDna(part.sequence).length} bp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CircuitMap({ svg }) {
  const [open, setOpen] = useState(false);
  if (!svg) return null;
  return (
    <div className="stack-sm">
      <button
        type="button"
        className="disclosure"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconCaret className={`caret ${open ? "open" : ""}`} />
        Circuit map returned by the model
      </button>
      {open && (
        <div className="svg-plate" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}

export default function PredictionView({
  predictResult,
  error,
  loading,
  circuit,
  onOpenStructure,
}) {
  const prediction = predictResult?.prediction;

  if (loading) {
    return (
      <div className="stack">
        <div className="loading-row">
          <span className="pulse-bar" aria-hidden="true" />
          Calculating predicted expression…
        </div>
        <div className="metric-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notice notice-err">
        <span className="ico">
          <IconAlert />
        </span>
        <span>{error}</span>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="empty">
        <p className="empty-title">No prediction yet</p>
        <p className="empty-body">
          {circuit?.length
            ? "Run the model to estimate promoter strength, translation rate and relative protein yield for this construct."
            : "Add enough circuit information — at minimum a promoter — to generate a prediction."}
        </p>
      </div>
    );
  }

  const status = prediction.circuit_status || {};
  const proteinYield = prediction.protein_yield?.relative_yield ?? null;
  const promoterRpu = prediction.promoter_strength?.rpu ?? null;
  const translation = prediction.translation_rate?.value ?? null;
  const proteinLength = prediction.protein_yield?.amino_acid_length ?? null;
  const ci = prediction.confidence_interval;
  const scope = status.prediction_scope;

  return (
    <div className="stack">
      {status.warnings?.length > 0 && (
        <div className="stack-sm">
          {status.warnings.map((warning) => (
            <div className="notice notice-warn" key={warning}>
              <span className="ico">
                <IconAlert />
              </span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="metric-grid">
        <Metric
          label="Protein yield"
          value={proteinYield != null ? proteinYield.toFixed(3) : null}
          unit="relative"
          tip={TIPS.yield}
          provenance="predicted"
          fraction={proteinYield}
          band={ci && proteinYield != null ? ci : null}
          foot={
            ci ? (
              <>
                <span
                  className="ci-swatch"
                  aria-hidden="true"
                  data-tip={TIPS.ci}
                />
                interval {ci[0]}–{ci[1]}
              </>
            ) : proteinYield == null ? (
              "Needs an RBS and a coding sequence"
            ) : null
          }
        />

        <Metric
          label="Promoter strength"
          value={promoterRpu != null ? promoterRpu.toFixed(3) : null}
          unit="RPU"
          tip={TIPS.rpu}
          provenance="predicted"
          fraction={promoterRpu != null ? Math.min(promoterRpu, 1) : null}
          foot={`Model ${prediction.model}`}
        />

        <Metric
          label="Translation rate"
          value={translation != null ? translation.toFixed(3) : null}
          unit="normalised"
          tip={TIPS.translation}
          provenance="predicted"
          fraction={translation}
          foot={
            prediction.translation_rate?.model
              ? `Model ${prediction.translation_rate.model}`
              : "No RBS in construct"
          }
        />

        <Metric
          label="Protein length"
          value={proteinLength != null ? proteinLength : null}
          unit="aa"
          tip={TIPS.length}
          provenance="computed"
          foot={
            prediction.protein_yield?.terminator_efficiency
              ? `Termination ${prediction.protein_yield.terminator_efficiency}`
              : null
          }
        />
      </div>

      <div className="stack-sm">
        <div className="sub-label">Model context</div>
        <dl className="readout readout-wide">
          <dt>Prediction scope</dt>
          <dd>{scope || "—"}</dd>
          <dt>Expression model</dt>
          <dd>{prediction.model}</dd>
          <dt>Coding-sequence factor</dt>
          <dd>{prediction.protein_yield?.cds_expressibility_factor ?? "—"}</dd>
          <dt>Terminator efficiency</dt>
          <dd>{prediction.protein_yield?.terminator_efficiency ?? "—"}</dd>
          <dt>Calibration</dt>
          <dd>
            {prediction.protein_yield?.calibrated
              ? "calibrated"
              : "uncalibrated — relative values only"}
          </dd>
        </dl>
      </div>

      <PartsUsed parts={predictResult?.parts_detail} />
      <CircuitMap svg={predictResult?.circuit_svg} />

      {predictResult?.amino_acid_sequence && onOpenStructure && (
        <div>
          <button type="button" className="btn" onClick={onOpenStructure}>
            Open structure workspace
          </button>
        </div>
      )}
    </div>
  );
}
