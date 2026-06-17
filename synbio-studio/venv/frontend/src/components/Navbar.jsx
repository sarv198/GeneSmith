const NAV_ITEMS = [
  { id: "theory", label: "Theory" },
  { id: "visualize", label: "Visualize" },
];

export default function Navbar({ activePage, onNavigate }) {
  return (
    <nav className="navbar">
      <button
        type="button"
        className="navbar-brand"
        onClick={() => onNavigate("home")}
        aria-label="GeneSmith home"
      >
        <img src="/genesmith-logo.png" alt="GeneSmith" className="navbar-logo" />
      </button>

      <div className="navbar-links">
        <button
          type="button"
          className={`navbar-link ${activePage === "home" ? "active" : ""}`}
          onClick={() => onNavigate("home")}
        >
          Build
        </button>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`navbar-link ${activePage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
