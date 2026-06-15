const NAV_ITEMS = [
  { id: "home", label: "Build" },
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
      >
        GENESMITH
      </button>

      <div className="navbar-links">
        {NAV_ITEMS.filter((item) => item.id !== "home").map((item) => (
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
