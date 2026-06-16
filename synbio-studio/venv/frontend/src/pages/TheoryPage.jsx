import { useState } from "react";
import {
  STEPS,
  STEP_RENDERS,
  PartChip,
} from "../components/theory/TheorySteps.jsx";
import "../theory.css";

export default function TheoryPage() {
  const [current, setCurrent] = useState(0);
  const StepComponent = STEP_RENDERS[current];
  const step = STEPS[current];

  return (
    <div className="page theory-page">
      <header className="theory-hero">
        <div className="theory-hero-eyebrow">GeneSmith — Theory</div>
        <h1>From DNA to protein</h1>
        <p className="theory-hero-lead">
          How a genetic circuit — promoter, RBS, gene, and terminator — works
          together to produce a protein. Walk through each molecular step.
        </p>
      </header>

      <nav className="theory-step-nav" aria-label="Theory steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`theory-step-link ${i === current ? "active" : ""} ${i < current ? "done" : ""}`}
            onClick={() => setCurrent(i)}
          >
            {i < current ? "✓ " : ""}
            {s.label}
          </button>
        ))}
      </nav>

      <article className="theory-stage" key={current}>
        <div className="theory-stage-header">
          <h2 className="theory-stage-title">{step.title}</h2>
          <p className="theory-stage-desc">{step.desc}</p>
        </div>

        <div className="theory-viz">
          <StepComponent />
        </div>

        <footer className="theory-nav-footer">
          <button
            type="button"
            className="theory-btn"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            Back
          </button>

          <button
            type="button"
            className="theory-btn theory-btn-primary"
            onClick={() => setCurrent((c) => Math.min(STEPS.length - 1, c + 1))}
            disabled={current === STEPS.length - 1}
          >
            {current === STEPS.length - 1 ? "Complete" : "Next"}
          </button>
        </footer>
      </article>

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
  );
}
