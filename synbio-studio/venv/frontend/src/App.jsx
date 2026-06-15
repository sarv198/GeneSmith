import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client.js";
import TraitRecommender from "./components/TraitRecommender.jsx";
import PartsSidebar from "./components/PartsSidebar.jsx";
import CircuitCanvas from "./components/CircuitCanvas.jsx";
import PredictionPanel from "./components/PredictionPanel.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

export default function App() {
  const [circuit, setCircuit] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partsRefreshKey, setPartsRefreshKey] = useState(0);

  useEffect(() => {
    api
      .get("/model/status")
      .then(({ data }) => setModelStatus(data))
      .catch(() => setModelStatus({ model_loaded: false, mode: "offline" }));
  }, []);

  const onAddPart = useCallback((part) => {
    setCircuit((prev) => [
      ...prev,
      { ...part, uid: part.uid || crypto.randomUUID() },
    ]);
    setPrediction(null);
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
      const { data } = await api.post("/circuits/predict", { parts });
      setPrediction(data.prediction);
    } catch (err) {
      const msg =
        err.response?.data?.detail?.error ||
        err.message ||
        "Prediction failed. Is the API running on port 8000?";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>GeneSmith</h1>
        <p>Drag DNA parts into the circuit, then predict expression.</p>
        {modelStatus && (
          <div className={`status-badge ${modelStatus.model_loaded ? "ok" : "warn"}`}>
            Model: {modelStatus.mode || "unknown"}
            {modelStatus.promoter_features_count
              ? ` · promoter ${modelStatus.promoter_features_count}f`
              : ""}
            {modelStatus.rbs_model_loaded ? " · RBS model loaded" : ""}
          </div>
        )}
      </header>

      <TraitRecommender onAddPart={onAddPart} />

      <main className="layout">
        <PartsSidebar onAddPart={onAddPart} refreshKey={partsRefreshKey} />

        <CircuitCanvas
          circuit={circuit}
          onAddPart={onAddPart}
          onRemovePart={removePart}
          onClear={clearCircuit}
          onPredict={predict}
          loading={loading}
        />

        <aside className="prediction-panel">
          <h2>Prediction</h2>
          <PredictionPanel prediction={prediction} error={error} />
        </aside>
      </main>

      <AdminPanel onPartsRefreshed={() => setPartsRefreshKey((k) => k + 1)} />
    </div>
  );
}
