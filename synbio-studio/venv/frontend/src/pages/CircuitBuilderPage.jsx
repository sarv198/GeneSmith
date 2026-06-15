import { useCallback, useEffect, useState } from "react";
import { api, API_BASE } from "../api/client.js";
import TraitRecommender from "../components/TraitRecommender.jsx";
import PartsSidebar from "../components/PartsSidebar.jsx";
import CircuitCanvas from "../components/CircuitCanvas.jsx";
import PredictionPanel from "../components/PredictionPanel.jsx";
import AdminPanel from "../components/AdminPanel.jsx";

export default function CircuitBuilderPage() {
  const [circuit, setCircuit] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [predictResult, setPredictResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partsRefreshKey, setPartsRefreshKey] = useState(0);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    api
      .get("/model/status")
      .then(({ data }) => {
        setModelStatus(data);
        setBackendOnline(true);
      })
      .catch(() => {
        setModelStatus({ model_loaded: false, mode: "offline", parts_count: 0 });
        setBackendOnline(false);
      });
  }, [partsRefreshKey]);

  const onAddPart = useCallback((part) => {
    setCircuit((prev) => [
      ...prev,
      { ...part, uid: part.uid || crypto.randomUUID() },
    ]);
    setPredictResult(null);
  }, []);

  const removePart = (uid) => {
    setCircuit((prev) => prev.filter((p) => p.uid !== uid));
    setPredictResult(null);
  };

  const clearCircuit = () => {
    setCircuit([]);
    setPredictResult(null);
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
      setPredictResult(data);
    } catch (err) {
      const msg =
        err.code === "ERR_NETWORK"
          ? `Network error — cannot reach backend at ${API_BASE}. Start: python -m uvicorn backend.api.main:app --reload --port 8000`
          : err.response?.data?.detail?.error ||
            err.message ||
            "Prediction failed. Is the API running on port 8000?";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page circuit-builder-page">
      <header className="page-header">
        <p className="page-subtitle">
          Drag DNA parts into the circuit, then predict expression.
        </p>
        {backendOnline === false && (
          <p className="error backend-offline">
            Backend offline at {API_BASE}. From <code>synbio-studio\venv</code> run:{" "}
            <code>python -m uvicorn backend.api.main:app --reload --port 8000</code>
          </p>
        )}
        {modelStatus && backendOnline && (
          <div className={`status-badge ${modelStatus.model_loaded ? "ok" : "warn"}`}>
            Backend connected · Model: {modelStatus.mode || "unknown"}
            {modelStatus.parts_count
              ? ` · ${modelStatus.parts_count.toLocaleString()} parts`
              : ""}
            {modelStatus.rbs_model_loaded ? " · RBS loaded" : ""}
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
          <PredictionPanel predictResult={predictResult} error={error} />
        </aside>
      </main>

      <AdminPanel onPartsRefreshed={() => setPartsRefreshKey((k) => k + 1)} />
    </div>
  );
}
