import { aminoAcidColor } from "../utils/aminoAcidColors.js";
import { firstOfType, partLabel } from "../utils/circuit.js";
import { IconCopy } from "./Icons.jsx";

const CLASSES = [
  { label: "Hydrophobic", color: "#f97316", set: "AILMFWYV" },
  { label: "Polar", color: "#22c55e", set: "STNQ" },
  { label: "Basic", color: "#3b82f6", set: "KRH" },
  { label: "Acidic", color: "#ef4444", set: "DE" },
  { label: "Other", color: "#94a3b8", set: "CGP" },
];

function classCounts(sequence) {
  const counts = CLASSES.map(() => 0);
  for (const residue of sequence) {
    const index = CLASSES.findIndex((c) => c.set.includes(residue));
    counts[index >= 0 ? index : CLASSES.length - 1] += 1;
  }
  return counts;
}

export default function ProteinView({
  aminoAcidSequence,
  circuit,
  proteinCanBeProduced,
  onOpenStructure,
}) {
  const gene = firstOfType(circuit, "gene");
  const sequence = aminoAcidSequence || "";

  if (!sequence) {
    return (
      <div className="empty">
        <p className="empty-title">No protein product yet</p>
        <p className="empty-body">
          {gene
            ? "Run the model to translate the coding sequence into its protein product."
            : "Add a gene (CDS) to the construct, then run the model to see the translated protein."}
        </p>
      </div>
    );
  }

  // UniProt-style blocks: 60 residues per line in groups of 10.
  const lines = [];
  for (let i = 0; i < sequence.length; i += 60) {
    const chunk = sequence.slice(i, i + 60);
    const groups = [];
    for (let j = 0; j < chunk.length; j += 10) {
      groups.push(chunk.slice(j, j + 10));
    }
    lines.push({ offset: i, groups });
  }
  const counts = classCounts(sequence);

  return (
    <div className="stack">
      <div className="seq-toolbar">
        <span className="chip mono">{sequence.length} aa</span>
        {gene && (
          <span className="chip" data-tip="Coding sequence this protein was translated from">
            {partLabel(gene)}
          </span>
        )}
        <span className="prov prov-computed">computed</span>
        {proteinCanBeProduced === false && (
          <span className="chip chip-warn">
            <span className="dot" aria-hidden="true" />
            Not expressible as assembled
          </span>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => navigator.clipboard?.writeText(sequence)}
          data-tip="Copy the amino acid sequence"
        >
          <IconCopy width={12} height={12} />
          Copy
        </button>
        {onOpenStructure && (
          <button type="button" className="btn btn-sm" onClick={onOpenStructure}>
            Open structure workspace
          </button>
        )}
      </div>

      <div className="aa-seq">
        {lines.map((line) => (
          <div key={line.offset} className="aa-line">
            <span className="aa-line-number">{line.offset + 1}</span>
            <span className="aa-groups">
              {line.groups.map((group, groupIndex) => (
                <span key={groupIndex} className="aa-group">
                  {group.split("").map((residue, index) => (
                    <span
                      key={index}
                      className="aa-residue"
                      style={{ color: aminoAcidColor(residue) }}
                    >
                      {residue}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="stack-sm">
        <div className="sub-label">Residue classes</div>
        <div className="bars">
          {CLASSES.map((klass, index) => (
            <div className="bar-row" key={klass.label}>
              <span className="label">{klass.label}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{
                    width: `${(counts[index] / sequence.length) * 100}%`,
                    background: klass.color,
                  }}
                />
              </span>
              <span className="value">
                {((counts[index] / sequence.length) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
        <p className="hint">
          Translated from the coding sequence — side-chain classes shape how the
          chain folds.
        </p>
      </div>
    </div>
  );
}
