import { useEffect, useState } from "react";
import { api } from "../api/client.js";

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

  return (
    <div className="settings-overlay" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        {modelStatus && (
          <ul className="admin-status">
            <li>
              Promoter model:{" "}
              {modelStatus.model_loaded ? "● Loaded (GBM-v1)" : "○ Not loaded"}
            </li>
            <li>
              RBS model:{" "}
              {modelStatus.rbs_model_loaded ? "● Loaded" : "○ Not loaded"}
            </li>
            <li>
              Circuit model:{" "}
              {modelStatus.circuit_model_loaded ? "● Loaded" : "○ Not loaded"}
            </li>
            <li>Parts library: {modelStatus.parts_count?.toLocaleString() || 0} parts</li>
          </ul>
        )}

        <button type="button" onClick={async () => {
          try {
            const { data } = await api.post("/admin/refresh-parts");
            setRefreshJob({ job_id: data.job_id, status: "running" });
            pollJob(data.job_id, setRefreshJob);
          } catch (err) {
            setLog(String(err));
          }
        }}>
          Refresh Parts Library
        </button>
        {refreshJob && (
          <p className="hint">
            Refresh job {refreshJob.job_id?.slice(0, 8)}… — {refreshJob.status}
          </p>
        )}

        <div className="retrain-section">
          <p>Retrain Models</p>
          {["promoter", "rbs", "circuit"].map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={trainModels[key]}
                onChange={(e) =>
                  setTrainModels((s) => ({ ...s, [key]: e.target.checked }))
                }
              />
              {key} model
            </label>
          ))}
          <button
            type="button"
            className="btn-dark"
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
            Start Retraining
          </button>
          {trainJob && (
            <p className="hint">
              Train job {trainJob.job_id?.slice(0, 8)}… — {trainJob.status}
            </p>
          )}
        </div>

        <div className="admin-log">
          <pre>{log || "Job output will appear here…"}</pre>
        </div>
      </div>
    </div>
  );
}
