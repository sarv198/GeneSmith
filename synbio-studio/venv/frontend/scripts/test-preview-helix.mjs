/**
 * Verifies different circuits produce different 3D helix fingerprints.
 * Run: node scripts/test-preview-helix.mjs
 */
import {
  buildStructureFromCircuit,
  helixFingerprint,
  sanitizeDna,
} from "../src/utils/previewHelix.js";

function typeColor(t) {
  const map = {
    promoter: "#e74c3c",
    rbs: "#3498db",
    cds: "#2ecc71",
    terminator: "#9b59b6",
  };
  return map[t] || "#95a5a6";
}

const promoterOnly = [
  {
    part_id: "J23100",
    part_type: "promoter",
    sequence: "TTGACAGCTAGCTCAGTCCTAGGTACATGCTAGC",
  },
];

const fullCircuit = [
  {
    part_id: "J23100",
    part_type: "promoter",
    sequence: "TTGACAGCTAGCTCAGTCCTAGGTACATGCTAGC",
  },
  {
    part_id: "B0034",
    part_type: "rbs",
    sequence: "AAAGAGGAGAAA",
  },
  {
    part_id: "E0040",
    part_type: "cds",
    sequence: "ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAAAGAACTATATTTTTCAAAGATGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAAGGTGATACCCTTGTTAATAGAATCGAGTTAAAAGGTATTGATTTTAAAGAAGATGGAAACATTCTTGGACACAAATTGGAATACAACTATAACTCACACAATGTATACATCATGGCAGACAAACAAAAGAATGGAATCAAAGTTAACTTCAAAATTAGACACAACATTGAAGATGGAAGCGTTCAACTAGCAGACCATTATCAACAAAATACTCCAATTGGCGATGGCCCTGTCCTTTTACCAGACAACCATTACCTGTCCACACAATCTGCCCTTTCGAAAGATCCCAACGAAAAGAGAGACCACATGGTCCTTCTTGAGTTTGTAACAGCTGCTGGGATTACACATGGCATGGATGAACTATACAAATAA",
  },
  {
    part_id: "B0015",
    part_type: "terminator",
    sequence: "CCAGGCATCAAATAAAACGAAAGGCTCAGTCGAAAGACTGGGCCTTTCGTTTTATCTGTTGTTTGTCGGTGAACGCTCTCTACTAGAGTCACACTGGCTCACCTTCGGGTGGGCCTTTCTGCGTTTAT",
  },
];

const differentGene = [
  {
    part_id: "J23119",
    part_type: "promoter",
    sequence: "TTGACAGCTAGCTCAGTCCTAGGTATTGTGCTAGC",
  },
  {
    part_id: "B0032",
    part_type: "rbs",
    sequence: "TCACACAGGAAAG",
  },
  {
    part_id: "C0062",
    part_type: "cds",
    sequence: "ATGAAAGACAGAATACCATTACCTGTCCACACAATCTGCCCTTTCGAAAGATCCCAACGAAAAG",
  },
];

const structures = [
  ["promoter-only", buildStructureFromCircuit(promoterOnly, typeColor)],
  ["full-4-part", buildStructureFromCircuit(fullCircuit, typeColor)],
  ["different-gene", buildStructureFromCircuit(differentGene, typeColor)],
];

const fingerprints = structures.map(([name, s]) => {
  const fp = helixFingerprint(s);
  return { name, length: s.total_length, fp };
});

console.log("Circuit structure tests:\n");
fingerprints.forEach(({ name, length, fp }) => {
  console.log(`  ${name}: ${length} bp`);
  console.log(`    fingerprint: ${fp.slice(0, 120)}${fp.length > 120 ? "…" : ""}\n`);
});

const unique = new Set(fingerprints.map((f) => f.fp));
if (unique.size !== fingerprints.length) {
  console.error("FAIL: fingerprints are not all unique");
  process.exit(1);
}

if (fingerprints[0].length >= fingerprints[1].length) {
  console.error("FAIL: full circuit should be longer than promoter-only");
  process.exit(1);
}

if (sanitizeDna(fullCircuit[2].sequence).length > 100) {
  const shortCds = [
    ...fullCircuit.slice(0, 2),
    { ...fullCircuit[2], sequence: "ATGAAA" },
    fullCircuit[3],
  ];
  const shortFp = helixFingerprint(buildStructureFromCircuit(shortCds, typeColor));
  if (shortFp === fingerprints[1].fp) {
    console.error("FAIL: shortened CDS should change fingerprint");
    process.exit(1);
  }
}

console.log("PASS: all circuit fingerprints differ as expected");
