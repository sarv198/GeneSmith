import { useEffect, useState } from "react";
import { api, API_BASE } from "../api/client.js";
import { IconClose } from "./Icons.jsx";

const MODEL_ROWS = [
  { key: "model_loaded", label: "Promoter model", detail: "GBM-v1" },
  { key: "rbs_model_loaded", label: "RBS model", detail: "GBM-RBS-v1" },
  { key: "circuit_model_loaded", label: "Circuit model", detail: "GBM-circuit-v1" },
];

export default function SettingsModal({ open, onClose, onPartsRefreshed }) {
  const [modelStatus, setModelStatus] = useState(null);
  const [refreshJob, setRefreshJob] = useState(null);
  const [trainJob, setTrainJob] = useState(null);
  const [trainModels, setTrainModels] = useState({
    promoter: true,
    rbs: true,
    circuit: true,
  });
  const [log, setLog] = useState("");

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/model/status");
      setModelStatus(data);
    } catch {
      setModelStatus(null);
    }
  };

  useEffect(() => {
    if (open) loadStatus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pollJob = (jobId, setter) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/admin/job/${jobId}`);
        setter(data);
        setLog(data.output || "");
        if (data.status === "complete" || data.status === "failed") {
          clearInterval(interval);
          if (data.status === "complete") {
            loadStatus();
            onPartsRefreshed?.();
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);
    return interval;
  };

  if (!open) return null;

  const jobChip = (job) => {
    if (!job) return null;
    const level =
      job.status === "complete" ? "ok" : job.status === "failed" ? "err" : "warn";
    return (
      <span className={`chip chip-${level}`}>
        <span className="dot" aria-hidden="true" />
        {job.job_id?.slice(0, 8)} · {job.status}
      </span>
    );
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Model and library settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Models &amp; library</h2>
          <span className="chip mono" style={{ marginLeft: "auto" }}>
            {API_BASE || "same origin"}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <IconClose />
          </button>
        </div>

        <div className="modal-body">
          <section className="stack-sm">
            <div className="sub-label">Service status</div>
            {modelStatus ? (
              <div className="status-list">
                {MODEL_ROWS.map((row) => (
                  <div className="status-row" key={row.key}>
                    <span
                      className={`chip ${modelStatus[row.key] ? "chip-ok" : "chip-warn"}`}
                    >
                      <span className="dot" aria-hidden="true" />
                      {modelStatus[row.key] ? "loaded" : "not loaded"}
                    </span>
                    <span className="k">{row.label}</span>
                    <span className="v">{row.detail}</span>
                  </div>
                ))}
                <div className="status-row">
                  <span className="chip">
                    <span className="dot" aria-hidden="true" />
                    library
                  </span>
                  <span className="k">Parts available</span>
                  <span className="v">
                    {modelStatus.parts_count?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="status-row">
                  <span className="chip">
                    <span className="dot" aria-hidden="true" />
                    mode
                  </span>
                  <span className="k">Active predictor</span>
                  <span className="v">{modelStatus.mode}</span>
                </div>
              </div>
            ) : (
              <p className="warn-text">
                Cannot reach the backend at {API_BASE || "this origin"}.
              </p>
            )}
          </section>

          <section className="stack-sm">
            <div className="sub-label">Parts library</div>
            <p className="hint">
              Re-fetches iGEM, Anderson and RegulonDB records, then rebuilds the
              master parts table.
            </p>
            <div className="insp-inline-actions">
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    const { data } = await api.post("/admin/refresh-parts");
                    setRefreshJob({ job_id: data.job_id, status: "running" });
                    pollJob(data.job_id, setRefreshJob);
                  } catch (err) {
                    setLog(String(err));
                  }
                }}
              >
                Refresh parts library
              </button>
              {jobChip(refreshJob)}
            </div>
          </section>

          <section className="stack-sm">
            <div className="sub-label">Retrain models</div>
            <p className="hint">
              Trains the selected estimators from the current datasets. Runs on
              the backend and can take several minutes.
            </p>
            <div className="insp-inline-actions">
              {["promoter", "rbs", "circuit"].map((key) => (
                <label key={key} className="check-row">
                  <input
                    type="checkbox"
                    checked={trainModels[key]}
                    onChange={(e) =>
                      setTrainModels((s) => ({ ...s, [key]: e.target.checked }))
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
            <div className="insp-inline-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const models = Object.entries(trainModels)
                    .filter(([, v]) => v)
                    .map(([k]) => k);
                  try {
                    const { data } = await api.post("/admin/retrain", { models });
                    setTrainJob({ job_id: data.job_id, status: "running" });
                    pollJob(data.job_id, setTrainJob);
                  } catch (err) {
                    setLog(String(err));
                  }
                }}
              >
                Start retraining
              </button>
              {jobChip(trainJob)}
            </div>
          </section>

          <section className="stack-sm">
            <div className="sub-label">Job output</div>
            <div className="log">
              <pre>{log || "Job output will appear here…"}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
