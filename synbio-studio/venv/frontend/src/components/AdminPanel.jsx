import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function AdminPanel({ onPartsRefreshed }) {
  const [open, setOpen] = useState(false);
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

  const refreshParts = async () => {
    try {
      const { data } = await api.post("/admin/refresh-parts");
      setRefreshJob({ job_id: data.job_id, status: "running" });
      pollJob(data.job_id, setRefreshJob);
    } catch (err) {
      setLog(String(err));
    }
  };

  const retrain = async () => {
    const models = Object.entries(trainModels)
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      const { data } = await api.post("/admin/retrain", { models });
      setTrainJob({ job_id: data.job_id, status: "running", models_queued: data.models_queued });
      pollJob(data.job_id, setTrainJob);
    } catch (err) {
      setLog(String(err));
    }
  };

  return (
    <>
      <button type="button" className="admin-toggle" onClick={() => setOpen(!open)}>
        ⚙ Admin
      </button>
      {open && (
        <div className="admin-panel">
          <h3>Admin</h3>
          {modelStatus && (
            <ul className="admin-status">
              <li>
                Promoter model:{" "}
                {modelStatus.model_loaded ? "● Loaded (GBM-v1)" : "○ Not loaded"}
              </li>
              <li>
                RBS model:{" "}
                {modelStatus.rbs_model_loaded ? "● Loaded (GBM-RBS-v1)" : "○ Not loaded"}
              </li>
              <li>
                Circuit model:{" "}
                {modelStatus.circuit_model_loaded ? "● Loaded" : "○ Not loaded"}
              </li>
              <li>Parts library: {modelStatus.parts_count?.toLocaleString() || 0} parts</li>
            </ul>
          )}

          <button type="button" onClick={refreshParts}>
            Refresh Parts Library
          </button>
          {refreshJob && (
            <p className="hint">
              Refresh job {refreshJob.job_id?.slice(0, 8)}… — {refreshJob.status}
            </p>
          )}

          <div className="retrain-section">
            <p>Retrain Models</p>
            <label>
              <input
                type="checkbox"
                checked={trainModels.promoter}
                onChange={(e) =>
                  setTrainModels((s) => ({ ...s, promoter: e.target.checked }))
                }
              />
              Promoter model
            </label>
            <label>
              <input
                type="checkbox"
                checked={trainModels.rbs}
                onChange={(e) => setTrainModels((s) => ({ ...s, rbs: e.target.checked }))}
              />
              RBS model
            </label>
            <label>
              <input
                type="checkbox"
                checked={trainModels.circuit}
                onChange={(e) =>
                  setTrainModels((s) => ({ ...s, circuit: e.target.checked }))
                }
              />
              Circuit model
            </label>
            <button type="button" className="primary" onClick={retrain}>
              Start Retraining
            </button>
            {trainJob && (
              <p className="hint">
                Train job {trainJob.job_id?.slice(0, 8)}… — {trainJob.status}
                {trainJob.models_queued && ` (${trainJob.models_queued.join(", ")})`}
              </p>
            )}
          </div>

          <div className="admin-log">
            <pre>{log || "Job output will appear here…"}</pre>
          </div>
        </div>
      )}
    </>
  );
}
