import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, partToPaletteItem } from "../api/client.js";
import { PART_LIBRARY } from "../data/parts.js";
import LineSearchBar from "./LineSearchBar.jsx";
import PartGrid from "./PartGrid.jsx";

const PAGE_SIZE = 8;

const FILTERS = [
  { id: "promoter", label: "Promoter", type: "promoter" },
  { id: "rbs", label: "RBS", type: "rbs" },
  { id: "gene", label: "Gene", type: "cds" },
  { id: "terminator", label: "Terminator", type: "terminator" },
];

const ALL_FILTER_IDS = FILTERS.map((f) => f.id);

function filterByTypes(parts, activeFilters) {
  if (activeFilters.length === ALL_FILTER_IDS.length) return parts;
  const allowed = new Set(
    FILTERS.filter((f) => activeFilters.includes(f.id)).map((f) => f.type),
  );
  return parts.filter((part) => {
    const t = (part.part_type || "").toLowerCase();
    const normalized = t === "gene" ? "cds" : t;
    return allowed.has(normalized);
  });
}

export default function PartsLibrary({ onAddPart, refreshKey = 0 }) {
  const [browseParts, setBrowseParts] = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [recommendedParts, setRecommendedParts] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [activeFilters, setActiveFilters] = useState(ALL_FILTER_IDS);
  const [traitQuery, setTraitQuery] = useState("");
  const [page, setPage] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState(null);
  const [offline, setOffline] = useState(false);

  const selectedTypes = FILTERS.filter((f) => activeFilters.includes(f.id)).map(
    (f) => f.type,
  );

  const fetchBrowseParts = useCallback(async (types, pageIndex) => {
    setBrowseLoading(true);
    const offset = pageIndex * PAGE_SIZE;
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (types.length > 0 && types.length < FILTERS.length) {
        params.types = types.join(",");
      }
      const { data } = await api.get("/parts", { params });
      const mapped = (data.parts || []).map(partToPaletteItem);
      setBrowseParts(mapped);
      setBrowseTotal(data.total_matches ?? mapped.length);
      setOffline(false);
    } catch {
      setBrowseParts(PART_LIBRARY.slice(0, PAGE_SIZE).map(partToPaletteItem));
      setBrowseTotal(PART_LIBRARY.length);
      setOffline(true);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
  }, [activeFilters, refreshKey, showRecommendations]);

  useEffect(() => {
    if (showRecommendations) return;
    fetchBrowseParts(selectedTypes, page);
  }, [selectedTypes.join(","), page, refreshKey, showRecommendations, fetchBrowseParts]);

  const filteredRecommendations = filterByTypes(recommendedParts, activeFilters);
  const displayParts = showRecommendations
    ? filteredRecommendations.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    : browseParts;
  const totalMatches = showRecommendations
    ? filteredRecommendations.length
    : browseTotal;
  const loading = showRecommendations ? recommendLoading : browseLoading;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) => {
      if (prev.includes(filterId)) {
        const next = prev.filter((id) => id !== filterId);
        return next.length ? next : prev;
      }
      return [...prev, filterId];
    });
    setPage(0);
  };

  const runTraitSearch = async () => {
    const trait = traitQuery.trim();
    if (!trait) return;
    setRecommendLoading(true);
    setRecommendError(null);
    setShowRecommendations(true);
    setPage(0);
    try {
      const { data } = await api.post("/recommend", { trait });
      setRecommendedParts((data.recommended_parts || []).map(partToPaletteItem));
    } catch {
      setRecommendError(
        `Could not fetch recommendations — backend at ${API_BASE} unreachable.`,
      );
      setRecommendedParts([]);
    } finally {
      setRecommendLoading(false);
    }
  };

  return (
    <section className="section-block parts-library-section">
      <h2 className="section-title">Parts Library</h2>

      <div className="type-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`type-filter ${activeFilters.includes(filter.id) ? "active" : ""}`}
            onClick={() => toggleFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {offline && !showRecommendations && (
        <p className="warn-text">
          Backend unreachable at {API_BASE} — limited offline parts shown.
        </p>
      )}

      <LineSearchBar
        value={traitQuery}
        onChange={setTraitQuery}
        onSubmit={runTraitSearch}
        loading={recommendLoading}
        placeholder="Describe desired traits (ex: fluorescence, insulin production etc.)"
      />

      {recommendError && <p className="error">{recommendError}</p>}

      {showRecommendations && (
        <h2 className="section-title">Trait-based recommendations</h2>
      )}

      <PartGrid
        parts={displayParts}
        page={page}
        totalMatches={totalMatches}
        pageSize={PAGE_SIZE}
        loading={loading}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        onAddPart={onAddPart}
        emptyMessage={
          showRecommendations
            ? "No recommendations match your filters."
            : "No parts found."
        }
      />
    </section>
  );
}
