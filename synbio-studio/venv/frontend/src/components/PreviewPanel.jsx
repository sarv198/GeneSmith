import { useEffect, useRef, useState } from "react";
import { createViewer } from "3dmol";
import { api, typeColor } from "../api/client.js";
import { extractOrganism } from "../utils/partDisplay.js";
import { dnaComplement } from "../utils/aminoAcidColors.js";

function sanitizeDna(seq) {
  return (seq || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .toUpperCase()
    .replace(/[^ATCG]/g, "");
}

function buildLocalStructure(circuit) {
  let full = "";
  const parts_map = circuit.map((part) => {
    const start = full.length;
    const seq = sanitizeDna(part.sequence);
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

function renderDnaHelix(viewer, dnaStructure) {
  const assembled = dnaStructure.assembled_sequence;
  let modelIndex = 0;

  dnaStructure.parts_map.forEach((part) => {
    const segment = sanitizeDna(assembled.slice(part.start, part.end));
    if (segment.length < 4) return;

    const complement = dnaComplement(segment);
    viewer.addModel(`>strand1\n${segment}\n>strand2\n${complement}`, "fasta");
    viewer.setStyle(
      { model: modelIndex },
      {
        stick: { color: part.color, radius: 0.3 },
        sphere: { color: part.color, scale: 0.25 },
      },
    );
    modelIndex += 1;
  });

  if (modelIndex === 0) return false;

  viewer.zoomTo();
  viewer.render();
  return true;
}

export default function PreviewPanel({ circuit }) {
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
    setLoading(true);
    setRenderError(null);

    const mountViewer = (dnaStructure) => {
      if (cancelled) return;

      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
      container.replaceChildren();

      try {
        const viewer = createViewer(container, {
          backgroundColor: "#e8e0c8",
        });
        viewerRef.current = viewer;

        const rendered = renderDnaHelix(viewer, dnaStructure);
        if (!rendered) {
          setRenderError("No renderable DNA sequence for this circuit.");
        } else {
          viewer.resize();
          viewer.render();
        }
      } catch {
        setRenderError("3D preview failed to initialize.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    api
      .post("/circuits/dna-structure", { part_ids: partIds })
      .then(({ data }) => mountViewer(data))
      .catch(() => {
        if (cancelled) return;
        const local = buildLocalStructure(circuit);
        if (local.total_length >= 4) {
          mountViewer(local);
        } else {
          setRenderError("Could not load DNA structure for preview.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
  }, [structureKey, partIds.join("|")]);

  return (
    <aside className="preview-panel">
      <h3 className="preview-title">PREVIEW Model</h3>
      <p className="preview-species">{species}</p>
      {loading && <p className="hint">Building preview…</p>}
      {!partIds.length && (
        <p className="hint preview-empty">Add parts to the circuit to preview assembly.</p>
      )}
      {renderError && !loading && <p className="warn-text">{renderError}</p>}
      <div
        ref={containerRef}
        className="preview-canvas"
        style={{ width: "100%", height: 280, minHeight: 280 }}
      />
    </aside>
  );
}
