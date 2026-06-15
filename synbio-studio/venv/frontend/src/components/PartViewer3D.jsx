import { useEffect, useState } from "react";
import * as NGL from "ngl";
import $3Dmol from "3dmol";
import { api } from "../api/client.js";
import { badgeClass, displayType } from "../utils/partHelpers.js";
import { dnaComplement } from "../utils/aminoAcidColors.js";

function safeId(partId) {
  return String(partId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export default function PartViewer3D({ part }) {
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const viewportId = `ngl-viewport-${safeId(part.part_id)}`;
  const molId = `mol-${safeId(part.part_id)}`;
  const sequence = structureData?.sequence || part.sequence || "";
  const showProtein =
    structureData?.render_mode === "protein" && structureData?.pdb_url;
  const showDna =
    structureData &&
    (structureData.render_mode === "dna_helix" || !structureData.pdb_url);
  const showPlaceholder = fetchError || (!loading && !sequence);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    api
      .get(`/parts/${part.part_id}/structure`)
      .then(({ data }) => {
        if (!cancelled) setStructureData(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [part.part_id]);

  useEffect(() => {
    if (!showProtein || !structureData?.pdb_url) return undefined;
    const stage = new NGL.Stage(viewportId, { backgroundColor: "#0f172a" });
    stage
      .loadFile(structureData.pdb_url, { defaultRepresentation: false })
      .then((component) => {
        component.addRepresentation("cartoon", {
          colorScheme: "residueindex",
          smoothSheet: true,
        });
        component.autoView();
      })
      .catch(() => {});
    return () => stage.dispose();
  }, [showProtein, structureData?.pdb_url, viewportId]);

  useEffect(() => {
    if (!showDna || showProtein) return undefined;
    const container = document.getElementById(molId);
    if (!container) return undefined;
    const viewer = $3Dmol.createViewer(container, { backgroundColor: "#0f172a" });
    const seq = (structureData?.sequence || part.sequence || "")
      .replace(/\./g, "")
      .toUpperCase();
    if (!seq) return () => viewer.clear();
    const complement = dnaComplement(seq);
    viewer.addModel(`>strand1\n${seq}\n>strand2\n${complement}`, "fasta");
    viewer.setStyle(
      {},
      {
        stick: { colorscheme: "nucleicAcid", radius: 0.3 },
        sphere: { colorscheme: "nucleicAcid", scale: 0.3 },
      },
    );
    viewer.zoomTo();
    viewer.render();
    return () => viewer.clear();
  }, [showDna, showProtein, structureData, part.sequence, molId]);

  return (
    <div className="viewer-panel part-viewer-3d">
      <h3>
        {part.name || part.label || part.part_id} — 3D Structure
      </h3>

      {loading && <p className="viewer-loading">Loading 3D structure…</p>}

      {!loading && showProtein && (
        <div
          id={viewportId}
          className="viewer-canvas"
          style={{ width: "100%", height: 280, borderRadius: 12 }}
        />
      )}

      {!loading && showDna && !showProtein && !showPlaceholder && (
        <div
          id={molId}
          className="viewer-canvas"
          style={{ width: "100%", height: 280, borderRadius: 12 }}
        />
      )}

      {!loading && showPlaceholder && (
        <div className="viewer-placeholder">
          <span className={badgeClass(part.part_type)}>{displayType(part.part_type)}</span>
          <p>3D structure unavailable for this part</p>
        </div>
      )}

      <div className="viewer-meta">
        <code className="part-id-mono">{part.part_id}</code>
        <span className={badgeClass(part.part_type)}>{displayType(part.part_type)}</span>
        <span className="seq-len">{sequence.length} bp</span>
        <code className="seq-snippet">
          {(sequence || "").slice(0, 40)}
          {sequence.length > 40 ? "…" : ""}
        </code>
      </div>
    </div>
  );
}
