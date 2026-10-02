import { useEffect, useRef, useState } from "react";
import PreviewPanel from "./PreviewPanel.jsx";
import PredictionView from "./PredictionView.jsx";
import ProteinView from "./ProteinView.jsx";
import SequenceView from "./SequenceView.jsx";
import { assembleCircuit, circuitStatus, firstOfType } from "../utils/circuit.js";
import { IconCollapse, IconExpand, IconRun } from "./Icons.jsx";

/** The layer stack the app actually models, with live values attached. */
function Pipeline({ circuit, predictResult, onGo }) {
  const prediction = predictResult?.prediction;
  const { length } = assembleCircuit(circuit);
  const translation = prediction?.translation_rate?.value ?? null;
  const aa = predictResult?.amino_acid_sequence?.length ?? null;

  const steps = [
    {
      id: "circuit",
      name: "Circuit",
      value: circuit.length ? `${circuit.length} parts` : "no parts",
      done: circuit.length > 0,
      go: null,
    },
    {
      id: "sequence",
      name: "DNA",
      value: length ? `${length} bp` : "—",
      done: length > 0,
      go: "sequence",
    },
    {
      id: "translation",
      name: "RNA · translation",
      value:
        translation != null
          ? `rate ${translation}`
          : firstOfType(circuit, "rbs")
            ? "run model"
            : "needs RBS",
      done: translation != null,
      go: "prediction",
    },
    {
      id: "protein",
      name: "Protein",
      value: aa ? `${aa} aa` : firstOfType(circuit, "gene") ? "run model" : "needs gene",
      done: Boolean(aa),
      go: "protein",
    },
    {
      id: "structure",
      name: "Structure",
      value: aa ? "available" : "—",
      done: Boolean(aa),
      go: "structure-page",
    },
  ];

  return (
    <div className="pipeline">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          className={`pipeline-step ${step.done ? "done" : ""} ${step.go ? "go" : ""}`}
          onClick={() => step.go && onGo(step.go)}
          disabled={!step.go}
        >
          <span className="idx">{String(index + 1).padStart(2, "0")}</span>
          <span className="name">{step.name}</span>
          <span className="val">{step.value}</span>
        </button>
      ))}
    </div>
  );
}

