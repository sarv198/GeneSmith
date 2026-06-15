import { useEffect, useState } from "react";
import * as NGL from "ngl";
import { api } from "../api/client.js";
import { aminoAcidColor } from "../utils/aminoAcidColors.js";

function safeId(partId) {
  return String(partId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function AminoAcidSequence({ sequence }) {
  if (!sequence) return null;
  const lines = [];
  for (let i = 0; i < sequence.length; i += 10) {
    lines.push(sequence.slice(i, i + 10));
  }
  return (
    <div className="aa-sequence-block">
      {lines.map((line, lineIndex) => {
        const offset = lineIndex * 10;
        return (
          <div key={offset} className="aa-line">
            <span className="aa-line-number">{offset + 1}</span>
            {line.split("").map((residue, index) => (
              <span
                key={`${offset}-${index}`}
                className="aa-residue"
                style={{ color: aminoAcidColor(residue) }}
              >
                {residue}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function ProteinViewer3D({ aminoAcidSequence, genePart }) {
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const viewportId = `protein-viewport-${safeId(genePart.part_id)}`;
  const sequence = aminoAcidSequence || "";
  const pdbUrl = structureData?.pdb_url;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/parts/${genePart.part_id}/structure`)
      .then(({ data }) => {
        if (!cancelled) setStructureData(data);
      })
      .catch(() => {
        if (!cancelled) setStructureData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [genePart.part_id]);

  useEffect(() => {
    if (!pdbUrl) return undefined;
    const stage = new NGL.Stage(viewportId, { backgroundColor: "#1a0a2e" });
    stage
      .loadFile(pdbUrl, { defaultRepresentation: false })
      .then((component) => {
        component.addRepresentation("cartoon", {
          colorScheme: "bfactor",
          smoothSheet: true,
        });
        component.addRepresentation("surface", {
          opacity: 0.15,
          colorScheme: "electrostatic",
        });
        component.autoView();
        stage.handleResize();
      })
      .catch(() => {});
    return () => stage.dispose();
  }, [pdbUrl, viewportId]);

  return (
    <div className="viewer-panel protein-viewer-3d">
      <h3>Predicted Protein Structure</h3>
      <p className="viewer-subtitle">
        {sequence.length} amino acids | AlphaFold confidence coloring
      </p>

      {loading && <p className="viewer-loading">Loading protein structure…</p>}

      {!loading && pdbUrl && (
        <div
          id={viewportId}
          className="viewer-canvas"
          style={{ width: "100%", height: 220, borderRadius: 12 }}
        />
      )}

      {!loading && !pdbUrl && (
        <p className="viewer-hint">
          3D structure prediction unavailable — showing sequence only
        </p>
      )}

      <AminoAcidSequence sequence={sequence} />
    </div>
  );
}
