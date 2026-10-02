import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as NGL from "ngl";
import { api } from "../api/client.js";
import { stageBackground, useTheme } from "../theme.jsx";
import {
  IconCollapse,
  IconExpand,
  IconReset,
  IconTarget,
} from "./Icons.jsx";

const REPRESENTATIONS = [
  { id: "cartoon", label: "Cartoon" },
  { id: "surface", label: "Surface" },
  { id: "ball+stick", label: "Ball & stick" },
];

function buildStructurePayload(sequence, genePart, circuit, proteinCanBeProduced) {
  const parts = (circuit || []).map(({ part_id, part_type, sequence: dna }) => ({
    part_id,
    part_type,
    sequence: dna || "",
  }));

  const payload = {
    parts,
    protein_can_be_produced: proteinCanBeProduced,
  };

  if (sequence) {
    return {
      ...payload,
      amino_acid_sequence: sequence,
      part_id: genePart?.part_id || null,
    };
  }
  if (genePart?.part_id) {
    return {
      ...payload,
      amino_acid_sequence: "",
      part_id: genePart.part_id,
    };
  }
  const cdsPart = (circuit || []).find((part) =>
    ["cds", "gene"].includes((part.part_type || "").toLowerCase()),
  );
  if (cdsPart?.part_id) {
    return {
      ...payload,
      amino_acid_sequence: "",
      part_id: cdsPart.part_id,
    };
  }
  if (parts.length > 0) {
    return {
      ...payload,
      amino_acid_sequence: "",
      part_id: null,
    };
  }
  return null;
}

