import { useEffect, useRef, useState } from "react";
import { createViewer } from "3dmol";
import { typeColor } from "../api/client.js";
import { typeKey } from "../utils/circuit.js";
import { IconReset } from "./Icons.jsx";
import { stageBackground, useTheme } from "../theme.jsx";
import { whenPaintable } from "../utils/paint.js";
import {
  buildStructureFromCircuit,
  sanitizeDna,
  subsampleSequence,
} from "../utils/previewHelix.js";

const HELIX = {
  rise: 0.62,
  radius: 1.35,
  twist: 36,
  maxPointsPerPart: 60,
};

function helixPointHorizontal(globalIndex, strandOffsetDeg = 0) {
  const angleRad = ((globalIndex * HELIX.twist) + strandOffsetDeg) * (Math.PI / 180);
  return {
    x: globalIndex * HELIX.rise,
    y: HELIX.radius * Math.cos(angleRad),
    z: HELIX.radius * Math.sin(angleRad),
  };
}

function segmentHelixGeometryHorizontal(segment, globalStartIndex, color) {
  const maxPts =
    segment.length > 80 ? HELIX.maxPointsPerPart : Math.max(segment.length, 2);
  const sampled = subsampleSequence(segment, maxPts);
  const atoms = [];
  const backbone = [];

  sampled.split("").forEach((_base, i) => {
    const idx = globalStartIndex + i;
    const p1 = helixPointHorizontal(idx, 0);
    const p2 = helixPointHorizontal(idx, 180);
    atoms.push(`C  ${p1.x.toFixed(3)}  ${p1.y.toFixed(3)}  ${p1.z.toFixed(3)}`);
    atoms.push(`N  ${p2.x.toFixed(3)}  ${p2.y.toFixed(3)}  ${p2.z.toFixed(3)}`);
    backbone.push(p1);
  });

  return {
    xyz: `${atoms.length}\nDNA segment\n${atoms.join("\n")}`,
    backbone,
    color,
    pointCount: sampled.length,
  };
}

function renderCircuitHelix(viewer, dnaStructure) {
  const assembled = sanitizeDna(dnaStructure.assembled_sequence);
  if (assembled.length < 2) return false;

  let globalIndex = 0;
  let drewAnything = false;
  let modelIndex = 0;

  dnaStructure.parts_map.forEach((part) => {
    const segment = sanitizeDna(assembled.slice(part.start, part.end));
    if (segment.length < 2) return;

    const geom = segmentHelixGeometryHorizontal(segment, globalIndex, part.color);
    globalIndex += geom.pointCount;

    try {
      viewer.addModel(geom.xyz, "xyz");
      viewer.setStyle(
        { model: modelIndex },
        { sphere: { color: part.color, radius: 0.36 } },
      );
      modelIndex += 1;

      for (let i = 1; i < geom.backbone.length; i++) {
        viewer.addCylinder({
          start: geom.backbone[i - 1],
          end: geom.backbone[i],
          color: part.color,
          radius: 0.12,
        });
      }
      drewAnything = true;
    } catch (e) {
      console.warn(`Failed to render helix segment for ${part.part_id}:`, e);
    }
  });

  if (!drewAnything) return false;

  viewer.zoomTo();
  viewer.rotate(12, "y");
  viewer.rotate(8, "x");
  viewer.zoom(1.55);
  viewer.render();
  return true;
}

export default function CircuitHelixViewer({ circuit, selectedUid }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const structureKey = circuit
    .map((p) => `${p.part_id}:${sanitizeDna(p.sequence).length}`)
    .join("|");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !circuit.length) {
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setError(null);

    if (viewerRef.current) {
      viewerRef.current.clear();
      viewerRef.current = null;
    }
    container.replaceChildren();

    const cancelPaint = whenPaintable(() => {
      if (cancelled) return;
      try {
        const viewer = createViewer(container, {
          backgroundColor: stageBackground(theme),
        });
        viewerRef.current = viewer;
        const structure = buildStructureFromCircuit(circuit, typeColor);
        const ok = renderCircuitHelix(viewer, structure);
        if (!ok) {
          setError("No renderable DNA for this circuit.");
        } else {
          viewer.resize();
          viewer.render();
        }
      } catch (e) {
        console.error("Circuit helix viewer error:", e);
        setError("Failed to load circuit DNA model.");
      }
    });

    return () => {
      cancelled = true;
      cancelPaint();
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
  }, [structureKey, theme]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    try {
      viewer.spin(spinning ? "y" : false, spinning ? 1 : undefined);
    } catch {
      /* spin is presentation only */
    }
    return () => {
      try {
        viewer.spin(false);
      } catch {
        /* ignore */
      }
    };
  }, [spinning, structureKey, theme]);

  const totalBp = circuit.reduce(
    (sum, part) => sum + sanitizeDna(part.sequence).length,
    0,
  );

  return (
    <div className="viewer viewer-lg circuit-helix-viewer">
      <div className="viewer-head">
        <div className="viewer-titles">
          <div className="viewer-title">Assembled DNA construct</div>
          <div className="viewer-subtitle">
            {circuit.length} parts · {totalBp} bp · schematic double helix
          </div>
        </div>
        <div className="viewer-tools">
          <span className="prov prov-computed">computed</span>
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={spinning}
            onClick={() => setSpinning((value) => !value)}
            data-tip="Rotate the model continuously"
            data-tip-align="end"
          >
            {spinning ? "Stop" : "Spin"}
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              const viewer = viewerRef.current;
              if (!viewer) return;
              viewer.zoomTo();
              viewer.zoom(1.55);
              viewer.render();
            }}
            aria-label="Reset the view"
            data-tip="Reset view"
            data-tip-align="end"
          >
            <IconReset />
          </button>
        </div>
      </div>

      <div className="viewer-stage">
        <div ref={containerRef} className="viewer-canvas" />
        {error && (
          <div className="viewer-overlay">
            <p className="warn-text">{error}</p>
          </div>
        )}
        {!circuit.length && (
          <div className="viewer-overlay">
            <div className="empty">
              <p className="empty-title">No construct yet</p>
              <p className="empty-body">
                Build a circuit to see its parts assembled along one DNA
                molecule.
              </p>
            </div>
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
      </div>
    </div>
  );
}
