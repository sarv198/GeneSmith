import { useEffect, useRef, useState } from "react";
import $3Dmol from "3dmol";
import { api } from "../api/client.js";

function downloadSvg(svg, filename) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CircuitDiagram({ circuitSvg, partIds, parts, showHelix = true }) {
  const [dnaStructure, setDnaStructure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const viewerRef = useRef(null);

  const ids =
    partIds?.length > 0
      ? partIds
      : (parts || []).map((part) => part.part_id).filter(Boolean);

  useEffect(() => {
    if (!showHelix || !ids.length) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .post("/circuits/dna-structure", { part_ids: ids })
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
  }, [ids.join("|")]);

  useEffect(() => {
    if (!dnaStructure?.assembled_sequence) return undefined;
    const container = document.getElementById("circuit-helix");
    if (!container) return undefined;

    const viewer = $3Dmol.createViewer(container, { backgroundColor: "#1a0a2e" });
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

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    if (spinning) {
      viewer.spin("y", 1);
    } else {
      viewer.spin(false);
    }
    return () => viewer.spin(false);
  }, [spinning, dnaStructure]);

  return (
    <div className="circuit-diagram">
      <section className="circuit-map-section">
        <div className="section-header">
          <h3>Circuit Map</h3>
          {circuitSvg && (
            <button type="button" onClick={() => downloadSvg(circuitSvg, "circuit_map.svg")}>
              Download SVG
            </button>
          )}
        </div>
        {circuitSvg ? (
          <div
            className="circuit-svg-wrap"
            dangerouslySetInnerHTML={{ __html: circuitSvg }}
          />
        ) : (
          <p className="viewer-hint">No circuit map available.</p>
        )}
        <div className="circuit-legend">
          <span><i style={{ background: "#ff9999" }} /> Promoter</span>
          <span>→ RBS</span>
          <span><i style={{ background: "#99ccff" }} /> ═══ Gene</span>
          <span><i style={{ background: "#99ff99" }} /> ■ Terminator</span>
          <span><i style={{ background: "#ffcc99" }} /></span>
        </div>
      </section>

      {showHelix && (
      <section className="circuit-helix-section">
        <div className="section-header">
          <h3>3D Circuit DNA</h3>
          <button type="button" onClick={() => setSpinning((value) => !value)}>
            {spinning ? "Stop rotation" : "Rotate helix"}
          </button>
        </div>
        {loading && <p className="viewer-loading">Building DNA helix…</p>}
        <div
          id="circuit-helix"
          className="viewer-canvas"
          style={{ width: "100%", height: 220, borderRadius: 12 }}
        />
        {dnaStructure?.trimmed && (
          <p className="viewer-hint">
            Showing first/last 150bp of {dnaStructure.total_length}bp circuit
          </p>
        )}
      </section>
      )}
    </div>
  );
}