function Overview({
  circuit,
  predictResult,
  onGo,
  onPredict,
  canPredict,
  onOpenStructure,
}) {
  const status = circuitStatus(circuit);
  const prediction = predictResult?.prediction;

  return (
    <div className="stack">
      <Pipeline
        circuit={circuit}
        predictResult={predictResult}
        onGo={(target) =>
          target === "structure-page" ? onOpenStructure?.() : onGo(target)
        }
      />

      {!circuit.length ? (
        <div className="empty">
          <p className="empty-title">Nothing to analyse yet</p>
          <p className="empty-body">
            Place parts on the canvas. As the construct grows, its DNA,
            predicted expression and protein product appear in these tabs.
          </p>
        </div>
      ) : (
        <div className="overview-grid">
          <div className="stack-sm">
            <div className="sub-label">Assembly</div>
            <dl className="readout">
              <dt>Status</dt>
              <dd>{status.label}</dd>
              <dt>Detail</dt>
              <dd>{status.detail}</dd>
            </dl>
          </div>

          <div className="stack-sm">
            <div className="sub-label">Next step</div>
            {prediction ? (
              <p className="hint">
                Model run complete. Open Prediction for the expression
                estimates, or Protein for the translated product.
              </p>
            ) : (
              <>
                <p className="hint">
                  {canPredict
                    ? "The construct has a promoter — run the model to estimate expression."
                    : "Add a promoter: the expression model needs one before it can run."}
                </p>
                {canPredict && (
                  <div>
                    <button type="button" className="btn btn-sm" onClick={onPredict}>
                      Run model
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Shown in Prediction and Protein before the model has produced anything. */
function RunPrompt({ onPredict, canPredict }) {
  return (
    <div className="run-prompt">
      <button
        type="button"
        className="btn btn-primary"
        onClick={onPredict}
        disabled={!canPredict}
        data-tip={
          canPredict
            ? "Run the expression model on this construct"
            : "Add a promoter to enable prediction"
        }
      >
        <IconRun width={12} height={12} />
        Run model
      </button>
      <span className="run-prompt-text">to see output</span>
    </div>
  );
}

export default function AnalysisDock({
  circuit,
  predictResult,
  loading,
  error,
  selectedUid,
  onSelect,
  onPredict,
  canPredict,
  onOpenStructure,
  activeTab,
  onTabChange,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const focusToken = useRef(0);
  const { length } = assembleCircuit(circuit);
  const aminoAcidSequence = predictResult?.amino_acid_sequence || "";

  const hasRun = Boolean(predictResult || loading || error);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "sequence", label: "Sequence", badge: length > 0 },
    {
      id: "prediction",
      label: "Prediction",
      badge: Boolean(predictResult?.prediction),
    },
    {
      id: "protein",
      label: "Protein",
      badge: Boolean(aminoAcidSequence),
    },
    { id: "model", label: "Construct 3D" },
  ];

  // Selecting a part in the canvas pulls the sequence tab forward.
  useEffect(() => {
    if (!selectedUid) return;
    focusToken.current += 1;
  }, [selectedUid]);

  const active = tabs.some((tab) => tab.id === activeTab) ? activeTab : "overview";
  const awaitingRun = (active === "prediction" || active === "protein") && !hasRun;

  return (
    <section className={`dock ${collapsed ? "collapsed" : ""}`} aria-label="Analysis">
      <div className="dock-tabs" role="tablist" aria-label="Analysis views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`dock-tab ${active === tab.id ? "active" : ""}`}
            onClick={() => {
              onTabChange(tab.id);
              setCollapsed(false);
            }}
          >
            {tab.label}
            {tab.badge && <span className="tab-dot" aria-hidden="true" />}
          </button>
        ))}

        <div className="dock-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onPredict}
            disabled={!canPredict || loading}
            data-tip={
              canPredict
                ? "Run the expression model on this construct"
                : "Add a promoter to enable prediction"
            }
            data-tip-align="end"
          >
            <IconRun width={11} height={11} />
            {loading ? "Running…" : "Run model"}
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand analysis panel" : "Collapse analysis panel"}
            data-tip={collapsed ? "Expand" : "Collapse"}
            data-tip-align="end"
          >
            {collapsed ? <IconExpand /> : <IconCollapse />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          className={`dock-body ${active === "model" ? "dock-body-fill" : ""} ${
            awaitingRun ? "dock-body-center" : ""
          }`}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          tabIndex={0}
        >
          {active === "overview" && (
            <Overview
              circuit={circuit}
              predictResult={predictResult}
              onGo={onTabChange}
              onPredict={onPredict}
              canPredict={canPredict}
              onOpenStructure={onOpenStructure}
            />
          )}

          {active === "sequence" && (
            <SequenceView
              circuit={circuit}
              selectedUid={selectedUid}
              onSelect={onSelect}
              focusToken={focusToken.current}
            />
          )}

          {active === "prediction" && !hasRun && (
            <RunPrompt onPredict={onPredict} canPredict={canPredict} />
          )}

          {active === "prediction" && hasRun && (
            <PredictionView
              predictResult={predictResult}
              error={error}
              loading={loading}
              circuit={circuit}
              onOpenStructure={onOpenStructure}
            />
          )}

          {active === "protein" && !hasRun && (
            <RunPrompt onPredict={onPredict} canPredict={canPredict} />
          )}

          {active === "protein" && hasRun && (
            <ProteinView
              aminoAcidSequence={aminoAcidSequence}
              circuit={circuit}
              proteinCanBeProduced={predictResult?.protein_can_be_produced}
              onOpenStructure={onOpenStructure}
            />
          )}

          {active === "model" && (
            <PreviewPanel circuit={circuit} selectedUid={selectedUid} />
          )}
        </div>
      )}
    </section>
  );
}
