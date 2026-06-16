import { useEffect, useState } from "react";
import * as NGL from "ngl";
import { createViewer } from "3dmol";
import { api } from "../api/client.js";
import { badgeClass, displayType } from "../utils/partHelpers.js";

function safeId(partId) {
  return String(partId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export default function PartViewer3D({
  part,
  variant = "default",
  compact = false,
}) {
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const suffix = variant === "regulatory" ? "-reg" : "";
  const viewportId = `ngl-viewport-${safeId(part.part_id)}${suffix}`;
  const molId = `mol-${safeId(part.part_id)}${suffix}`;
  const sequence = structureData?.sequence || part.sequence || "";
  const renderMode = structureData?.render_mode;
  const pdbUrl = structureData?.pdb_url;

  const showProtein = renderMode === "protein" && pdbUrl;
  const showPdb =
    (renderMode === "pdb" || variant === "regulatory") && pdbUrl;
  const showDnaHelix =
    structureData &&
    renderMode === "dna_helix" &&
    !showProtein &&
    !showPdb;
  const showDnaLinear =
    structureData &&
    renderMode === "dna_linear" &&
    !showPdb;
  const showPlaceholder =
    fetchError || (!loading && !sequence && !pdbUrl);

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
    if (!showProtein && !showPdb) return undefined;
    if (!pdbUrl) return undefined;

    const stage = new NGL.Stage(viewportId, { backgroundColor: "#0f172a" });
    stage
      .loadFile(pdbUrl, { defaultRepresentation: false })
      .then((component) => {
        const partType = (part.part_type || "").toLowerCase();
        if (showProtein) {
          component.addRepresentation("cartoon", {
            colorScheme: "residueindex",
            smoothSheet: true,
          });
        } else if (partType === "promoter") {
          component.addRepresentation("cartoon", {
            sele: "nucleic",
            color: "#e85d4c",
          });
          component.addRepresentation("cartoon", {
            sele: "protein",
            colorScheme: "chainid",
            opacity: 0.85,
          });
        } else if (partType === "rbs") {
          component.addRepresentation("cartoon", {
            colorScheme: "chainid",
            opacity: 0.9,
          });
        } else if (partType === "terminator") {
          component.addRepresentation("ribbon", {
            sele: "nucleic or RNA",
            color: "#f0ad4e",
          });
          component.addRepresentation("ball+stick", {
            sele: "nucleic or RNA",
            colorScheme: "element",
            scale: 0.3,
          });
        } else {
          component.addRepresentation("cartoon", { colorScheme: "chainid" });
        }
        component.autoView();
        stage.handleResize();
      })
      .catch(() => {});

    return () => stage.dispose();
  }, [showProtein, showPdb, pdbUrl, viewportId, part.part_type]);

  useEffect(() => {
    if (!showDnaHelix && !showDnaLinear) return undefined;
    if (showProtein || showPdb) return undefined;

    const container = document.getElementById(molId);
    if (!container) return undefined;

    const viewer = createViewer(container, { backgroundColor: "#0f172a" });
    const seq = (structureData?.sequence || part.sequence || "")
      .replace(/\./g, "")
      .toUpperCase()
      .slice(0, 48);

    if (!seq) return () => viewer.clear();

    if (showDnaLinear) {
      const atoms = seq
        .split("")
        .map((base, i) => {
          const x = i * 0.8;
          return `C ${x.toFixed(2)} 0.00 0.00  # ${base}`;
        })
        .join("\n");
      viewer.addModel(`\n${seq.length}\nlinear\n${atoms}`, "pdb");
      viewer.setStyle({}, { stick: { colorscheme: "greenCarbon", radius: 0.25 } });
    } else {
      const complement = seq
        .split("")
        .map((b) => ({ A: "T", T: "A", C: "G", G: "C" }[b] || "N"))
        .join("");
      viewer.addModel(`>strand1\n${seq}\n>strand2\n${complement}`, "fasta");
      viewer.setStyle(
        {},
        {
          stick: { colorscheme: "nucleicAcid", radius: 0.3 },
          sphere: { colorscheme: "nucleicAcid", scale: 0.3 },
        },
      );
    }

    viewer.zoomTo();
    viewer.render();
    return () => viewer.clear();
  }, [showDnaHelix, showDnaLinear, showProtein, showPdb, structureData, part.sequence, molId]);

  const panelClass = compact
    ? "visualize-panel visualize-panel-small part-viewer-3d"
    : "viewer-panel part-viewer-3d";
  const canvasClass = compact
    ? "visualize-canvas visualize-canvas-small"
    : "viewer-canvas";
  const canvasStyle = compact
    ? undefined
    : { width: "100%", height: 280, borderRadius: 12 };

  const title =
    variant === "regulatory"
      ? displayType(part.part_type)
      : `${part.name || part.label || part.part_id} — 3D Structure`;

  return (
    <div className={panelClass}>
      <h3 className="visualize-panel-title">{title}</h3>
      {structureData?.structure_label && (
        <p className="visualize-panel-subtitle">{structureData.structure_label}</p>
      )}

      {loading && <p className="viewer-loading">Loading 3D structure…</p>}

      {!loading && (showProtein || showPdb) && (
        <div id={viewportId} className={canvasClass} style={canvasStyle} />
      )}

      {!loading && (showDnaHelix || showDnaLinear) && !showProtein && !showPdb && (
        <div id={molId} className={canvasClass} style={canvasStyle} />
      )}

      {!loading && showPlaceholder && (
        <div className="viewer-placeholder">
          <span className={badgeClass(part.part_type)}>{displayType(part.part_type)}</span>
          <p>3D structure unavailable for this part</p>
        </div>
      )}

      {!compact && (
        <div className="viewer-meta">
          <code className="part-id-mono">{part.part_id}</code>
          <span className={badgeClass(part.part_type)}>{displayType(part.part_type)}</span>
          <span className="seq-len">{sequence.length} bp</span>
        </div>
      )}
    </div>
  );
}
