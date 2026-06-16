import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE } from "../api/client.js";
import PageHero from "../components/PageHero.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import PartsLibrary from "../components/PartsLibrary.jsx";
import CircuitCanvas from "../components/CircuitCanvas.jsx";
import PreviewPanel from "../components/PreviewPanel.jsx";
import PredictionPanel from "../components/PredictionPanel.jsx";

export default function CircuitBuilderPage({
  circuit,
  setCircuit,
  predictResult,
  setPredictResult,
  onNavigate,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partsRefreshKey, setPartsRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [showOutput, setShowOutput] = useState(false);
  const outputRef = useRef(null);

  const partCounts = useMemo(() => {
    const counts = {};
    circuit.forEach((p) => {
      counts[p.part_id] = (counts[p.part_id] || 0) + 1;
    });
    return counts;
  }, [circuit]);

  useEffect(() => {
    api
      .get("/model/status")
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, [partsRefreshKey]);

  const onAddPart = useCallback(
    (part) => {
      setCircuit((prev) => [
        ...prev,
        { ...part, uid: part.uid || crypto.randomUUID() },
      ]);
      setPredictResult(null);
      setShowOutput(false);
    },
    [setCircuit, setPredictResult],
  );

  const removePart = (uid) => {
    setCircuit((prev) => prev.filter((p) => p.uid !== uid));
    setPredictResult(null);
    setShowOutput(false);
  };

  const clearCircuit = () => {
    setCircuit([]);
    setPredictResult(null);
    setShowOutput(false);
  };

  const predict = async () => {
    setLoading(true);
    setError(null);
    setShowOutput(true);
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
          ? `Network error — cannot reach backend at ${API_BASE}.`
          : err.response?.data?.detail?.error ||
            err.message ||
            "Prediction failed.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showOutput || loading) return;
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showOutput, loading, predictResult, error]);

  return (
    <div className="page circuit-builder-page">
      <PageHero onOpenSettings={() => setSettingsOpen(true)} />

      {backendOnline === false && (
        <p className="error backend-offline">
          Backend offline at {API_BASE}. Run uvicorn from synbio-studio\venv.
        </p>
      )}

      <PartsLibrary
        onAddPart={onAddPart}
        partCounts={partCounts}
        refreshKey={partsRefreshKey}
      />

      <section className="circuit-preview-row">
        <CircuitCanvas
          circuit={circuit}
          onAddPart={onAddPart}
          onRemovePart={removePart}
          onClear={clearCircuit}
          onPredict={predict}
          loading={loading}
        />
        <PreviewPanel circuit={circuit} />
      </section>

      {showOutput && (
        <>
          <hr className="output-divider" ref={outputRef} />
          <PredictionPanel
            predictResult={predictResult}
            error={error}
            loading={loading}
            onVisualize={() => onNavigate("visualize")}
          />
        </>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPartsRefreshed={() => setPartsRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
