export default function LineSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading = false,
  buttonLabel = "Search Parts",
}) {
  const showPlaceholder = !value;

  return (
    <div className="line-search-bar">
      <div className="line-search-input-wrap">
        {showPlaceholder && (
          <span className="line-search-placeholder">{placeholder}</span>
        )}
        <input
          type="text"
          className="line-search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          aria-label="Search"
        />
      </div>
      <button
        type="button"
        className="line-search-btn"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? "Searching…" : buttonLabel}
      </button>
    </div>
  );
}
