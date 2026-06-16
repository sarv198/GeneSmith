import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

function buildStructurePayload(sequence, genePart) {
  if (sequence) {
    return {
      amino_acid_sequence: sequence,
      part_id: genePart?.part_id || null,
    };
  }
  if (genePart?.part_id) {
    return {
      amino_acid_sequence: "",
      part_id: genePart.part_id,
    };
  }
  return null;
}

export default function ProteinViewer3D({
  aminoAcidSequence,
  genePart,
  large = false,
}) {
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);

  const sequence =
    structureData?.amino_acid_sequence || aminoAcidSequence || "";
  const pdbContent = structureData?.pdb_content;
  const pdbUrl = structureData?.pdb_url;
  const source = structureData?.source;
  const matchType = structureData?.match_type;
  const disclaimer = structureData?.disclaimer;
  const hasStructure = Boolean(pdbContent || pdbUrl);
  const requestKey = `${aminoAcidSequence || ""}|${genePart?.part_id || ""}`;

  useEffect(() => {
    const payload = buildStructurePayload(aminoAcidSequence, genePart);
    if (!payload) {
      setStructureData(null);
      setLoading(false);
      setLoadError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setStructureData(null);

    api
      .post("/circuits/protein-structure", payload)
      .then(({ data }) => {
        if (!cancelled) setStructureData(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setStructureData(null);
          const detail = err.response?.data?.detail;
          const message =
            (typeof detail === "object" && detail?.error) ||
            (typeof detail === "string" ? detail : null) ||
            "Could not resolve a protein structure for this circuit.";
          setLoadError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  useLayoutEffect(() => {
    if (loading || !hasStructure) return undefined;

    const el = viewportRef.current;
    if (!el) return undefined;

    let objectUrl = null;
    let cancelled = false;

    stageRef.current?.dispose();
    stageRef.current = null;
    el.replaceChildren();

    const stage = new NGL.Stage(el, { backgroundColor: "#1a0a2e" });
    stageRef.current = stage;

    const loadTarget = pdbContent
      ? (() => {
          objectUrl = URL.createObjectURL(
            new Blob([pdbContent], { type: "chemical/x-pdb" }),
          );
          return objectUrl;
        })()
      : pdbUrl;

    stage
      .loadFile(loadTarget, { defaultRepresentation: false, ext: "pdb" })
      .then((component) => {
        if (cancelled) return;
        try {
          component.addRepresentation("cartoon", {
            colorScheme: source === "alphafold" ? "bfactor" : "chainid",
            smoothSheet: true,
          });
        } catch (reprErr) {
          console.warn("Cartoon representation failed:", reprErr);
        }
        component.autoView();
        stage.handleResize();
        setLoadError(null);
      })
      .catch((err) => {
        console.error("NGL protein load failed:", err);
        if (!cancelled) {
          setLoadError(
            "Structure data was found but could not be rendered in the 3D viewer.",
          );
        }
      });

    return () => {
      cancelled = true;
      stage.dispose();
      stageRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loading, hasStructure, pdbContent, pdbUrl, source]);

  const canvasClass = large
    ? "visualize-canvas visualize-canvas-large"
    : "viewer-canvas";
  const panelClass = large
    ? "visualize-panel visualize-panel-large protein-viewer-3d"
    : "viewer-panel protein-viewer-3d";

  const subtitleParts = [];
  if (sequence.length > 0) {
    subtitleParts.push(`${sequence.length} amino acids`);
  }
  if (matchType === "exact" && source === "alphafold") {
    subtitleParts.push("AlphaFold confidence coloring");
  } else if (matchType === "closest" && source === "alphafold") {
    subtitleParts.push("Closest AlphaFold homolog");
  } else if (source === "esmfold") {
    subtitleParts.push("ESMFold structure prediction");
  }

  const showCanvas = !loading && hasStructure;

  return (
    <div className={panelClass}>
      <h3 className="visualize-panel-title">Predicted Protein Structure</h3>
      <p className="visualize-panel-subtitle">
        {subtitleParts.length > 0 ? subtitleParts.join(" | ") : "No protein sequence"}
      </p>

      {disclaimer && !loading && (
        <p className="protein-structure-disclaimer">{disclaimer}</p>
      )}

      {loading && <p className="viewer-loading">Loading protein structure…</p>}

      <div
        ref={viewportRef}
        className={canvasClass}
        style={{ display: showCanvas ? "block" : "none" }}
      />

      {!loading && loadError && (
        <p className="viewer-hint warn-text">{loadError}</p>
      )}

      {!loading && !hasStructure && !loadError && (
        <p className="viewer-hint">
          Add a gene/CDS part and run Predict on the Build page to generate a
          protein sequence.
        </p>
      )}

      {!large && <AminoAcidSequence sequence={sequence} />}
    </div>
  );
}
