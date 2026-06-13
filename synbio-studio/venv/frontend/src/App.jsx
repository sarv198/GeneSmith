import { useCallback, useEffect, useState } from "react";
import { PART_LIBRARY } from "./data/parts.js";

const API_BASE = "/api";

function PartCard({ part, draggable = true }) {
  return (
    <div
      className={`part-card type-${part.part_type}`}
      style={{ borderLeftColor: part.color }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify(part));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <span className="part-type">{part.part_type}</span>
      <strong>{part.label}</strong>
      <code>{part.part_id}</code>
    </div>
  );
}

export default function App() {
  const [circuit, setCircuit] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [modelStatus, setModelStatus] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/model/status`)
      .then((r) => r.json())
      .then(setModelStatus)
      .catch(() => setModelStatus({ model_loaded: false, mode: "offline" }));
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const part = JSON.parse(e.dataTransfer.getData("application/json"));
      setCircuit((prev) => [...prev, { ...part, uid: crypto.randomUUID() }]);
      setPrediction(null);
    } catch {
      setError("Could not read dropped part.");
    }
  }, []);

  const removePart = (uid) => {
    setCircuit((prev) => prev.filter((p) => p.uid !== uid));
    setPrediction(null);
  };

  const clearCircuit = () => {
    setCircuit([]);
    setPrediction(null);
  };

  const predict = async () => {
    setLoading(true);
    setError(null);
    try {
      const parts = circuit.map(({ part_id, part_type, sequence }) => ({
        part_id,
        part_type,
        sequence,
      }));
      const res = await fetch(`${API_BASE}/circuits/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setPrediction(data.prediction);
    } catch (err) {
      setError(err.message || "Prediction failed. Is the API running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  const fullSequence = circuit.map((p) => p.sequence).join("");

  return (
    <div className="app">
      <header>
        <h1>GeneSmith</h1>
        <p>Drag DNA parts into the circuit, then predict expression.</p>
        {modelStatus && (
          <div className={`status-badge ${modelStatus.model_loaded ? "ok" : "warn"}`}>
            Model: {modelStatus.mode || "unknown"}
            {modelStatus.features_count ? ` · ${modelStatus.features_count} features` : ""}
          </div>
        )}
      </header>

      <main className="layout">
        <aside className="palette">
          <h2>Parts library</h2>
          <p className="hint">Drag parts onto the circuit</p>
          {PART_LIBRARY.map((part) => (
            <PartCard key={part.part_id} part={part} />
          ))}
        </aside>

        <section
          className={`canvas ${dragOver ? "drag-over" : ""} ${circuit.length === 0 ? "empty" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="canvas-header">
            <h2>Circuit</h2>
            <div className="canvas-actions">
              <button type="button" onClick={clearCircuit} disabled={!circuit.length}>
                Clear
              </button>
              <button
                type="button"
                className="primary"
                onClick={predict}
                disabled={!circuit.length || loading}
              >
                {loading ? "Predicting…" : "Predict expression"}
              </button>
            </div>
          </div>

          {circuit.length === 0 ? (
            <p className="drop-hint">Drop parts here to build your construct</p>
          ) : (
            <ol className="circuit-list">
              {circuit.map((part, i) => (
                <li key={part.uid} className="circuit-item">
                  <span className="index">{i + 1}</span>
                  <div
                    className="circuit-part"
                    style={{ borderColor: part.color }}
                  >
                    <span className="part-type">{part.part_type}</span>
                    <strong>{part.label}</strong>
                    <span className="seq-preview">
                      {part.sequence.slice(0, 40)}
                      {part.sequence.length > 40 ? "…" : ""}
                    </span>
                  </div>
                  <button type="button" className="remove" onClick={() => removePart(part.uid)}>
                    ×
                  </button>
                </li>
              ))}
            </ol>
          )}

          {fullSequence && (
            <div className="full-sequence">
              <h3>Full sequence ({fullSequence.length} bp)</h3>
              <code>{fullSequence}</code>
            </div>
          )}
        </section>

        <aside className="prediction-panel">
          <h2>Prediction</h2>
          {error && <p className="error">{error}</p>}
          {prediction ? (
            <div className="prediction-result">
              <div className="metric">
                <span>Expression</span>
                <strong>{prediction.expression_level} {prediction.unit}</strong>
              </div>
              <div className="metric">
                <span>Confidence</span>
                <strong>
                  {prediction.confidence_interval[0]} – {prediction.confidence_interval[1]}
                </strong>
              </div>
              <div className="metric">
                <span>Model</span>
                <strong>{prediction.model}</strong>
              </div>
            </div>
          ) : (
            <p className="hint">Add a promoter and click Predict expression.</p>
          )}
        </aside>
      </main>
    </div>
  );
}
