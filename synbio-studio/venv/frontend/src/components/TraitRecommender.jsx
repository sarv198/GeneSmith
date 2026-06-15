import { useEffect, useState } from "react";
import PartGrid from "./PartGrid.jsx";

const PAGE_SIZE = 8;

export default function TraitRecommender({
  onAddPart,
  parts = [],
  loading = false,
  error = null,
}) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [parts]);

  const totalMatches = parts.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const pageParts = parts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!loading && !error && parts.length === 0) {
    return null;
  }

  return (
    <section className="section-block trait-section">
      <h2 className="section-title">Trait-based recommendations</h2>

      {error && <p className="error">{error}</p>}

      {(loading || parts.length > 0) && (
        <PartGrid
          parts={pageParts}
          page={page}
          totalMatches={totalMatches}
          pageSize={PAGE_SIZE}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          onAddPart={onAddPart}
          emptyMessage="No recommendations for this trait."
        />
      )}
    </section>
  );
}
