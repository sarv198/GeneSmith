import { useState, useEffect, useRef } from "react";

const COLORS = {
  promoter: { bg: "#EEEDFE", text: "#3C3489", border: "#AFA9EC", accent: "#7F77DD" },
  rbs:      { bg: "#E1F5EE", text: "#085041", border: "#5DCAA5", accent: "#1D9E75" },
  gene:     { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB", accent: "#378ADD" },
  term:     { bg: "#FAECE7", text: "#712B13", border: "#F0997B", accent: "#D85A30" },
  mrna:     { bg: "#FAEEDA", text: "#633806", border: "#EF9F27", accent: "#BA7517" },
  protein:  { bg: "#FBEAF0", text: "#72243E", border: "#ED93B1", accent: "#D4537E" },
};

const STEPS = [
  {
    id: "circuit",
    label: "The circuit",
    title: "Four parts. One instruction.",
    desc: "Every engineered gene has four components that work in sequence. Together they form a complete instruction for making a protein — from the signal to start, to the blueprint itself, to the signal to stop.",
    tag: "Overview",
  },
  {
    id: "sigma",
    label: "Sigma factor",
    title: "Sigma factor finds the promoter",
    desc: "RNA polymerase can't bind DNA alone. A sigma (σ) factor protein scans the helix and recognises two conserved sequences — the −35 and −10 boxes — marking the transcription start site.",
    tag: "Transcription · Step 1",
  },
  {
    id: "transcription",
    label: "Transcription",
    title: "RNA polymerase reads the gene",
    desc: "Once bound, RNA polymerase unwinds the double helix and reads the template strand 3'→5', synthesising mRNA 5'→3'. When it hits the terminator hairpin, it falls off and releases the mRNA.",
    tag: "Transcription · Step 2",
  },
  {
    id: "mrna",
    label: "mRNA anatomy",
    title: "The mRNA carries the code",
    desc: "The mRNA has two critical features: a Shine-Dalgarno sequence (the RBS) that recruits the ribosome, and a coding sequence (CDS) that starts with AUG and ends with a stop codon.",
    tag: "Handoff",
  },
  {
    id: "ribosome",
    label: "Ribosome docks",
    title: "The ribosome docks at the RBS",
    desc: "The 30S ribosomal subunit base-pairs with the Shine-Dalgarno sequence on the mRNA. This positions the AUG start codon in the P-site, where the first tRNA carrying methionine is loaded.",
    tag: "Translation · Step 1",
  },
  {
    id: "translation",
    label: "Translation",
    title: "Codons become amino acids",
    desc: "The ribosome moves along the mRNA codon by codon (3 bases = 1 amino acid). Each codon recruits a matching tRNA. Peptide bonds stitch the chain until a stop codon triggers release.",
    tag: "Translation · Step 2",
  },
  {
    id: "protein",
    label: "Protein folds",
    title: "The chain folds into a functional protein",
    desc: "The released amino acid chain spontaneously folds into a 3D structure. Its shape determines function — whether it fluoresces, catalyses a reaction, or senses a molecule in the environment.",
    tag: "Output",
  },
];

function PartChip({ type, label, style = {} }) {
  const c = COLORS[type];
  return (
    <span
      className="theory-chip"
      style={{
        background: c.bg,
        color: c.text,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

function StepCircuit() {
  const parts = [
    { type: "promoter", label: "Promoter", desc: "Signals transcription start. Strength sets how often RNA pol binds." },
    { type: "rbs",      label: "RBS",      desc: "Shine-Dalgarno sequence. Recruits the ribosome to the mRNA." },
    { type: "gene",     label: "Gene (CDS)", desc: "Coding sequence. Encodes the amino acid sequence of your protein." },
    { type: "term",     label: "Terminator", desc: "Hairpin loop. Causes RNA pol to detach and releases mRNA." },
  ];
  const [hovered, setHovered] = useState(null);

  return (
    <div className="theory-viz-stack">
      <div className="theory-circuit-strip">
        {parts.map((p, i) => {
          const c = COLORS[p.type];
          const isHov = hovered === i;
          return (
            <div
              key={p.type}
              className={`theory-circuit-segment ${p.type === "gene" ? "gene" : ""}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHov ? c.accent : c.bg,
                color: isHov ? "#fff" : c.text,
                borderRight: i < 3 ? `1px solid ${c.border}33` : "none",
              }}
            >
              <div className="theory-circuit-segment-label">{p.label}</div>
              <div className="theory-circuit-segment-sub">
                {p.type === "gene"
                  ? "encodes protein"
                  : p.type === "promoter"
                    ? "starts transcription"
                    : p.type === "rbs"
                      ? "starts translation"
                      : "ends transcription"}
              </div>
            </div>
          );
        })}
      </div>

      {hovered !== null && (
        <div
          className="theory-detail-panel"
          style={{
            background: COLORS[parts[hovered].type].bg,
            color: COLORS[parts[hovered].type].text,
          }}
        >
          <strong>{parts[hovered].label}:</strong> {parts[hovered].desc}
        </div>
      )}

      <div className="theory-viz-stack" style={{ gap: 8 }}>
        {[
          { from: "Promoter", to: "RBS", label: "RNA pol transcribes through →", color: "#7F77DD" },
          { from: "RBS", to: "Gene", label: "Ribosome translates →", color: "#1D9E75" },
          { from: "Gene", to: "Terminator", label: "Until stop codon / hairpin →", color: "#D85A30" },
        ].map((row, i) => (
          <div key={i} className="theory-flow-row" style={{ color: row.color }}>
            <span className="theory-flow-dot" style={{ background: row.color }} />
            <span style={{ color: row.color, fontWeight: 600 }}>{row.from}</span>
            <span className="theory-flow-line" style={{ color: row.color }} />
            <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{row.label}</span>
            <span className="theory-flow-line" style={{ color: row.color }} />
            <span style={{ color: row.color, fontWeight: 600 }}>{row.to}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepSigma() {
  const [scanning, setScanning] = useState(true);
  const pos = useRef(0);
  const [sigmaX, setSigmaX] = useState(20);

  useEffect(() => {
    if (!scanning) return;
    const iv = setInterval(() => {
      pos.current = (pos.current + 1) % 100;
      setSigmaX(20 + pos.current * 0.9);
    }, 30);
    return () => clearInterval(iv);
  }, [scanning]);

  const atPromoter = sigmaX > 30 && sigmaX < 130;

  return (
    <div className="theory-viz-stack">
      <div className="theory-viz-controls">
        <button
          type="button"
          className="theory-btn theory-btn-ghost"
          onClick={() => setScanning((s) => !s)}
        >
          {scanning ? "Pause scanning" : "Resume scanning"}
        </button>
        <span className="theory-hint">
          {atPromoter ? "Sigma factor found the −35 / −10 boxes!" : "Sigma factor scanning…"}
        </span>
      </div>

      <svg width="100%" viewBox="0 0 580 200" style={{ overflow: "visible" }}>
        {/* DNA strands */}
        <rect x="20" y="60" width="540" height="12" rx="6" fill="#D3D1C7" opacity="0.5" />
        <rect x="20" y="78" width="540" height="12" rx="6" fill="#D3D1C7" opacity="0.5" />
        {[50,80,110,140,170,200,230,260,290,320,350,380,410,440,470,500,530].map((x) => (
          <line key={x} x1={x} y1="72" x2={x} y2="78" stroke="#94a3b8" strokeWidth="1.5" />
        ))}

        {/* Promoter region */}
        <rect x="30" y="54" width="130" height="42" rx="6" fill={atPromoter ? "#EEEDFE" : "#f1f5f9"} stroke={atPromoter ? "#7F77DD" : "#e2e8f0"} strokeWidth={atPromoter ? 2 : 1} style={{ transition: "all 0.3s" }} />
        <text x="95" y="50" textAnchor="middle" fontSize="11" fill="#3C3489" fontWeight="500">Promoter</text>
        <text x="58" y="106" fontSize="10" fill="#534AB7">−35</text>
        <text x="112" y="106" fontSize="10" fill="#534AB7">−10</text>

        {/* −35 and −10 boxes */}
        <rect x="42" y="59" width="34" height="26" rx="3" fill={atPromoter ? "#AFA9EC" : "#e2e8f0"} opacity="0.7" style={{ transition: "all 0.3s" }} />
        <text x="59" y="75" textAnchor="middle" fontSize="9" fill="#26215C">TTGACA</text>
        <rect x="98" y="59" width="50" height="26" rx="3" fill={atPromoter ? "#AFA9EC" : "#e2e8f0"} opacity="0.7" style={{ transition: "all 0.3s" }} />
        <text x="123" y="75" textAnchor="middle" fontSize="9" fill="#26215C">TATAAT</text>

        {/* TSS marker */}
        <line x1="160" y1="54" x2="160" y2="34" stroke="#D85A30" strokeWidth="1" strokeDasharray="3 2" />
        <text x="162" y="30" fontSize="10" fill="#D85A30">TSS →</text>

        {/* Sigma factor */}
        <g style={{ transform: `translateX(${sigmaX}px)`, transition: scanning ? "none" : "transform 0.3s" }}>
          <ellipse cx="0" cy="145" rx="44" ry="24" fill="#EEEDFE" stroke={atPromoter ? "#7F77DD" : "#AFA9EC"} strokeWidth={atPromoter ? 2 : 1} />
          <ellipse cx="0" cy="145" rx="28" ry="15" fill="#AFA9EC" opacity="0.6" />
          <text x="0" y="141" textAnchor="middle" fontSize="11" fill="#26215C" fontWeight="500">σ factor</text>
          <text x="0" y="153" textAnchor="middle" fontSize="9" fill="#3C3489">scanning…</text>
          {atPromoter && (
            <line x1="0" y1="121" x2="0" y2="98" stroke="#7F77DD" strokeWidth="1.5" markerEnd="url(#arr-s)" />
          )}
        </g>

        {/* RNA Pol waiting */}
        <ellipse cx="420" cy="150" rx="55" ry="28" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1" />
        <ellipse cx="420" cy="150" rx="38" ry="18" fill="#5DCAA5" opacity="0.5" />
        <text x="420" y="146" textAnchor="middle" fontSize="10" fill="#04342C" fontWeight="500">RNA Pol</text>
        <text x="420" y="158" textAnchor="middle" fontSize="9" fill="#085041">waiting to be recruited</text>

        <defs>
          <marker id="arr-s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
      </svg>

      <div className="theory-badge-row">
        {[
          { color: "#7F77DD", label: "σ70 = housekeeping genes" },
          { color: "#378ADD", label: "σ32 = heat shock response" },
          { color: "#1D9E75", label: "RNA polymerase holoenzyme" },
        ].map((p) => (
          <span key={p.label} className="theory-badge">
            <span className="theory-badge-dot" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepTranscription() {
  const [progress, setProgress] = useState(40);
  return (
    <div className="theory-viz-stack">
      <div className="theory-range-row">
        <span className="theory-hint" style={{ whiteSpace: "nowrap" }}>RNA Pol position</span>
        <input type="range" min={10} max={90} value={progress} onChange={(e) => setProgress(+e.target.value)} />
        <span style={{ fontSize: "0.82rem", fontWeight: 700, minWidth: 34, color: "var(--nav-purple)" }}>{progress}%</span>
      </div>

      <svg width="100%" viewBox="0 0 580 200">
        <defs>
          <marker id="arr-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* Part region labels */}
        {[
          { x: 20, w: 80, type: "promoter", label: "Promoter" },
          { x: 100, w: 50, type: "rbs", label: "RBS" },
          { x: 150, w: 230, type: "gene", label: "Gene (CDS)" },
          { x: 380, w: 80, type: "term", label: "Terminator" },
        ].map((r) => (
          <g key={r.label}>
            <rect x={r.x} y={18} width={r.w} height={18} rx={4} fill={COLORS[r.type].bg} stroke={COLORS[r.type].border} strokeWidth={0.8} />
            <text x={r.x + r.w / 2} y={30} textAnchor="middle" fontSize={10} fill={COLORS[r.type].text} fontWeight={500}>{r.label}</text>
          </g>
        ))}

        {/* Template strand */}
        <rect x="20" y="52" width="540" height="12" rx="6" fill="#D3D1C7" opacity="0.5" />
        <text x="14" y="61" textAnchor="end" fontSize={10} fill="#94a3b8">3'</text>
        <text x="566" y="61" fontSize={10} fill="#94a3b8">5'</text>

        {/* Coding strand (peeled back at bubble) */}
        {(() => {
          const polX = 20 + progress * 5.2;
          return (
            <>
              <rect x="20" y="68" width={Math.max(0, polX - 35)} height="12" rx="6" fill="#D3D1C7" opacity="0.5" />
              <rect x={polX + 35} y="68" width={Math.max(0, 540 - (polX + 35 - 20))} height="12" rx="6" fill="#D3D1C7" opacity="0.25" strokeDasharray="4 2" stroke="#94a3b8" strokeWidth={0.5} />
              <text x="14" y="77" textAnchor="end" fontSize={10} fill="#94a3b8">5'</text>

              {/* RNA Pol bubble */}
              <ellipse cx={polX} cy={64} rx={34} ry={24} fill="#E1F5EE" stroke="#1D9E75" strokeWidth={1.5} />
              <ellipse cx={polX} cy={64} rx={20} ry={14} fill="#5DCAA5" opacity={0.6} />
              <text x={polX} y={60} textAnchor="middle" fontSize={9} fill="#04342C" fontWeight={500}>RNA Pol</text>
              <text x={polX} y={70} textAnchor="middle" fontSize={8} fill="#085041">reading →</text>

              {/* mRNA growing */}
              {polX > 60 && (
                <>
                  <path d={`M${polX + 28} 76 Q${polX + 48} 100 ${polX + 60} 120 L${polX + 60} 148`} fill="none" stroke="#EF9F27" strokeWidth={2.5} strokeLinecap="round" />
                  <rect x={Math.max(30, polX - 60)} y={148} width={Math.max(10, polX - 10)} height={14} rx={7} fill="#FAEEDA" stroke="#EF9F27" strokeWidth={1} />
                  <text x={Math.max(70, polX - 20)} y={158} textAnchor="middle" fontSize={10} fill="#BA7517" fontWeight={500}>mRNA 5'→3'</text>
                </>
              )}

              {/* Terminator hairpin */}
              {progress > 75 && (
                <>
                  <path d="M450 50 Q458 30 466 20 Q474 10 482 20 Q490 30 498 50" fill="none" stroke="#D85A30" strokeWidth={1.5} />
                  <text x="474" y="8" textAnchor="middle" fontSize={9} fill="#993C1D">hairpin</text>
                </>
              )}
            </>
          );
        })()}

        {/* Direction arrow */}
        <line x1="30" y1="185" x2="550" y2="185" stroke="#e2e8f0" strokeWidth={1} markerEnd="url(#arr-t)" />
        <text x="290" y="198" textAnchor="middle" fontSize={10} fill="#94a3b8">direction of transcription</text>
      </svg>

      <div className="theory-callout">
        <strong>Promoter strength (RPU)</strong> controls how often RNA polymerase binds — higher RPU means more mRNA produced per second.
      </div>
    </div>
  );
}

function StepMRNA() {
  const [highlighted, setHighlighted] = useState(null);
  const regions = [
    { id: "utr5", label: "5' UTR", x: 30, w: 60, color: "#FAEEDA", border: "#EF9F27", text: "#633806", desc: "Untranslated region. Contains regulatory sequences before the coding region." },
    { id: "sd", label: "SD seq (RBS)", x: 90, w: 80, color: "#E1F5EE", border: "#1D9E75", text: "#04342C", desc: "Shine-Dalgarno: AGGAGG. Complementary to 16S rRNA. Recruits the 30S ribosome subunit." },
    { id: "aug", label: "AUG", x: 170, w: 44, color: "#E6F1FB", border: "#378ADD", text: "#0C447C", desc: "Start codon — codes for Methionine. First amino acid of every protein." },
    { id: "cds", label: "Coding sequence (CDS)", x: 214, w: 220, color: "#E6F1FB", border: "#85B7EB", text: "#185FA5", desc: "One codon (3 bases) = one amino acid. This is what your gene part encodes." },
    { id: "stop", label: "UAA stop", x: 434, w: 60, color: "#FAECE7", border: "#D85A30", text: "#993C1D", desc: "Stop codon (UAA, UAG, or UGA). Triggers release factor — ribosome falls off." },
    { id: "utr3", label: "3' UTR", x: 494, w: 56, color: "#FAEEDA", border: "#EF9F27", text: "#633806", desc: "Untranslated region. May contain regulatory elements affecting mRNA stability." },
  ];

  return (
    <div className="theory-viz-stack">
      <p className="theory-hint">Hover any region to learn what it does.</p>
      <svg width="100%" viewBox="0 0 580 100">
        {/* mRNA backbone */}
        <rect x="20" y="30" width="550" height="20" rx="10" fill="#FAEEDA" stroke="#EF9F27" strokeWidth={1} />
        <circle cx="20" cy="40" r="12" fill="#BA7517" />
        <text x="20" y="44" textAnchor="middle" fontSize={9} fill="white" fontWeight={500}>5'</text>
        <rect x="570" y="34" width="12" height="12" rx={3} fill="#BA7517" opacity={0.6} />
        <text x="576" y="44" textAnchor="middle" fontSize={8} fill="white">3'</text>

        {regions.map((r) => (
          <g key={r.id} onMouseEnter={() => setHighlighted(r.id)} onMouseLeave={() => setHighlighted(null)} style={{ cursor: "pointer" }}>
            <rect x={r.x} y={24} width={r.w} height={32} rx={5} fill={highlighted === r.id ? r.border : r.color} stroke={r.border} strokeWidth={highlighted === r.id ? 2 : 1} style={{ transition: "all 0.2s" }} />
            <text x={r.x + r.w / 2} y={43} textAnchor="middle" fontSize={r.w > 60 ? 10 : 9} fill={highlighted === r.id ? "#fff" : r.text} fontWeight={500}>{r.label}</text>
          </g>
        ))}
      </svg>

      <div
        className="theory-detail-panel"
        style={{
          minHeight: 60,
          background: highlighted ? regions.find((r) => r.id === highlighted)?.color || "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.03)",
          color: highlighted ? regions.find((r) => r.id === highlighted)?.text || "var(--muted)" : "var(--muted)",
        }}
      >
        {highlighted ? (
          <>
            <strong>{regions.find((r) => r.id === highlighted)?.label}:</strong>{" "}
            {regions.find((r) => r.id === highlighted)?.desc}
          </>
        ) : "Hover a region above to see what it does."}
      </div>
    </div>
  );
}

function StepRibosome() {
  const [assembled, setAssembled] = useState(false);
  return (
    <div className="theory-viz-stack">
      <div className="theory-viz-controls">
        <button
          type="button"
          className={`theory-btn theory-btn-accent ${assembled ? "active" : ""}`}
          onClick={() => setAssembled((a) => !a)}
        >
          {assembled ? "70S ribosome assembled" : "Assemble ribosome →"}
        </button>
        <span className="theory-hint">
          {assembled ? "Ready for translation. AUG is in the P-site." : "Click to dock the 50S subunit onto the 30S–mRNA complex."}
        </span>
      </div>

      <svg width="100%" viewBox="0 0 580 220">
        <defs>
          <marker id="arr-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* mRNA */}
        <rect x="20" y="108" width="540" height="16" rx="8" fill="#FAEEDA" stroke="#EF9F27" strokeWidth={1} />
        <text x="14" y="119" textAnchor="end" fontSize={10} fill="#BA7517">5'</text>
        <text x="566" y="119" fontSize={10} fill="#BA7517">3'</text>

        {/* SD highlighted */}
        <rect x="80" y="104" width="64" height="24" rx={5} fill="#E1F5EE" stroke="#1D9E75" strokeWidth={1.5} />
        <text x="112" y="119" textAnchor="middle" fontSize={10} fill="#04342C" fontWeight={500}>SD seq</text>

        {/* AUG */}
        <rect x="152" y="104" width="44" height="24" rx={4} fill="#E6F1FB" stroke="#378ADD" strokeWidth={1.5} />
        <text x="174" y="119" textAnchor="middle" fontSize={10} fill="#0C447C" fontWeight={500}>AUG</text>

        {/* 30S (always visible) */}
        <ellipse cx="180" cy={assembled ? 148 : 162} rx={68} ry={26} fill="#E1F5EE" stroke="#1D9E75" strokeWidth={1.5} style={{ transition: "all 0.5s" }} />
        <ellipse cx="180" cy={assembled ? 148 : 162} rx={48} ry={17} fill="#5DCAA5" opacity={0.5} />
        <text x="180" y={assembled ? 144 : 158} textAnchor="middle" fontSize={10} fill="#04342C" fontWeight={500} style={{ transition: "all 0.5s" }}>30S</text>
        <text x="180" y={assembled ? 156 : 170} textAnchor="middle" fontSize={9} fill="#085041" style={{ transition: "all 0.5s" }}>binds SD + AUG</text>

        {/* 50S (animates down) */}
        <ellipse cx="180" cy={assembled ? 88 : 46} rx={82} ry={32} fill="#9FE1CB" stroke="#1D9E75" strokeWidth={1.5} style={{ transition: "all 0.5s" }} />
        <ellipse cx="180" cy={assembled ? 88 : 46} rx={58} ry={21} fill="#5DCAA5" opacity={0.6} />
        <text x="180" y={assembled ? 84 : 42} textAnchor="middle" fontSize={10} fill="#04342C" fontWeight={500} style={{ transition: "all 0.5s" }}>50S</text>
        <text x="180" y={assembled ? 96 : 54} textAnchor="middle" fontSize={9} fill="#085041" style={{ transition: "all 0.5s" }}>peptidyl transferase</text>

        {/* tRNA-Met */}
        <path d="M334 140 L334 116 L350 107 L366 116 L366 140 Z" fill="#EEEDFE" stroke="#7F77DD" strokeWidth={1} />
        <line x1="350" y1="107" x2="350" y2="78" stroke="#7F77DD" strokeWidth={1.5} />
        <ellipse cx="350" cy="70" rx="18" ry="12" fill="#AFA9EC" stroke="#534AB7" strokeWidth={1} />
        <text x="350" y="74" textAnchor="middle" fontSize={9} fill="#26215C">Met</text>
        <text x="350" y="158" textAnchor="middle" fontSize={9} fill="#534AB7">tRNA-Met</text>

        {/* Site labels */}
        <text x="174" y="195" textAnchor="middle" fontSize={10} fill="#64748b">P-site (AUG)</text>
        <text x="350" y="195" textAnchor="middle" fontSize={10} fill="#64748b">A-site (next codon)</text>
        <line x1="20" y1="185" x2="560" y2="185" stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4 3" />
      </svg>

      <div className="theory-badge-row">
        <span className="theory-badge">30S + 50S = 70S ribosome (bacteria)</span>
        <span className="theory-badge" style={{ background: "rgba(127, 119, 221, 0.12)" }}>RBS strength = initiation frequency</span>
      </div>
    </div>
  );
}

function StepTranslation() {
  const AMINO_ACIDS = ["Met", "Gln", "Tyr", "Gly", "Asn", "Pro", "Glu", "Leu", "Ala", "Val"];
  const CODONS      = ["AUG", "CAG", "UAC", "GGC", "AAU", "CCG", "GAA", "UUG", "GCU", "GUC", "UAA"];
  const [step, setStep] = useState(0);
  const maxStep = AMINO_ACIDS.length;
  const chain = AMINO_ACIDS.slice(0, step);

  return (
    <div className="theory-viz-stack">
      <div className="theory-viz-controls">
        <button type="button" className="theory-btn theory-btn-ghost" onClick={() => setStep(0)} disabled={step === 0}>Reset</button>
        <button type="button" className="theory-btn theory-btn-accent" onClick={() => setStep((s) => Math.min(s + 1, maxStep))} disabled={step === maxStep}>
          {step === maxStep ? "Protein complete" : "Add next amino acid →"}
        </button>
        <span className="theory-hint">
          {step === 0 ? "Ribosome at AUG start codon." : step === maxStep ? "Stop codon reached — ribosome releases the chain." : `Codon ${step + 1}: ${CODONS[step]} → ${AMINO_ACIDS[step - 1]}`}
        </span>
      </div>

      {/* mRNA with ribosome */}
      <svg width="100%" viewBox="0 0 580 160">
        <defs>
          <marker id="arr-tr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {/* mRNA */}
        <rect x="20" y="100" width="540" height="16" rx="8" fill="#FAEEDA" stroke="#EF9F27" strokeWidth={1} />
        {CODONS.map((c, i) => {
          const x = 24 + i * 46;
          const isStop = c === "UAA";
          const isCurrent = i === step;
          return (
            <g key={i}>
              <rect x={x} y={96} width={42} height={24} rx={3}
                fill={isStop ? "#FAECE7" : isCurrent ? "#E6F1FB" : i < step ? "#f0fdf4" : "#FAEEDA"}
                stroke={isStop ? "#D85A30" : isCurrent ? "#378ADD" : i < step ? "#86efac" : "#EF9F27"}
                strokeWidth={isCurrent ? 2 : 0.8} />
              <text x={x + 21} y={111} textAnchor="middle" fontSize={9} fill={isStop ? "#993C1D" : isCurrent ? "#0C447C" : "#633806"} fontWeight={isCurrent ? 600 : 400}>{c}</text>
            </g>
          );
        })}
        {/* Ribosome body */}
        {step < CODONS.length && (
          <>
            <ellipse cx={24 + step * 46 + 44} cy={88} rx={50} ry={22} fill="#9FE1CB" stroke="#1D9E75" strokeWidth={1.5} style={{ transition: "cx 0.4s" }} />
            <ellipse cx={24 + step * 46 + 44} cy={116} rx={40} ry={16} fill="#E1F5EE" stroke="#1D9E75" strokeWidth={1} style={{ transition: "cx 0.4s" }} />
            <text x={24 + step * 46 + 44} y={85} textAnchor="middle" fontSize={9} fill="#04342C" fontWeight={500} style={{ transition: "x 0.4s" }}>Ribosome</text>
          </>
        )}
      </svg>

      <div>
        <div className="theory-chain-label">Growing polypeptide chain</div>
        <div className="theory-chain">
          {chain.length === 0 && <span className="theory-hint">Chain will appear here as translation proceeds…</span>}
          {chain.map((aa, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center" }}>
              <span className="theory-aa">{aa}</span>
              {i < chain.length - 1 && <span style={{ color: "#ED93B1", fontSize: 14, margin: "0 1px" }}>—</span>}
            </span>
          ))}
          {step === maxStep && <span style={{ fontSize: "0.82rem", color: "#1D9E75", marginLeft: 8 }}>released!</span>}
        </div>
      </div>
    </div>
  );
}

function StepProtein() {
  const [view, setView] = useState("fold");
  const yield_factors = [
    { label: "Promoter RPU", color: "#7F77DD", value: 85, unit: "controls transcription rate" },
    { label: "RBS strength", color: "#1D9E75", value: 62, unit: "controls translation initiation" },
    { label: "Terminator eff.", color: "#D85A30", value: 90, unit: "controls readthrough" },
    { label: "Gene length", color: "#378ADD", value: 40, unit: "longer = slower elongation" },
  ];

  return (
    <div className="theory-viz-stack">
      <div className="theory-viz-controls">
        {["fold", "yield"].map((v) => (
          <button
            key={v}
            type="button"
            className={`theory-btn ${view === v ? "theory-btn-primary" : "theory-btn-ghost"}`}
            onClick={() => setView(v)}
          >
            {v === "fold" ? "Protein folding" : "What controls yield?"}
          </button>
        ))}
      </div>

      {view === "fold" && (
        <svg width="100%" viewBox="0 0 580 180">
          {/* 1 - Linear chain */}
          <text x="20" y="22" fontSize={11} fill="#64748b" fontWeight={500}>1. Linear chain released from ribosome</text>
          {["Met","Gln","Tyr","Gly","Asn","Pro","Glu","Leu","Ala","Val"].map((aa, i) => (
            <g key={aa}>
              <rect x={20 + i * 52} y={28} width={46} height={18} rx={9} fill="#FBEAF0" stroke="#ED93B1" strokeWidth={0.8} />
              <text x={20 + i * 52 + 23} y={40} textAnchor="middle" fontSize={9} fill="#72243E">{aa}</text>
              {i < 9 && <line x1={20 + i * 52 + 46} y1={37} x2={20 + (i + 1) * 52} y2={37} stroke="#ED93B1" strokeWidth={1} />}
            </g>
          ))}

          {/* 2 - Secondary structures */}
          <text x="20" y="72" fontSize={11} fill="#64748b" fontWeight={500}>2. Secondary structure (α-helix and β-sheet)</text>
          <path d="M30 95 Q50 83 70 95 Q90 107 110 95 Q130 83 150 95 Q170 107 190 95 Q210 83 230 95" fill="none" stroke="#AFA9EC" strokeWidth={6} strokeLinecap="round" />
          <path d="M30 95 Q50 83 70 95 Q90 107 110 95 Q130 83 150 95 Q170 107 190 95 Q210 83 230 95" fill="none" stroke="#EEEDFE" strokeWidth={3} strokeLinecap="round" />
          <text x="130" y="112" textAnchor="middle" fontSize={9} fill="#534AB7">α-helix</text>

          <path d="M280 88 L340 88 L340 98 L348 93 L356 98 L356 88 L416 88 L416 98 L424 93 L432 98 L432 88 L490 88" fill="none" stroke="#85B7EB" strokeWidth={2.5} />
          <text x="385" y="112" textAnchor="middle" fontSize={9} fill="#185FA5">β-sheet</text>

          {/* 3 - Tertiary fold */}
          <text x="20" y="136" fontSize={11} fill="#64748b" fontWeight={500}>3. Tertiary fold — functional 3D shape</text>
          <ellipse cx="80" cy="162" rx="44" ry="14" fill="#FBEAF0" stroke="#ED93B1" strokeWidth={1} />
          <ellipse cx="96" cy="156" rx="34" ry="12" fill="#EEEDFE" stroke="#AFA9EC" strokeWidth={1} />
          <ellipse cx="80" cy="152" rx="28" ry="10" fill="#E1F5EE" stroke="#5DCAA5" strokeWidth={1} />
          <ellipse cx="88" cy="148" rx="18" ry="8" fill="#E6F1FB" stroke="#85B7EB" strokeWidth={0.8} />
          <text x="85" y="153" textAnchor="middle" fontSize={9} fill="#0C447C" fontWeight={500}>folded</text>
          <text x="160" y="158" fontSize={11} fill="#64748b">← shape determines function</text>
        </svg>
      )}

      {view === "yield" && (
        <div className="theory-viz-stack">
          <p className="theory-hint">GeneSmith's circuit model multiplies these four factors to predict final protein yield.</p>
          {yield_factors.map((f) => (
            <div key={f.label} className="theory-yield-bar-row">
              <span className="theory-yield-bar-label">{f.label}</span>
              <div className="theory-yield-bar-track">
                <div className="theory-yield-bar-fill" style={{ width: `${f.value}%`, background: f.color }} />
              </div>
              <span className="theory-yield-bar-note">{f.unit}</span>
            </div>
          ))}
          <div className="theory-formula">
            yield = RPU × TIR × terminator_efficiency / log(gene_length) × 1000
          </div>
          <div className="theory-hint">Output units: <strong>molecules / cell / hour</strong></div>
        </div>
      )}
    </div>
  );
}

export const STEP_RENDERS = [StepCircuit, StepSigma, StepTranscription, StepMRNA, StepRibosome, StepTranslation, StepProtein];

export { STEPS, PartChip };

export const TAG_COLORS = {
  Overview: { bg: "rgba(79, 9, 151, 0.08)", text: "var(--nav-purple)" },
  "Transcription · Step 1": { bg: "rgba(127, 119, 221, 0.15)", text: "#3C3489" },
  "Transcription · Step 2": { bg: "rgba(127, 119, 221, 0.15)", text: "#3C3489" },
  Handoff: { bg: "rgba(239, 159, 39, 0.15)", text: "#633806" },
  "Translation · Step 1": { bg: "rgba(29, 158, 117, 0.12)", text: "#085041" },
  "Translation · Step 2": { bg: "rgba(29, 158, 117, 0.12)", text: "#085041" },
  Output: { bg: "rgba(212, 83, 126, 0.12)", text: "#72243E" },
};
