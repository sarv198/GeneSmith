import { useEffect, useRef, useState } from "react";
import * as NGL from "ngl";
import { createViewer } from "3dmol";
import { api } from "../api/client.js";
import { partLabel, typeKey, typeLabel } from "../utils/circuit.js";
import { stageBackground, useTheme } from "../theme.jsx";
import { whenPaintable } from "../utils/paint.js";

function safeId(partId) {
  return String(partId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderRbsSequenceFallback(container, sequence, background) {
  const viewer = createViewer(container, { backgroundColor: background });
  const seq = (sequence || "AGGAGG")
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/[^ATCGU]/g, "")
    .slice(0, 24);
  if (!seq) {
    viewer.clear();
    return () => viewer.clear();
  }

  const atoms = [];
  seq.split("").forEach((base, i) => {
    const angle = (i * 32 * Math.PI) / 180;
    const x = i * 1.1;
    const y = 1.4 * Math.cos(angle);
    const z = 1.4 * Math.sin(angle);
    atoms.push(`C ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}  # ${base}`);
  });

  viewer.addModel(`\n${seq.length}\nRBS\n${atoms.join("\n")}`, "pdb");
  viewer.setStyle(
    {},
    {
      stick: { color: "#4c9be8", radius: 0.22 },
      sphere: { color: "#4c9be8", radius: 0.28 },
    },
  );
  viewer.addLabel("Shine-Dalgarno (RBS)", {
    position: { x: (seq.length * 1.1) / 2, y: 2.2, z: 0 },
    fontSize: 11,
    fontColor: "#4c9be8",
    backgroundColor: background,
    backgroundOpacity: 0.7,
  });
  viewer.zoomTo();
  viewer.render();
  return () => viewer.clear();
}

export default function PartViewer3D({
  part,
  variant = "default",
  compact = false,
}) {
  const { theme } = useTheme();
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewerFailed, setViewerFailed] = useState(false);

  const suffix = variant === "regulatory" ? "-reg" : "";
  const viewportId = `ngl-viewport-${safeId(part.part_id)}${suffix}`;
  const molId = `mol-${safeId(part.part_id)}${suffix}`;
  const viewportRef = useRef(null);
  const fallbackRef = useRef(null);

  const sequence = structureData?.sequence || part.sequence || "";
  const renderMode = structureData?.render_mode;
  const pdbUrl = structureData?.pdb_url;
  const partType = (part.part_type || "").toLowerCase();

  const showProtein = renderMode === "protein" && pdbUrl;
  const showPdb =
    (renderMode === "pdb" || variant === "regulatory") && pdbUrl && !viewerFailed;
  const showRbsFallback =
    !loading &&
    partType === "rbs" &&
    variant === "regulatory" &&
    (viewerFailed || !pdbUrl);
  const showDnaHelix =
    structureData &&
    renderMode === "dna_helix" &&
    !showProtein &&
    !showPdb &&
    !showRbsFallback;
  const showDnaLinear =
    structureData &&
    renderMode === "dna_linear" &&
    !showPdb &&
    !showRbsFallback;
  const showPlaceholder =
    fetchError ||
    (!loading &&
      !showProtein &&
      !showPdb &&
      !showRbsFallback &&
      !showDnaHelix &&
      !showDnaLinear &&
      !sequence &&
      !pdbUrl);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(false);
    setViewerFailed(false);
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
    if (loading || (!showProtein && !showPdb) || !pdbUrl) return undefined;

    let stage = null;
    let cancelled = false;

    const mount = () => {
      const el = viewportRef.current;
      if (!el || cancelled) return;

      stage = new NGL.Stage(el, { backgroundColor: stageBackground(theme) });
      stage
        .loadFile(pdbUrl, { defaultRepresentation: false })
        .then((component) => {
          if (cancelled) return;
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
              sele: "protein or nucleic",
              colorScheme: "chainid",
              opacity: 0.92,
            });
            component.addRepresentation("ball+stick", {
              sele: "nucleic",
              color: "#4c9be8",
              scale: 0.25,
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
        .catch(() => {
          if (!cancelled) setViewerFailed(true);
        });
    };

    const cancelPaint = whenPaintable(mount);
    return () => {
      cancelled = true;
      cancelPaint();
      stage?.dispose();
    };
  }, [loading, showProtein, showPdb, pdbUrl, partType, theme]);

  useEffect(() => {
    if (!showRbsFallback) return undefined;
    let cleanup;
    let cancelled = false;
    const cancelPaint = whenPaintable(() => {
      if (cancelled) return;
      const container = fallbackRef.current;
      if (!container) return;
      cleanup = renderRbsSequenceFallback(container, sequence, stageBackground(theme));
    });
    return () => {
      cancelled = true;
      cancelPaint();
      cleanup?.();
    };
  }, [showRbsFallback, sequence, theme]);

  useEffect(() => {
    if (!showDnaHelix && !showDnaLinear) return undefined;
    if (showProtein || showPdb || showRbsFallback) return undefined;

    const container = document.getElementById(molId);
    if (!container) return undefined;

    const viewer = createViewer(container, { backgroundColor: stageBackground(theme) });
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
  }, [
    showDnaHelix,
    showDnaLinear,
    showProtein,
    showPdb,
    showRbsFallback,
    structureData,
    part.sequence,
    molId,
    theme,
  ]);

  const title =
    variant === "regulatory"
      ? `${typeLabel(part.part_type)} reference`
      : `${partLabel(part)} — structure`;

  const canvasStyle = { width: "100%", height: "100%" };

  return (
    <div
      className={`viewer part-viewer ${compact ? "viewer-sm" : "viewer-md"}`}
      data-type={typeKey(part.part_type)}
    >
      <div className="viewer-head">
        <div className="viewer-titles">
          <div className="viewer-title">{title}</div>
          <div className="viewer-subtitle">
            {structureData?.structure_label ||
              `${part.part_id} · ${sequence.length} bp`}
          </div>
        </div>
        <div className="viewer-tools">
          <span className="type-tag">{typeLabel(part.part_type)}</span>
        </div>
      </div>

      <div className="viewer-stage">
        {!loading && (showProtein || showPdb) && (
          <div
            ref={viewportRef}
            id={viewportId}
            className="viewer-canvas"
            style={canvasStyle}
          />
        )}

        {!loading && showRbsFallback && (
          <div ref={fallbackRef} className="viewer-canvas" style={canvasStyle} />
        )}

        {!loading &&
          (showDnaHelix || showDnaLinear) &&
          !showProtein &&
          !showPdb &&
          !showRbsFallback && (
            <div id={molId} className="viewer-canvas" style={canvasStyle} />
          )}

        {loading && (
          <div className="viewer-overlay">
            <span className="loading-row">
              <span className="pulse-bar" aria-hidden="true" />
              Preparing structure…
            </span>
          </div>
        )}

        {!loading && showPlaceholder && (
          <div className="viewer-overlay">
            <div className="empty">
              <p className="empty-title">No reference structure</p>
              <p className="empty-body">
                No deposited structure is recorded for this part. Its sequence is
                still used in the construct.
              </p>
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <div className="viewer-foot">
          <code className="mono">{part.part_id}</code>
          <span>{sequence.length} bp</span>
        </div>
      )}
    </div>
  );
}
