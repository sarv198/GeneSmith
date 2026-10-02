import { typeKey } from "../utils/circuit.js";

/**
 * SBOL-style glyphs for the four circuit part classes.
 * Each glyph is bottom-anchored so it sits on the DNA backbone line.
 */

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
  preserveAspectRatio: "xMidYMax meet",
};

function Promoter() {
  return (
    <svg {...common} viewBox="0 0 46 34">
      <path d="M6 32V9h30" />
      <path d="M30.5 4.5 37.5 9l-7 4.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Rbs() {
  return (
    <svg {...common} viewBox="0 0 34 34">
      <path d="M3 32V22a14 14 0 0 1 28 0v10" fill="currentColor" fillOpacity="0.16" />
    </svg>
  );
}

function Gene() {
  return (
    <svg {...common} viewBox="0 0 76 34">
      <path
        d="M3 32V12h51l19 10-19 10z"
        fill="currentColor"
        fillOpacity="0.16"
      />
    </svg>
  );
}

function Terminator() {
  return (
    <svg {...common} viewBox="0 0 34 34">
      <path d="M17 32V8" />
      <path d="M4.5 8h25" />
    </svg>
  );
}

function Other() {
  return (
    <svg {...common} viewBox="0 0 34 34">
      <rect x="6" y="14" width="22" height="18" rx="2" fill="currentColor" fillOpacity="0.14" />
    </svg>
  );
}

const GLYPHS = {
  promoter: Promoter,
  rbs: Rbs,
  gene: Gene,
  terminator: Terminator,
  other: Other,
};

export default function PartGlyph({ partType }) {
  const Glyph = GLYPHS[typeKey(partType)] || Other;
  return <Glyph />;
}

/** Compact inline glyph used in filter buttons and legends. */
export function PartGlyphMini({ partType, className = "glyph" }) {
  const key = typeKey(partType);
  const props = {
    className,
    viewBox: "0 0 24 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
  };
  if (key === "promoter") {
    return (
      <svg {...props}>
        <path d="M3 10V3h14" />
        <path d="M14 0.6 18.5 3 14 5.4z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (key === "rbs") {
    return (
      <svg {...props}>
        <path d="M6 10V6.6a6 6 0 0 1 12 0V10" fill="currentColor" fillOpacity="0.18" />
      </svg>
    );
  }
  if (key === "gene") {
    return (
      <svg {...props}>
        <path d="M3 10V3.5h13V1l5 4-5 4V6.5H3z" fill="currentColor" fillOpacity="0.18" />
      </svg>
    );
  }
  if (key === "terminator") {
    return (
      <svg {...props}>
        <path d="M12 10V2" />
        <path d="M5.5 2h13" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="5" y="3" width="14" height="7" rx="1.5" fill="currentColor" fillOpacity="0.16" />
    </svg>
  );
}
