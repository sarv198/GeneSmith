import { useEffect, useState } from "react";
import * as NGL from "ngl";
import { api } from "../api/client.js";
import { aminoAcidColor } from "../utils/aminoAcidColors.js";

function safeId(partId) {
  return String(partId || "protein").replace(/[^a-zA-Z0-9_-]/g, "_");
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

export default function ProteinViewer3D({
  aminoAcidSequence,
  genePart,
  large = false,
}) {
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const viewportId = `protein-viewport-${safeId(genePart?.part_id)}`;
  const sequence = aminoAcidSequence || "";
  const pdbUrl = structureData?.pdb_url;
  const pdbContent = structureData?.pdb_content;
  const source = structureData?.source;

  useEffect(() => {
    if (!sequence) {
      setStructureData(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    api
      .post("/circuits/protein-structure", {
        amino_acid_sequence: sequence,
        part_id: genePart?.part_id || null,
      })
      .then(({ data }) => {
        if (!cancelled) setStructureData(data);
      })
      .catch(() => {
        if (!cancelled) {
          setStructureData(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sequence, genePart?.part_id]);

  useEffect(() => {
    if (!pdbUrl && !pdbContent) return undefined;

    const stage = new NGL.Stage(viewportId, { backgroundColor: "#1a0a2e" });
    let objectUrl = null;

    const loadTarget = pdbUrl
      ? pdbUrl
      : (() => {
          objectUrl = URL.createObjectURL(
            new Blob([pdbContent], { type: "chemical/x-pdb" }),
          );
          return objectUrl;
        })();

    stage
      .loadFile(loadTarget, { defaultRepresentation: false })
      .then((component) => {
        component.addRepresentation("cartoon", {
          colorScheme: source === "alphafold" ? "bfactor" : "chainid",
          smoothSheet: true,
        });
        component.addRepresentation("surface", {
          opacity: 0.12,
          colorScheme: "electrostatic",
        });
        component.autoView();
        stage.handleResize();
      })
      .catch(() => {});

    return () => {
      stage.dispose();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdbUrl, pdbContent, viewportId, source]);

  const canvasClass = large
    ? "visualize-canvas visualize-canvas-large"
    : "viewer-canvas";
  const panelClass = large
    ? "visualize-panel visualize-panel-large protein-viewer-3d"
    : "viewer-panel protein-viewer-3d";

  return (
    <div className={panelClass}>
      <h3 className="visualize-panel-title">Predicted Protein Structure</h3>
      <p className="visualize-panel-subtitle">
        {sequence.length > 0
          ? `${sequence.length} amino acids`
          : "No protein sequence"}{" "}
        {source === "alphafold" && "| AlphaFold confidence coloring"}
        {source === "esmfold" && "| ESMFold structure prediction"}
        {source === "rcsb" && "| Experimental structure (RCSB)"}
      </p>

      {loading && <p className="viewer-loading">Loading protein structure…</p>}

      {!loading && (pdbUrl || pdbContent) && (
        <div id={viewportId} className={canvasClass} />
      )}

      {!loading && !pdbUrl && !pdbContent && (
        <p className="viewer-hint">
          {loadError
            ? "3D structure prediction unavailable for this sequence."
            : "Run Predict on the Build page to generate a protein sequence."}
        </p>
      )}

      {!large && <AminoAcidSequence sequence={sequence} />}
    </div>
  );
}