export default function ProteinViewer3D({
  aminoAcidSequence,
  genePart,
  circuit = [],
  proteinCanBeProduced = null,
  large = false,
}) {
  const { theme } = useTheme();
  const [structureData, setStructureData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [representation, setRepresentation] = useState("cartoon");
  const [colorScheme, setColorScheme] = useState(null);
  const [ready, setReady] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const componentRef = useRef(null);

  const sequence =
    structureData?.amino_acid_sequence || aminoAcidSequence || "";
  const pdbContent = structureData?.pdb_content;
  const pdbUrl = structureData?.pdb_url;
  const source = structureData?.source;
  const matchType = structureData?.match_type;
  const disclaimer = structureData?.disclaimer;
  const matchedName = structureData?.matched_protein_name;
  const matchIdentity = structureData?.match_identity;
  const uniprotId = structureData?.uniprot_id;
  const hasStructure = Boolean(pdbContent || pdbUrl);
  const isAlphafold = source === "alphafold";
  const requestKey = [
    aminoAcidSequence || "",
    genePart?.part_id || "",
    proteinCanBeProduced ?? "",
    (circuit || []).map((p) => `${p.part_id}:${p.sequence || ""}`).join("|"),
  ].join("::");

  useEffect(() => {
    const payload = buildStructurePayload(
      aminoAcidSequence,
      genePart,
      circuit,
      proteinCanBeProduced,
    );
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
      .post("/circuits/protein-structure", payload, { timeout: 120000 })
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

  // Default colouring follows the structure source, as before.
  useEffect(() => {
    setColorScheme(isAlphafold ? "bfactor" : "chainid");
    setRepresentation("cartoon");
  }, [isAlphafold, structureData]);

  useLayoutEffect(() => {
    if (loading || !hasStructure) return undefined;

    const el = viewportRef.current;
    if (!el) return undefined;

    let objectUrl = null;
    let cancelled = false;

    stageRef.current?.dispose();
    stageRef.current = null;
    componentRef.current = null;
    el.replaceChildren();

    const stage = new NGL.Stage(el, { backgroundColor: stageBackground(theme) });
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
        componentRef.current = component;
        component.autoView();
        stage.handleResize();
        setLoadError(null);
        setReady((value) => value + 1);
      })
      .catch((err) => {
        console.error("NGL protein load failed:", err);
        if (!cancelled) {
          setLoadError(
            "Structure data was found but could not be rendered in the 3D viewer.",
          );
        }
      });

    const observer = new ResizeObserver(() => stageRef.current?.handleResize());
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      stage.dispose();
      stageRef.current = null;
      componentRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loading, hasStructure, pdbContent, pdbUrl, source]);

  // Representation and colouring are applied without reloading the model.
  useEffect(() => {
    const component = componentRef.current;
    if (!component || !ready || !colorScheme) return;
    try {
      component.removeAllRepresentations();
      const options = { colorScheme };
      if (representation === "cartoon") options.smoothSheet = true;
      if (representation === "surface") {
        options.opacity = 0.86;
        options.surfaceType = "av";
      }
      if (representation === "ball+stick") options.scale = 0.34;
      component.addRepresentation(representation, options);
    } catch (reprErr) {
      console.warn("Representation change failed:", reprErr);
    }
  }, [ready, representation, colorScheme]);

  // Repaint the stage on theme change without reloading the structure.
  useEffect(() => {
    stageRef.current?.setParameters({ backgroundColor: stageBackground(theme) });
  }, [theme, ready]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (event) => event.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => {
    const id = requestAnimationFrame(() => stageRef.current?.handleResize());
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);

  const provenance =
    matchType === "exact" && isAlphafold
      ? { tag: "sourced", text: `AlphaFold model · UniProt ${uniprotId || "match"}` }
      : matchType === "closest"
        ? {
            tag: "sourced",
            text: `Nearest library match${matchedName ? ` · ${matchedName}` : ""}${
              matchIdentity != null ? ` · ${matchIdentity}% identity` : ""
            }`,
          }
        : source === "esmfold" || matchType === "predicted"
          ? { tag: "predicted", text: "ESMFold structure prediction" }
          : { tag: "sourced", text: "Reference structure" };

  const showCanvas = !loading && hasStructure;

  return (
    <div
      className={`viewer protein-viewer ${large ? "viewer-lg" : "viewer-md"} ${
        fullscreen ? "viewer-fullscreen" : ""
      }`}
    >
      <div className="viewer-head">
        <div className="viewer-titles">
          <div className="viewer-title">Protein structure</div>
          <div className="viewer-subtitle">
            {sequence.length > 0 ? `${sequence.length} residues · ` : ""}
            {provenance.text}
          </div>
        </div>

        <div className="viewer-tools">
          <span className={`prov prov-${provenance.tag === "predicted" ? "predicted" : "source"}`}>
            {provenance.tag}
          </span>
        </div>
      </div>

      {showCanvas && (
        <div className="viewer-controls">
          <div className="seg-control" role="group" aria-label="Representation">
            {REPRESENTATIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={representation === option.id}
                onClick={() => setRepresentation(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="seg-control" role="group" aria-label="Colour scheme">
            <button
              type="button"
              aria-pressed={colorScheme === "chainid"}
              onClick={() => setColorScheme("chainid")}
              data-tip="Colour by polypeptide chain"
            >
              Chain
            </button>
            <button
              type="button"
              aria-pressed={colorScheme === "sstruc"}
              onClick={() => setColorScheme("sstruc")}
              data-tip="Colour by α-helix, β-sheet and loop"
            >
              Structure
            </button>
            {isAlphafold && (
              <button
                type="button"
                aria-pressed={colorScheme === "bfactor"}
                onClick={() => setColorScheme("bfactor")}
                data-tip="AlphaFold pLDDT confidence per residue"
              >
                Confidence
              </button>
            )}
          </div>

          <div className="viewer-tools">
            <button
              type="button"
              className="btn-icon"
              onClick={() => componentRef.current?.autoView(400)}
              aria-label="Recentre the model"
              data-tip="Recentre"
            >
              <IconTarget />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setRepresentation("cartoon");
                setColorScheme(isAlphafold ? "bfactor" : "chainid");
                componentRef.current?.autoView(400);
              }}
              aria-label="Reset the view"
              data-tip="Reset view"
            >
              <IconReset />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setFullscreen((value) => !value)}
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              data-tip={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
              data-tip-align="end"
            >
              {fullscreen ? <IconCollapse /> : <IconExpand />}
            </button>
          </div>
        </div>
      )}

      <div className="viewer-stage">
        <div
          ref={viewportRef}
          className="viewer-canvas"
          style={{ display: showCanvas ? "block" : "none" }}
        />

        {loading && (
          <div className="viewer-overlay">
            <span className="loading-row">
              <span className="pulse-bar" aria-hidden="true" />
              Resolving and loading molecular model…
            </span>
          </div>
        )}

        {!loading && loadError && (
          <div className="viewer-overlay">
            <div className="empty">
              <p className="empty-title">Structure unavailable</p>
              <p className="empty-body">{loadError}</p>
            </div>
          </div>
        )}

        {!loading && !hasStructure && !loadError && (
          <div className="viewer-overlay">
            <div className="empty">
              <p className="empty-title">No structure to show</p>
              <p className="empty-body">
                Select a coding sequence to explore its predicted structure.
              </p>
            </div>
          </div>
        )}
      </div>

      {(disclaimer || showCanvas) && (
        <div className="viewer-foot">
          {disclaimer ? (
            <span>{disclaimer} Shape is indicative, not an experimental structure.</span>
          ) : isAlphafold ? (
            <span>
              Source: AlphaFold DB{uniprotId ? ` · ${uniprotId}` : ""} — a
              computed model, not an experimental structure.
            </span>
          ) : (
            <span>Structure retrieved for the closest matching protein.</span>
          )}
        </div>
      )}
    </div>
  );
}
