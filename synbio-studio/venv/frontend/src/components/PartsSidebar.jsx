import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, partToPaletteItem } from "../api/client.js";
import { PART_LIBRARY } from "../data/parts.js";
import PartCard from "./PartCard.jsx";

const PAGE_SIZE = 6;

const TABS = [
  { id: "all", label: "All", type: null },
  { id: "promoter", label: "Promoter", type: "promoter" },
  { id: "rbs", label: "RBS", type: "rbs" },
  { id: "gene", label: "Gene", type: "cds" },
  { id: "terminator", label: "Terminator", type: "terminator" },
];

export default function PartsSidebar({ onAddPart, refreshKey = 0 }) {
  const [parts, setParts] = useState(PART_LIBRARY);
  const [totalMatches, setTotalMatches] = useState(PART_LIBRARY.length);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [libraryPage, setLibraryPage] = useState(0);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  useEffect(() => {
    if (libraryPage > totalPages - 1) {
      setLibraryPage(Math.max(0, totalPages - 1));
    }
  }, [libraryPage, totalPages]);

  const fetchParts = useCallback(async (typeFilter, query, page) => {
    setLoading(true);
    const requestOffset = page * PAGE_SIZE;
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: requestOffset,
      };
      if (typeFilter) params.type = typeFilter;
      if (query) params.search = query;
      const { data } = await api.get("/parts", { params });
      const mapped = (data.parts || []).map(partToPaletteItem);
      if (data.offset != null && data.offset !== requestOffset) {
        console.warn(
          "Parts API ignored offset — restart backend from synbio-studio/venv",
        );
      }
      setParts(mapped.length ? mapped : PART_LIBRARY.slice(0, PAGE_SIZE));
      setTotalMatches(data.total_matches ?? mapped.length);
      setOffline(false);
    } catch {
      const fallback = PART_LIBRARY.slice(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE,
      );
      setParts(fallback.length ? fallback : PART_LIBRARY.slice(0, PAGE_SIZE));
      setTotalMatches(PART_LIBRARY.length);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLibraryPage(0);
  }, [refreshKey]);

  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    fetchParts(tab?.type || null, search.trim(), libraryPage);
  }, [activeTab, search, libraryPage, refreshKey, fetchParts]);

  const changeTab = (tabId) => {
    setActiveTab(tabId);
    setLibraryPage(0);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setLibraryPage(0);
  };

  const goNext = () => {
    setLibraryPage((p) => Math.min(p + 1, totalPages - 1));
  };

  const goPrev = () => {
    setLibraryPage((p) => Math.max(p - 1, 0));
  };

  const rangeStart = totalMatches === 0 ? 0 : libraryPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min((libraryPage + 1) * PAGE_SIZE, totalMatches);

  return (
    <aside className="palette parts-library">
      <h2>Parts library</h2>
      {offline && (
        <p className="warn-text">
          Backend unreachable at {API_BASE} — showing offline parts. Start API on port 8000.
        </p>
      )}
      <input
        className="search-input"
        type="text"
        placeholder="Search parts..."
        value={search}
        onChange={(e) => changeSearch(e.target.value)}
      />
      <div className="filter-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab active" : "tab"}
            onClick={() => changeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="parts-carousel">
        <p className="hint parts-count-hint">
          {totalMatches === 0
            ? "No parts found"
            : `Showing ${rangeStart}–${rangeEnd} of ${totalMatches}`}
          {loading ? " · loading…" : ""}
        </p>

        <div className="parts-list">
          {parts.map((part) => (
            <PartCard key={part.part_id} part={part} onAddPart={onAddPart} compact />
          ))}
          {!loading && parts.length === 0 && (
            <p className="hint">Try another filter or search term.</p>
          )}
        </div>

        <div className="parts-pager">
          <button
            type="button"
            className="pager-btn"
            onClick={goPrev}
            disabled={libraryPage === 0 || loading}
            aria-label="Previous parts"
          >
            ←
          </button>
          <span className="pager-label">
            Page {libraryPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="pager-btn pager-btn-next"
            onClick={goNext}
            disabled={libraryPage >= totalPages - 1 || loading}
            aria-label="Next parts"
          >
            →
          </button>
        </div>
      </div>
    </aside>
  );
}
