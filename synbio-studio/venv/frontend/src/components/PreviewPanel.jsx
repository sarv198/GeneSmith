import { useEffect, useRef, useState } from "react";
import { createViewer } from "3dmol";
import { api, typeColor } from "../api/client.js";
import { extractOrganism } from "../utils/partDisplay.js";
import { typeKey } from "../utils/circuit.js";
import { labelBackground, stageBackground, useTheme } from "../theme.jsx";
import { whenPaintable } from "../utils/paint.js";
import {
  buildStructureFromCircuit,
  sanitizeDna,
  segmentHelixGeometry,
} from "../utils/previewHelix.js";

function circuitPartsPayload(circuit) {
  return circuit.map((p) => ({
    part_id: p.part_id,
    part_type: p.part_type,
    sequence: p.sequence || "",
    color: p.color || typeColor(p.part_type),
  }));
}

function renderDnaHelix(viewer, dnaStructure, labelBg) {
  const assembled = sanitizeDna(dnaStructure.assembled_sequence);
  if (assembled.length < 2) return false;

  let globalIndex = 0;
  let drewAnything = false;
  let modelIndex = 0;

  dnaStructure.parts_map.forEach((part) => {
    const segment = sanitizeDna(assembled.slice(part.start, part.end));
    if (segment.length < 2) return;

    const geom = segmentHelixGeometry(segment, globalIndex, part.color);
    globalIndex += geom.pointCount;

    try {
      viewer.addModel(geom.xyz, "xyz");
      viewer.setStyle(
        { model: modelIndex },
        { sphere: { color: part.color, radius: 0.32 } },
      );
      modelIndex += 1;

      for (let i = 1; i < geom.backbone.length; i++) {
        viewer.addCylinder({
          start: geom.backbone[i - 1],
          end: geom.backbone[i],
          color: part.color,
          radius: 0.1,
        });
      }

      const startCoord = geom.backbone.length > 0
        ? geom.backbone[0]
        : { x: 0, y: 0, z: globalIndex * 3.4 };

      const partType = (part.part_type || "").toLowerCase();
      if (partType === "promoter") {
        addPromoterAnnotation(viewer, startCoord, part.color, labelBg);
      } else if (partType === "rbs") {
        addRBSAnnotation(viewer, startCoord, part.color, labelBg);
      } else if (partType === "terminator") {
        addTerminatorAnnotation(viewer, startCoord, part.color, labelBg);
      }

      drewAnything = true;
    } catch (e) {
      console.warn(`Failed to add model for part ${part.part_id}:`, e);
    }
  });

  if (!drewAnything) return false;

  viewer.zoomTo();
  // Helix extends along Z; rotate to a lateral side view instead of end-on.
  viewer.rotate(90, "x");
  viewer.rotate(20, "y");
  viewer.render();
  return true;
}

function addPromoterAnnotation(viewer, startCoord, color, labelBg) {
  try {
    viewer.addSphere({
      center: {
        x: startCoord.x,
        y: startCoord.y,
        z: startCoord.z + 4,
      },
      radius: 3.2,
      color,
      opacity: 0.22,
    });

    viewer.addSphere({
      center: {
        x: startCoord.x,
        y: startCoord.y,
        z: startCoord.z + 8,
      },
      radius: 0.7,
      color,
      opacity: 0.85,
    });

    viewer.addLabel("TSS", {
      position: {
        x: startCoord.x + 1.5,
        y: startCoord.y + 1.5,
        z: startCoord.z + 9,
      },
      fontSize: 9,
      fontColor: color,
      backgroundColor: labelBg,
      backgroundOpacity: 0.72,
      borderThickness: 0,
    });
  } catch (e) {
    console.warn("Failed to add promoter annotation:", e);
  }
}

function addRBSAnnotation(viewer, startCoord, color, labelBg) {
  try {
    viewer.addLabel("RBS / SD", {
      position: {
        x: startCoord.x + 1.5,
        y: startCoord.y + 2.5,
        z: startCoord.z + 3,
      },
      fontSize: 9,
      fontColor: color,
      backgroundColor: labelBg,
      backgroundOpacity: 0.72,
      borderThickness: 0,
    });

    viewer.addCylinder({
      start: {
        x: startCoord.x,
        y: startCoord.y,
        z: startCoord.z,
      },
      end: {
        x: startCoord.x + 1.5,
        y: startCoord.y + 2.5,
        z: startCoord.z + 3,
      },
      color,
      radius: 0.04,
      opacity: 0.5,
    });
  } catch (e) {
    console.warn("Failed to add RBS annotation:", e);
  }
}

