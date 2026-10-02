import { useState } from "react";
import {
  STEPS,
  STEP_RENDERS,
  PartChip,
} from "../components/theory/TheorySteps.jsx";
import { IconArrowRight, IconChevronLeft } from "../components/Icons.jsx";
import "../theory.css";

/** Which molecular layer each step operates on. */
const LAYERS = ["DNA", "RNA", "Protein", "Structure"];
const STEP_LAYER = {
  circuit: "DNA",
  sigma: "DNA",
  transcription: "RNA",
  mrna: "RNA",
  ribosome: "Protein",
  translation: "Protein",
  protein: "Structure",
};

export default function TheoryPage({ onNavigate }) {
  const [current, setCurrent] = useState(0);
  const StepComponent = STEP_RENDERS[current];
  const step = STEPS[current];
  const activeLayer = STEP_LAYER[step.id];

  return (
    <div className="page-scroll">
      <div className="page-wrap">
        <header className="page-head">
          <div>
            <h1>From genetic design to protein expression</h1>
            <p>
              What each part of a circuit actually does inside the cell — the
              promoter that starts transcription, the RBS that recruits the
              ribosome, the gene that carries the code, and the terminator that
              stops it. Every step here corresponds to something GeneSmith
              models.
            </p>
          </div>
          <div className="page-head-actions">
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate("home")}
            >
              Open the builder
              <IconArrowRight width={12} height={12} />
            </button>
          </div>
        </header>

        <div className="theory-layout">
          <nav className="theory-rail" aria-label="Theory steps">
            <div className="theory-rail-label">Walkthrough</div>
            {STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`theory-step-link ${index === current ? "active" : ""} ${
                  index < current ? "done" : ""
                }`}
                aria-current={index === current ? "step" : undefined}
                onClick={() => setCurrent(index)}
              >
                <span className="theory-step-num">{index + 1}</span>
                <span>
                  {item.label}
                  <span className="theory-step-tag">{item.tag}</span>
                </span>
              </button>
            ))}

            <div className="theory-layer-strip" aria-hidden="true">
              {LAYERS.map((layer) => (
                <span
                  key={layer}
                  className={`theory-layer ${layer === activeLayer ? "on" : ""}`}
                >
                  {layer}
                </span>
              ))}
            </div>
          </nav>

          <article className="theory-stage" key={current}>
            <div className="theory-stage-header">
              <div className="theory-stage-eyebrow">{step.tag}</div>
              <h2 className="theory-stage-title">{step.title}</h2>
              <p className="theory-stage-desc">{step.desc}</p>
            </div>

            <div className="theory-viz">
              <StepComponent />
            </div>

            {step.link && (
              <div className="theory-connector">
                <span className="eyebrow">In GeneSmith</span>
                <span>{step.link}</span>
              </div>
            )}

            <footer className="theory-nav-footer">
              <button
                type="button"
                className="theory-btn"
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
              >
                <IconChevronLeft width={12} height={12} />
                Back
              </button>
              <span className="spacer" />
              <span className="theory-progress">
                {String(current + 1).padStart(2, "0")} /{" "}
                {String(STEPS.length).padStart(2, "0")}
              </span>
              <span className="spacer" />
              {current === STEPS.length - 1 ? (
                <button
                  type="button"
                  className="theory-btn theory-btn-primary"
                  onClick={() => onNavigate("home")}
                >
                  Start designing
                  <IconArrowRight width={12} height={12} />
                </button>
              ) : (
                <button
                  type="button"
                  className="theory-btn theory-btn-primary"
                  onClick={() =>
                    setCurrent((c) => Math.min(STEPS.length - 1, c + 1))
                  }
                >
                  Next
                  <IconArrowRight width={12} height={12} />
                </button>
              )}
            </footer>
          </article>
        </div>

        <aside className="theory-legend">
          <div className="theory-legend-label">Circuit part legend</div>
          <div className="theory-legend-chips">
            <PartChip type="promoter" label="Promoter — transcription signal" />
            <PartChip type="rbs" label="RBS — ribosome binding" />
            <PartChip type="gene" label="Gene (CDS) — protein blueprint" />
            <PartChip type="term" label="Terminator — transcription end" />
          </div>
        </aside>
      </div>
    </div>
  );
}
