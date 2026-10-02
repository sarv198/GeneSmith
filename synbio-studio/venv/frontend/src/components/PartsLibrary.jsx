import { useCallback, useEffect, useMemo, useState } from "react";
import { api, API_BASE, partToPaletteItem } from "../api/client.js";
import { PART_LIBRARY } from "../data/parts.js";
import PartCard from "./PartCard.jsx";
import { PartGlyphMini } from "./PartGlyph.jsx";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconSearch,
} from "./Icons.jsx";
import { sanitizeDna } from "../utils/previewHelix.js";
import { typeKey } from "../utils/circuit.js";

const PAGE_SIZE = 8;

const FILTERS = [
  { id: "promoter", label: "Promoter", type: "promoter" },
  { id: "rbs", label: "RBS", type: "rbs" },
  { id: "gene", label: "Gene", type: "cds" },
  { id: "terminator", label: "Terminator", type: "terminator" },
];

const ALL_FILTER_IDS = FILTERS.map((f) => f.id);

const SORTS = [
  { id: "id", label: "Part ID" },
  { id: "length", label: "Length" },
  { id: "type", label: "Part class" },
];

function filterByTypes(parts, activeFilters) {
  // No class filter means "all classes", not "none".
  if (
    activeFilters.length === 0 ||
    activeFilters.length === ALL_FILTER_IDS.length
  ) {
    return parts;
  }
  const allowed = new Set(
    FILTERS.filter((f) => activeFilters.includes(f.id)).map((f) => f.type),
  );
  return parts.filter((part) => {
    const t = (part.part_type || "").toLowerCase();
    const normalized = t === "gene" ? "cds" : t;
    return allowed.has(normalized);
  });
}

function sortParts(parts, sort) {
  if (sort === "id") return parts;
  const copy = [...parts];
  if (sort === "length") {
    copy.sort(
      (a, b) => sanitizeDna(b.sequence).length - sanitizeDna(a.sequence).length,
    );
  } else if (sort === "type") {
    const order = { promoter: 0, rbs: 1, gene: 2, terminator: 3, other: 4 };
    copy.sort(
      (a, b) =>
        (order[typeKey(a.part_type)] ?? 9) - (order[typeKey(b.part_type)] ?? 9) ||
        String(a.part_id).localeCompare(String(b.part_id)),
    );
  }
  return copy;
}

