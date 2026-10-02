import logoDarkUrl from "../assets/genesmith-logo-dark.png";
import markDarkUrl from "../assets/genesmith-mark-dark.png";
import logoLightUrl from "../assets/genesmith-logo-light.png";
import markLightUrl from "../assets/genesmith-mark-light.png";
import { useTheme } from "../theme.jsx";
import {
  IconDownload,
  IconMoon,
  IconSun,
  IconPanelLeft,
  IconPanelRight,
  IconRedo,
  IconRun,
  IconSettings,
  IconUndo,
} from "./Icons.jsx";

const PAGES = [
  { id: "home", label: "Build" },
  { id: "visualize", label: "Structure" },
  { id: "theory", label: "Theory" },
];

export default function AppHeader({
  activePage,
  onNavigate,
  circuitName,
  onRenameCircuit,
  organism,
  status,
  circuitLength,
  partCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPredict,
  predicting,
  canPredict,
  onExport,
  canExport,
  onOpenSettings,
  onToggleRail,
  onToggleInspector,
  backendOnline,
}) {
  const isBuild = activePage === "home";
  const { theme, toggleTheme } = useTheme();
  const logoUrl = theme === "light" ? logoLightUrl : logoDarkUrl;
  const markUrl = theme === "light" ? markLightUrl : markDarkUrl;

  return (
    <header className="app-header">
      <button
        type="button"
        className="hdr-brand"
        onClick={() => onNavigate("home")}
        aria-label="GeneSmith — go to circuit builder"
      >
        <img src={logoUrl} alt="GeneSmith" className="hdr-logo hdr-logo-full" />
        <img src={markUrl} alt="GeneSmith" className="hdr-logo hdr-logo-mark" />
      </button>

      {isBuild && (
        <>
          <button
            type="button"
            className="btn-icon toggle-rail"
            onClick={onToggleRail}
            aria-label="Toggle parts library"
            data-tip="Parts library"
            data-tip-align="start"
          >
            <IconPanelLeft />
          </button>

          <span className="hdr-sep" aria-hidden="true" />

          <div className="hdr-project">
            <label className="sr-only" htmlFor="circuit-name">
              Circuit name
            </label>
            <input
              id="circuit-name"
              className="hdr-name"
              value={circuitName}
              spellCheck="false"
              onChange={(event) => onRenameCircuit(event.target.value)}
              onBlur={(event) => {
                if (!event.target.value.trim()) onRenameCircuit("Untitled Circuit");
              }}
            />
            <div className="hdr-meta">
              <span className="chip" data-tip="Host context assumed for expression">
                <span className="hdr-organism">{organism}</span>
              </span>
              {partCount > 0 && (
                <span className="chip mono" data-tip="Parts placed · assembled construct length">
                  {partCount} {partCount === 1 ? "part" : "parts"} · {circuitLength} bp
                </span>
              )}
              {status && (
                <span
                  className={`chip hdr-status ${
                    status.level === "ok"
                      ? "chip-ok"
                      : status.level === "err"
                        ? "chip-err"
                        : status.level === "warn"
                          ? "chip-warn"
                          : ""
                  }`}
                  data-tip={status.detail}
                >
                  <span className="dot" aria-hidden="true" />
                  {status.label}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <nav className="hdr-nav" aria-label="Workspace sections">
        {PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            className={`hdr-nav-btn ${activePage === page.id ? "active" : ""}`}
            aria-current={activePage === page.id ? "page" : undefined}
            onClick={() => onNavigate(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      <div className="hdr-actions">
        {isBuild && (
          <>
            <div className="hdr-group hide-narrow">
              <button
                type="button"
                className="btn-icon"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo"
                data-tip="Undo · Ctrl+Z"
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo"
                data-tip="Redo · Ctrl+Shift+Z"
              >
                <IconRedo />
              </button>
            </div>

            <button
              type="button"
              className="btn-icon hide-narrow"
              onClick={onExport}
              disabled={!canExport}
              aria-label="Export construct as FASTA"
              data-tip="Download assembled construct (FASTA)"
            >
              <IconDownload />
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={onPredict}
              disabled={!canPredict || predicting}
              data-tip={
                canPredict
                  ? "Run the expression model on this construct"
                  : "Add a promoter to enable prediction"
              }
              data-tip-align="end"
            >
              <IconRun />
              {predicting ? "Running…" : "Run model"}
            </button>
          </>
        )}

        <button
          type="button"
          className="btn-icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          aria-pressed={theme === "light"}
          data-tip={theme === "dark" ? "Light theme" : "Dark theme"}
          data-tip-align="end"
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>

        <button
          type="button"
          className="btn-icon"
          onClick={onOpenSettings}
          aria-label="Model and library settings"
          data-tip={
            backendOnline === false
              ? "Backend offline — open settings"
              : "Model status, library refresh, retraining"
          }
          data-tip-align="end"
        >
          <IconSettings />
          {backendOnline === false && <span className="offline-pip" aria-hidden="true" />}
        </button>

        {isBuild && (
          <button
            type="button"
            className="btn-icon toggle-insp"
            onClick={onToggleInspector}
            aria-label="Toggle inspector"
            data-tip="Inspector"
            data-tip-align="end"
          >
            <IconPanelRight />
          </button>
        )}
      </div>
    </header>
  );
}
