import { useCallback, useEffect, useState } from "react";
import { api, API_BASE, partToPaletteItem } from "../api/client.js";
import { PART_LIBRARY } from "../data/parts.js";
import PartCard from "./PartCard.jsx";

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
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchParts = useCallback(async (typeFilter, query) => {
    setLoading(true);
    try {
      const params = { limit: 20 };
      if (typeFilter) params.type = typeFilter;
      if (query) params.search = query;
      const { data } = await api.get("/parts", { params });
      const mapped = (data.parts || []).map(partToPaletteItem);
      setParts(mapped.length ? mapped : PART_LIBRARY);
      setTotalMatches(data.total_matches ?? mapped.length);
      setOffline(false);
    } catch (err) {
      setParts(PART_LIBRARY);
      setTotalMatches(PART_LIBRARY.length);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    fetchParts(tab?.type || null, "");
  }, [activeTab, refreshKey, fetchParts]);

  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    const timer = setTimeout(() => {
      fetchParts(tab?.type || null, search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeTab, fetchParts]);

  return (
    <aside className="palette">
      <h2>Parts library</h2>
      {offline && (
        <p className="warn-text">
          Backend unreachable at {API_BASE} — showing 7 offline parts. Start API on port 8000.
        </p>
      )}
      <input
        className="search-input"
        type="text"
        placeholder="Search parts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="filter-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="hint">
        Showing {parts.length} of {totalMatches} parts
        {loading ? " (loading…)" : ""}
      </p>
      {parts.map((part) => (
        <PartCard key={part.part_id} part={part} onAddPart={onAddPart} />
      ))}
    </aside>
  );
}
