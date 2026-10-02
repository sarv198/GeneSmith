import { useCallback, useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "./api/client.js";
import AppHeader from "./components/AppHeader.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import CircuitBuilderPage from "./pages/CircuitBuilderPage.jsx";
import TheoryPage from "./pages/TheoryPage.jsx";
import VisualizePage from "./pages/VisualizePage.jsx";
import { extractOrganism } from "./utils/partDisplay.js";
import {
  assembleCircuit,
  circuitStatus,
  circuitToFasta,
  downloadText,
  hasType,
} from "./utils/circuit.js";

const PAGES = {
  home: CircuitBuilderPage,
  theory: TheoryPage,
  visualize: VisualizePage,
};

/** Circuit edits are undoable; history is kept in one atomic state object. */
function useHistoryState(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });

  const set = useCallback((next) => {
    setState((current) => {
      const value = typeof next === "function" ? next(current.present) : next;
      if (Object.is(value, current.present)) return current;
      return {
        past: [...current.past, current.present].slice(-80),
        present: value,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, 80),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (!current.future.length) return current;
      const [next, ...rest] = current.future;
      return {
        past: [...current.past, current.present].slice(-80),
        present: next,
        future: rest,
      };
    });
  }, []);

  return {
    value: state.present,
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const {
    value: circuit,
    set: setCircuit,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistoryState([]);
  const [predictResult, setPredictResult] = useState(null);
  const [selectedUid, setSelectedUid] = useState(null);
  const [circuitName, setCircuitName] = useState("Untitled Circuit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);
  const [partsRefreshKey, setPartsRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Lives here so leaving the builder and coming back lands on the same view.
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    api
      .get("/model/status")
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, [partsRefreshKey]);

  const predict = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveTab("prediction");
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
  }, [circuit]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const organism = useMemo(
    () =>
      circuit.length
        ? extractOrganism(circuit[0].description || "", circuit[0].source)
        : "Escherichia coli",
    [circuit],
  );

  const { length: circuitLength } = useMemo(
    () => assembleCircuit(circuit),
    [circuit],
  );

  const status = useMemo(() => circuitStatus(circuit), [circuit]);

  const exportFasta = useCallback(() => {
    downloadText(
      `${circuitName.trim().replace(/\s+/g, "_") || "circuit"}.fasta`,
      circuitToFasta(circuit, circuitName.trim() || "circuit"),
      "text/x-fasta",
    );
  }, [circuit, circuitName]);

  const Page = PAGES[activePage] || CircuitBuilderPage;

  const closeDrawers = useCallback(() => {
    setRailOpen(false);
    setInspectorOpen(false);
  }, []);

  const navigate = useCallback(
    (page) => {
      setActivePage(page);
      closeDrawers();
    },
    [closeDrawers],
  );

  const pageProps = {
    circuit,
    setCircuit,
    selectedUid,
    setSelectedUid,
    predictResult,
    setPredictResult,
    loading,
    error,
    onPredict: predict,
    onNavigate: navigate,
    backendOnline,
    partsRefreshKey,
    railOpen,
    inspectorOpen,
    onCloseDrawers: closeDrawers,
    onRequestInspector: () => setInspectorOpen(true),
    activeTab,
    onTabChange: setActiveTab,
  };

  return (
    <div className="app-shell">
      <AppHeader
        activePage={activePage}
        onNavigate={navigate}
        circuitName={circuitName}
        onRenameCircuit={setCircuitName}
        organism={organism}
        status={status}
        circuitLength={circuitLength}
        partCount={circuit.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onPredict={predict}
        predicting={loading}
        canPredict={circuit.length > 0 && hasType(circuit, "promoter")}
        onExport={exportFasta}
        canExport={circuitLength > 0}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleRail={() => {
          setInspectorOpen(false);
          setRailOpen((open) => !open);
        }}
        onToggleInspector={() => {
          setRailOpen(false);
          setInspectorOpen((open) => !open);
        }}
        backendOnline={backendOnline}
      />

      <div className="app-content">
        <Page {...pageProps} />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPartsRefreshed={() => setPartsRefreshKey((key) => key + 1)}
      />
    </div>
  );
}