function addTerminatorAnnotation(viewer, startCoord, color, labelBg) {
  try {
    viewer.addCylinder({
      start: { x: startCoord.x - 0.8, y: startCoord.y, z: startCoord.z + 1 },
      end: { x: startCoord.x - 0.8, y: startCoord.y, z: startCoord.z + 9 },
      color,
      radius: 0.18,
      opacity: 0.9,
    });

    viewer.addCylinder({
      start: { x: startCoord.x + 0.8, y: startCoord.y, z: startCoord.z + 1 },
      end: { x: startCoord.x + 0.8, y: startCoord.y, z: startCoord.z + 9 },
      color,
      radius: 0.18,
      opacity: 0.9,
    });

    viewer.addCylinder({
      start: { x: startCoord.x - 0.8, y: startCoord.y, z: startCoord.z + 1 },
      end: { x: startCoord.x + 0.8, y: startCoord.y, z: startCoord.z + 1 },
      color,
      radius: 0.12,
      opacity: 0.7,
    });

    viewer.addSphere({
      center: { x: startCoord.x, y: startCoord.y, z: startCoord.z + 10.2 },
      radius: 1.1,
      color,
      opacity: 0.9,
    });

    viewer.addLabel("Terminator hairpin", {
      position: {
        x: startCoord.x + 2,
        y: startCoord.y,
        z: startCoord.z + 10.5,
      },
      fontSize: 9,
      fontColor: color,
      backgroundColor: labelBg,
      backgroundOpacity: 0.72,
      borderThickness: 0,
    });
  } catch (e) {
    console.warn("Failed to add terminator annotation:", e);
  }
}

export default function PreviewPanel({ circuit, selectedUid }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState(null);

  const partIds = circuit.map((p) => p.part_id).filter(Boolean);
  const structureKey = circuit
    .map((p) => `${p.part_id}:${sanitizeDna(p.sequence).length}`)
    .join("|");

  const species =
    circuit.length > 0
      ? extractOrganism(circuit[0].description || "", circuit[0].source)
      : "Escherichia coli";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !partIds.length) {
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
      setRenderError(null);
      return undefined;
    }

    let cancelled = false;
    let cancelPaint = null;
    setLoading(true);
    setRenderError(null);

    const mountViewer = (dnaStructure) => {
      if (cancelled) return;

      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
      container.replaceChildren();

      cancelPaint = whenPaintable(() => {
        if (cancelled) return;
        try {
          const viewer = createViewer(container, {
            backgroundColor: stageBackground(theme),
          });
          viewerRef.current = viewer;

          const rendered = renderDnaHelix(viewer, dnaStructure, labelBackground(theme));
          if (!rendered) {
            setRenderError("No renderable DNA sequence for this circuit.");
          } else {
            viewer.resize();
            viewer.render();
          }
        } catch (e) {
          console.error("3Dmol init error:", e);
          setRenderError("3D preview failed to initialize.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      });
    };

    const hasSequences = circuit.some((p) => sanitizeDna(p.sequence).length > 0);
    const payload = {
      parts: circuitPartsPayload(circuit),
      preview: true,
    };

    const loadStructure = hasSequences
      ? Promise.resolve(buildStructureFromCircuit(circuit, typeColor))
      : api.post("/circuits/dna-structure", payload).then(({ data }) => data);

    loadStructure
      .then((data) => {
        if (!cancelled) mountViewer(data);
      })
      .catch(() => {
        if (cancelled) return;
        const local = buildStructureFromCircuit(circuit, typeColor);
        if (local.total_length >= 2) {
          mountViewer(local);
        } else {
          setRenderError("Could not load DNA structure for preview.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      cancelPaint?.();
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
  }, [structureKey, partIds.join("|"), theme]);

  return (
    <div className="viewer construct-viewer">
      <div className="viewer-head">
        <div className="viewer-titles">
          <div className="viewer-title">Assembled construct</div>
          <div className="viewer-subtitle">
            <span style={{ fontStyle: "italic" }}>{species}</span> · schematic
            B-DNA
          </div>
        </div>
        <div className="viewer-tools">
          <span className="prov prov-computed">computed</span>
        </div>
      </div>

      <div className="viewer-stage">
        <div ref={containerRef} className="preview-canvas" />

        {loading && (
          <div className="viewer-overlay">
            <span className="loading-row">
              <span className="pulse-bar" aria-hidden="true" />
              Building construct model…
            </span>
          </div>
        )}

        {!partIds.length && (
          <div className="viewer-overlay">
            <div className="empty">
              <p className="empty-title">No construct to model</p>
              <p className="empty-body">
                Add parts to the canvas to see them assembled along a single
                DNA molecule.
              </p>
            </div>
          </div>
        )}

        {renderError && !loading && (
          <div className="viewer-overlay">
            <p className="warn-text">{renderError}</p>
          </div>
        )}
      </div>

      <div className="viewer-foot">
        <div className="seq-legend" style={{ marginLeft: 0 }}>
          {circuit.map((part) => (
            <span
              key={part.uid}
              className={`seq-legend-item ${selectedUid === part.uid ? "on" : ""}`}
              data-type={typeKey(part.part_type)}
            >
              <span className="sw" aria-hidden="true" />
              {part.part_id}
            </span>
          ))}
        </div>
        <p className="hint" style={{ flexBasis: "100%" }}>
          Helix colours mark part boundaries. The terminator hairpin and RBS
          annotations represent their functional RNA-level structures, not their
          DNA form.
        </p>
      </div>
    </div>
  );
}
