import PartCard from "./PartCard.jsx";

export default function PartGrid({
  parts,
  page,
  totalMatches,
  pageSize,
  loading,
  onPrev,
  onNext,
  onAddPart,
  emptyMessage = "No parts found.",
}) {
  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const rangeStart = totalMatches === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalMatches);

  return (
    <div className="part-grid-section">
      <div className="part-grid-row">
        <button
          type="button"
          className="grid-nav-btn"
          onClick={onPrev}
          disabled={page === 0 || loading}
          aria-label="Previous parts"
        >
          ‹
        </button>

        <div className="part-grid">
          {parts.map((part) => (
            <PartCard key={part.part_id} part={part} onAddPart={onAddPart} />
          ))}
          {!loading && parts.length === 0 && (
            <p className="grid-empty">{emptyMessage}</p>
          )}
        </div>

        <button
          type="button"
          className="grid-nav-btn"
          onClick={onNext}
          disabled={page >= totalPages - 1 || loading}
          aria-label="Next parts"
        >
          ›
        </button>
      </div>

      <p className="grid-range">
        {totalMatches === 0
          ? "No parts to show"
          : `Showing ${rangeStart}–${rangeEnd} of ${totalMatches.toLocaleString()}`}
        {loading ? " · loading…" : ""}
      </p>
    </div>
  );
}