export default function PartsLibrary({
  onAddPart,
  partCounts = {},
  refreshKey = 0,
}) {
  const [browseParts, setBrowseParts] = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [recommendedParts, setRecommendedParts] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [traitQuery, setTraitQuery] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("id");
  const [page, setPage] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState(null);
  const [offline, setOffline] = useState(false);

  const selectedTypes = FILTERS.filter((f) => activeFilters.includes(f.id)).map(
    (f) => f.type,
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBrowseParts = useCallback(async (types, pageIndex, query) => {
    setBrowseLoading(true);
    const offset = pageIndex * PAGE_SIZE;
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (types.length > 0 && types.length < FILTERS.length) {
        params.types = types.join(",");
      }
      if (query) params.search = query;
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
  }, [activeFilters, refreshKey, showRecommendations, debouncedSearch]);

  useEffect(() => {
    if (showRecommendations || activeFilters.length === 0) return;
    fetchBrowseParts(selectedTypes, page, debouncedSearch);
  }, [
    selectedTypes.join(","),
    page,
    refreshKey,
    showRecommendations,
    activeFilters.length,
    debouncedSearch,
    fetchBrowseParts,
  ]);

  const filteredRecommendations = filterByTypes(recommendedParts, activeFilters);
  const rawParts = showRecommendations
    ? filteredRecommendations.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    : browseParts;
  const displayParts = useMemo(() => sortParts(rawParts, sort), [rawParts, sort]);

  const idle = activeFilters.length === 0 && !showRecommendations;
  const totalMatches = idle
    ? 0
    : showRecommendations
      ? filteredRecommendations.length
      : browseTotal;
  const loading = idle
    ? false
    : showRecommendations
      ? recommendLoading
      : browseLoading;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const rangeStart = totalMatches === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalMatches);

  const toggleFilter = (filterId) => {
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId],
    );
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

  const exitRecommendations = () => {
    setShowRecommendations(false);
    setRecommendError(null);
    setTraitQuery("");
    setPage(0);
  };

  return (
    <>
      <div className="panel-head">
        <h2 className="panel-title">Parts library</h2>
        {totalMatches > 0 && (
          <span className="panel-count">{totalMatches.toLocaleString()}</span>
        )}
      </div>

      <div className="lib-controls">
        <div className="filter-row" role="group" aria-label="Filter by part class">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="filter-btn"
              data-type={filter.id}
              aria-pressed={activeFilters.includes(filter.id)}
              onClick={() => toggleFilter(filter.id)}
            >
              <PartGlyphMini partType={filter.id} />
              {filter.label}
            </button>
          ))}
        </div>

        <div className="field">
          <span className="field-icon">
            <IconSearch width={13} height={13} />
          </span>
          <input
            className="input"
            type="search"
            value={search}
            placeholder="Search by ID, name or description"
            aria-label="Search the parts library"
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              className="field-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IconClose width={11} height={11} />
            </button>
          )}
        </div>

        <div className="trait-row">
          <input
            className="input"
            type="text"
            value={traitQuery}
            placeholder="Find parts by trait (e.g. fluorescence)"
            aria-label="Recommend parts for a trait"
            onChange={(event) => setTraitQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && runTraitSearch()}
          />
          <button
            type="button"
            className="btn"
            onClick={runTraitSearch}
            disabled={recommendLoading || !traitQuery.trim()}
            data-tip="Rank library parts against a described trait"
            data-tip-align="end"
          >
            {recommendLoading ? "…" : "Match"}
          </button>
        </div>

        <div className="lib-sort-row">
          <label className="sr-only" htmlFor="parts-sort">
            Sort results
          </label>
          <select
            id="parts-sort"
            className="input select-sm"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            data-tip="Orders the results currently shown"
            data-tip-align="start"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                Sort: {option.label}
              </option>
            ))}
          </select>
          {showRecommendations && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={exitRecommendations}>
              Back to browse
            </button>
          )}
        </div>
      </div>

      {offline && !showRecommendations && (
        <p className="lib-note">
          Backend unreachable at {API_BASE} — showing a small offline part set.
        </p>
      )}

      {recommendError && <p className="lib-note">{recommendError}</p>}

      <div className="panel-body">
        {showRecommendations && (
          <div className="lib-section-label">
            Trait matches{traitQuery ? ` · ${traitQuery}` : ""}
          </div>
        )}

        {loading && (
          <div className="part-list" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton" style={{ height: 62 }} />
            ))}
          </div>
        )}

        {!loading && displayParts.length > 0 && (
          <div className="part-list">
            {displayParts.map((part) => (
              <PartCard
                key={part.part_id}
                part={part}
                onAddPart={onAddPart}
                addCount={partCounts[part.part_id] || 0}
              />
            ))}
          </div>
        )}

        {!loading && displayParts.length === 0 && (
          <div className="empty">
            {idle ? (
              <>
                <p className="empty-title">Choose a part class</p>
                <p className="empty-body">
                  Pick Promoter, RBS, Gene or Terminator above to browse the
                  library, or describe a trait to get matched parts.
                </p>
              </>
            ) : showRecommendations ? (
              <>
                <p className="empty-title">No matches in this class</p>
                <p className="empty-body">
                  Clear a filter, or try a different trait description.
                </p>
              </>
            ) : (
              <>
                <p className="empty-title">No parts found</p>
                <p className="empty-body">
                  Nothing in the library matches this search and filter
                  combination.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {totalMatches > PAGE_SIZE && (
        <div className="pager">
          <span className="pager-label">
            {rangeStart}–{rangeEnd} of {totalMatches.toLocaleString()}
          </span>
          <div className="pager-btns">
            <button
              type="button"
              className="btn-icon"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              aria-label="Previous page of parts"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              aria-label="Next page of parts"
            >
              <IconChevronRight />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
