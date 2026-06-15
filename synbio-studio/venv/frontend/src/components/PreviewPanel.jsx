import { useEffect, useRef, useState } from "react";
import $3Dmol from "3dmol";
import { api } from "../api/client.js";
import { extractOrganism } from "../utils/partDisplay.js";

export default function PreviewPanel({ circuit }) {
  const [dnaStructure, setDnaStructure] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef(null);
  const partIds = circuit.map((p) => p.part_id).filter(Boolean);

  const species =
    circuit.length > 0
      ? extractOrganism(circuit[0].description || "", circuit[0].source)
      : "Escherichia coli";

  useEffect(() => {
    if (!partIds.length) {
      setDnaStructure(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api
      .post("/circuits/dna-structure", { part_ids: partIds })
      .then(({ data }) => {
        if (!cancelled) setDnaStructure(data);
      })
      .catch(() => {
        if (!cancelled) setDnaStructure(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partIds.join("|")]);

  useEffect(() => {
    const container = document.getElementById("preview-helix");
    if (!container || !dnaStructure?.assembled_sequence) return undefined;

    const viewer = $3Dmol.createViewer(container, { backgroundColor: "#fffbec" });
    viewerRef.current = viewer;
    const assembled = dnaStructure.assembled_sequence;

    dnaStructure.parts_map.forEach((part) => {
      const segment = assembled.slice(part.start, part.end).replace(/\./g, "");
      if (!segment) return;
      viewer.addModel(`>part\n${segment}`, "fasta");
      viewer.setStyle({ model: -1 }, { stick: { color: part.color, radius: 0.3 } });
    });

    viewer.zoomTo();
    viewer.render();
    return () => {
      viewer.clear();
      viewerRef.current = null;
    };
  }, [dnaStructure]);

  return (
    <aside className="preview-panel">
      <h3 className="preview-title">PREVIEW Model</h3>
      <p className="preview-species">{species}</p>
      {loading && <p className="hint">Building preview…</p>}
      {!partIds.length && (
        <p className="hint preview-empty">Add parts to the circuit to preview assembly.</p>
      )}
      <div
        id="preview-helix"
        className="preview-canvas"
        style={{ width: "100%", height: 280 }}
      />
    </aside>
  );
}
