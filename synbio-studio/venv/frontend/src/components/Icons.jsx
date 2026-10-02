/** Minimal 16px stroke icon set — one visual weight across the app. */

const base = {
  width: 15,
  height: 15,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function IconChevronLeft(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.75 3.5 5.25 8l4.5 4.5" />
    </svg>
  );
}

export function IconChevronRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.25 3.5 10.75 8l-4.5 4.5" />
    </svg>
  );
}

export function IconCaret(props) {
  return (
    <svg {...base} width={11} height={11} {...props}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

export function IconUndo(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7.5h7a3 3 0 0 1 0 6H6.5" />
      <path d="M5.5 4.5 2.75 7.5l2.75 3" />
    </svg>
  );
}

export function IconRedo(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 7.5H6a3 3 0 0 0 0 6h3.5" />
      <path d="M10.5 4.5l2.75 3-2.75 3" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="2.15" />
      <path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7 3.5 3.5" />
    </svg>
  );
}

export function IconDownload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5v7.5" />
      <path d="M5 7.3 8 10.2l3-2.9" />
      <path d="M2.8 12.6h10.4" />
    </svg>
  );
}

export function IconRun(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.6 3.3 12 8l-7.4 4.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.8 4.3h10.4" />
      <path d="M6.2 4.3V3.1h3.6v1.2" />
      <path d="M4.2 4.3l.6 8.2h6.4l.6-8.2" />
    </svg>
  );
}

export function IconCopy(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5.4" y="5.4" width="7.2" height="7.2" rx="1.2" />
      <path d="M10.4 3.4H4.6a1.2 1.2 0 0 0-1.2 1.2v5.8" />
    </svg>
  );
}

export function IconExpand(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.6 2.8h3.6v3.6" />
      <path d="M6.4 13.2H2.8V9.6" />
      <path d="M13.2 2.8 9.4 6.6M2.8 13.2l3.8-3.8" />
    </svg>
  );
}

export function IconCollapse(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 9.4 6.6M9.4 6.6h3.2M9.4 6.6V3.4" />
      <path d="M3 13l3.6-3.6M6.6 9.4H3.4M6.6 9.4v3.2" />
    </svg>
  );
}

export function IconTarget(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="4.6" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4" />
    </svg>
  );
}

export function IconReset(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.75" />
      <path d="M13.4 2.6v2.9h-2.9" />
    </svg>
  );
}

export function IconPanelLeft(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.4" y="3" width="11.2" height="10" rx="1.4" />
      <path d="M6.6 3v10" />
    </svg>
  );
}

export function IconPanelRight(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.4" y="3" width="11.2" height="10" rx="1.4" />
      <path d="M9.4 3v10" />
    </svg>
  );
}

export function IconAlert(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.6 14.2 13H1.8z" />
      <path d="M8 6.6v3M8 11.4h.01" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8.4 6.4 11.8 13 5.2" />
    </svg>
  );
}

export function IconArrowRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.8 8h10.4" />
      <path d="M9.8 4.6 13.2 8l-3.4 3.4" />
    </svg>
  );
}

export function IconSort(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.6 3.2v9.6M2.4 10.6l2.2 2.2 2.2-2.2" />
      <path d="M9.4 4.6h4.2M9.4 8h3M9.4 11.4h1.8" />
    </svg>
  );
}

export function IconSun(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.3v1.6M8 13.1v1.6M14.7 8h-1.6M2.9 8H1.3M12.74 3.26l-1.13 1.13M4.39 11.61l-1.13 1.13M12.74 12.74l-1.13-1.13M4.39 4.39 3.26 3.26" />
    </svg>
  );
}

export function IconMoon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
    </svg>
  );
}
