import { useCallback, useEffect, useMemo } from "react";
import { API_BASE } from "../api/client.js";
import PartsLibrary from "../components/PartsLibrary.jsx";
import CircuitCanvas from "../components/CircuitCanvas.jsx";
import AnalysisDock from "../components/AnalysisDock.jsx";
import Inspector from "../components/Inspector.jsx";
import { IconAlert } from "../components/Icons.jsx";
import { hasType } from "../utils/circuit.js";

export default function CircuitBuilderPage({
  circuit,
  setCircuit,
  selectedUid,
  setSelectedUid,
  predictResult,
  setPredictResult,
  loading,
  error,
  onPredict,
  onNavigate,
  backendOnline,
  partsRefreshKey,
  railOpen,
  inspectorOpen,
  onCloseDrawers,
  onRequestInspector,
  activeTab,
  onTabChange,
}) {

  const partCounts = useMemo(() => {
    const counts = {};
    circuit.forEach((part) => {
      counts[part.part_id] = (counts[part.part_id] || 0) + 1;
    });
    return counts;
  }, [circuit]);

  const selectedIndex = circuit.findIndex((part) => part.uid === selectedUid);
  const selectedPart = selectedIndex >= 0 ? circuit[selectedIndex] : null;

  // Any edit invalidates the previous model run.
  const invalidate = useCallback(() => setPredictResult(null), [setPredictResult]);

  const insertPart = useCallback(
    (part, index) => {
      const uid = crypto.randomUUID();
      setCircuit((prev) => {
        const next = [...prev];
        const at = Math.max(0, Math.min(index ?? next.length, next.length));
        next.splice(at, 0, { ...part, uid });
        return next;
      });
      invalidate();
      setSelectedUid(uid);
    },
    [setCircuit, invalidate, setSelectedUid],
  );

  const addPart = useCallback(
    (part) => insertPart(part, circuit.length),
    [insertPart, circuit.length],
  );

  const removePart = useCallback(
    (uid) => {
      setCircuit((prev) => prev.filter((part) => part.uid !== uid));
      invalidate();
      setSelectedUid((current) => (current === uid ? null : current));
    },
    [setCircuit, invalidate, setSelectedUid],
  );

  const movePart = useCallback(
    (uid, toIndex) => {
      setCircuit((prev) => {
        const from = prev.findIndex((part) => part.uid === uid);
        if (from < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        const target = toIndex > from ? toIndex - 1 : toIndex;
        next.splice(Math.max(0, Math.min(target, next.length)), 0, moved);
        return next;
      });
      invalidate();
    },
    [setCircuit, invalidate],
  );

  const duplicatePart = useCallback(
    (part) => {
      const index = circuit.findIndex((item) => item.uid === part.uid);
      const { uid: _uid, ...payload } = part;
      insertPart(payload, index + 1);
    },
    [circuit, insertPart],
  );

  const clearCircuit = useCallback(() => {
    setCircuit([]);
    invalidate();
    setSelectedUid(null);
  }, [setCircuit, invalidate, setSelectedUid]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSelectedUid(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelectedUid]);

  const selectPart = useCallback(
    (uid) => {
      setSelectedUid(uid);
      onRequestInspector?.();
    },
    [setSelectedUid, onRequestInspector],
  );

  const liveMessage = loading
    ? "Running the expression model."
    : error
      ? `Prediction failed. ${error}`
      : predictResult?.prediction
        ? `Prediction complete. Relative protein yield ${
            predictResult.prediction.protein_yield?.relative_yield ?? "unavailable"
          }.`
        : "";

  return (
    <div className="workspace">
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <aside
        className={`ws-col ws-rail ${railOpen ? "open" : ""}`}
        aria-label="Parts library"
      >
        <PartsLibrary
          onAddPart={addPart}
          partCounts={partCounts}
          refreshKey={partsRefreshKey}
        />
      </aside>

      <div className="ws-col ws-main">
        {backendOnline === false && (
          <div className="offline-bar">
            <IconAlert width={13} height={13} />
            Backend offline at {API_BASE} — library, prediction and structure
            services are unavailable.
          </div>
        )}

        <CircuitCanvas
          circuit={circuit}
          selectedUid={selectedUid}
          onSelect={selectPart}
          onInsertPart={insertPart}
          onRemovePart={removePart}
          onMovePart={movePart}
          onClear={clearCircuit}
          prediction={predictResult?.prediction}
        />

        <AnalysisDock
          circuit={circuit}
          predictResult={predictResult}
          loading={loading}
          error={error}
          selectedUid={selectedUid}
          onSelect={selectPart}
          onPredict={onPredict}
          canPredict={circuit.length > 0 && hasType(circuit, "promoter")}
          onOpenStructure={() => onNavigate("visualize")}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>

      <aside
        className={`ws-col ws-inspector ${inspectorOpen ? "open" : ""}`}
        aria-label="Inspector"
      >
        <Inspector
          part={selectedPart}
          index={selectedIndex}
          circuit={circuit}
          prediction={predictResult?.prediction}
          onRemove={removePart}
          onDuplicate={duplicatePart}
          onFocusSequence={() => onTabChange("sequence")}
          onOpenStructure={() => onNavigate("visualize")}
          onClose={onCloseDrawers}
        />
      </aside>

      {(railOpen || inspectorOpen) && (
        <button
          type="button"
          className="drawer-scrim"
          onClick={onCloseDrawers}
          aria-label="Close panel"
        />
      )}
    </div>
  );
}
