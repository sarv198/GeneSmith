import { useEffect, useRef, useState } from "react";
import $3Dmol from "3dmol";
import { typeColor } from "../api/client.js";
import { extractOrganism } from "../utils/partDisplay.js";

function buildLocalStructure(circuit) {
  let full = "";
  const parts_map = circuit.map((part) => {
    const start = full.length;
    const seq = (part.sequence || "").replace(/\s/g, "").toUpperCase();
    full += seq;
    return {
      part_id: part.part_id,
      start,
      end: full.length,
      color: part.color || typeColor(part.part_type),
    };
  });
  return {
    assembled_sequence: full,
    parts_map,
    total_length: full.length,
    trimmed: false,
  };
}

export default function PreviewPanel({ circuit }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const partIds = circuit.map((p) => p.part_id).filter(Boolean);

  const species =
    circuit.length > 0
      ? extractOrganism(circuit[0].description || "", circuit[0].source)
      : "Escherichia coli";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !circuit.length) {
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
      return undefined;
    }

    setLoading(true);
    const dnaStructure = buildLocalStructure(circuit);

    const timer = window.setTimeout(() => {
      container.innerHTML = "";
      const viewer = $3Dmol.createViewer(container, {
        backgroundColor: "#e8e0c8",
      });
      viewerRef.current = viewer;

      const assembled = dnaStructure.assembled_sequence.replace(/\./g, "");
      let modelIndex = 0;
      dnaStructure.parts_map.forEach((part) => {
        const segment = assembled.slice(part.start, part.end).replace(/[^ATCG]/gi, "");
        if (segment.length < 3) return;
        viewer.addModel(`>part_${part.part_id}\n${segment}`, "fasta");
        viewer.setStyle(
          { model: modelIndex },
          { stick: { color: part.color, radius: 0.35 } },
        );
        modelIndex += 1;
      });

      if (modelIndex > 0) {
        viewer.zoomTo();
        viewer.render();
      }
      setLoading(false);
    }, 50);

    return () => {
      window.clearTimeout(timer);
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
  }, [circuit.map((p) => `${p.part_id}:${p.sequence}`).join("|")]);

  return (
    <aside className="preview-panel">
      <h3 className="preview-title">PREVIEW Model</h3>
      <p className="preview-species">{species}</p>
      {loading && <p className="hint">Building preview…</p>}
      {!partIds.length && (
        <p className="hint preview-empty">Add parts to the circuit to preview assembly.</p>
      )}
      <div
        ref={containerRef}
        className="preview-canvas"
        style={{ width: "100%", height: 280, minHeight: 280 }}
      />
    </aside>
  );
}
