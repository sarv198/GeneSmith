import { useState } from "react";
import { api, API_BASE } from "../api/client.js";
import LineSearchBar from "./LineSearchBar.jsx";
import PartGrid from "./PartGrid.jsx";

const PAGE_SIZE = 8;

export default function TraitRecommender({ onAddPart }) {
  const [trait, setTrait] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parts, setParts] = useState([]);
  const [page, setPage] = useState(0);

  const recommend = async () => {
    if (!trait.trim()) return;
    setLoading(true);
    setError(null);
    setPage(0);
    try {
      const { data } = await api.post("/recommend", { trait: trait.trim() });
      setParts(data.recommended_parts || []);
    } catch {
      setError(`Could not fetch recommendations — backend at ${API_BASE} unreachable.`);
      setParts([]);
    } finally {
      setLoading(false);
    }
  };

  const totalMatches = parts.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const pageParts = parts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="section-block trait-section">
      <h2 className="section-title">Trait-based recommendations</h2>

      <LineSearchBar
        value={trait}
        onChange={setTrait}
        onSubmit={recommend}
        loading={loading}
        buttonLabel="Search Parts"
        placeholder="Describe desired traits (ex: fluorescence, insulin production etc.)"
      />

      {error && <p className="error">{error}</p>}

      {parts.length > 0 && (
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
