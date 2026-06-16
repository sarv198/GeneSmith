import { useEffect, useRef, useState } from "react";
import { createViewer } from "3dmol";
import { typeColor } from "../api/client.js";
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

export default function CircuitHelixViewer({ circuit }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);

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

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const viewer = createViewer(container, { backgroundColor: "#0f172a" });
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
      cancelAnimationFrame(raf);
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
  }, [structureKey]);

  return (
    <div className="visualize-panel visualize-panel-large circuit-helix-viewer">
      <h3 className="visualize-panel-title">Circuit DNA Construct</h3>
      <p className="visualize-panel-subtitle">
        Full assembled helix from your circuit parts
      </p>
      {error && <p className="warn-text">{error}</p>}
      <div
        ref={containerRef}
        className="visualize-canvas visualize-canvas-large"
      />
    </div>
  );
}
