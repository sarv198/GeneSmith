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

export default function PartsLibrary({ onAddPart, refreshKey = 0 }) {
  const [parts, setParts] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [activeFilter, setActiveFilter] = useState("promoter");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const fetchParts = useCallback(async (typeFilter, searchQuery, pageIndex) => {
    setLoading(true);
    const offset = pageIndex * PAGE_SIZE;
    try {
      const params = { limit: PAGE_SIZE, offset, type: typeFilter };
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get("/parts", { params });
      const mapped = (data.parts || []).map(partToPaletteItem);
      setParts(mapped);
      setTotalMatches(data.total_matches ?? mapped.length);
      setOffline(false);
    } catch {
      setParts(PART_LIBRARY.slice(0, PAGE_SIZE).map(partToPaletteItem));
      setTotalMatches(PART_LIBRARY.length);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
  }, [activeFilter, query, refreshKey]);

  useEffect(() => {
    const filter = FILTERS.find((f) => f.id === activeFilter);
    fetchParts(filter?.type || "promoter", query, page);
  }, [activeFilter, query, page, refreshKey, fetchParts]);

  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  const runSearch = () => setQuery(search.trim());

  return (
    <section className="section-block parts-library-section">
      <h2 className="section-title">Parts Library</h2>

      <div className="type-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`type-filter ${activeFilter === filter.id ? "active" : ""}`}
            onClick={() => {
              setActiveFilter(filter.id);
              setPage(0);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {offline && (
        <p className="warn-text">
          Backend unreachable at {API_BASE} — limited offline parts shown.
        </p>
      )}

      <LineSearchBar
        value={search}
        onChange={setSearch}
        onSubmit={runSearch}
        loading={loading}
        placeholder="Describe desired traits (ex: fluorescence, insulin production etc.)"
      />

      <PartGrid
        parts={parts}
        page={page}
        totalMatches={totalMatches}
        pageSize={PAGE_SIZE}
        loading={loading}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        onAddPart={onAddPart}
      />
    </section>
  );
}
