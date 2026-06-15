import { useState } from "react";
import { api, API_BASE } from "../api/client.js";
import PartCard from "./PartCard.jsx";

export default function TraitRecommender({ onAddPart }) {
  const [trait, setTrait] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parts, setParts] = useState([]);

  const recommend = async () => {
    if (!trait.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/recommend", { trait: trait.trim() });
      setParts(data.recommended_parts || []);
    } catch (err) {
      setError(
        `Could not fetch recommendations — backend at ${API_BASE} unreachable (is uvicorn running on port 8000?)`,
      );
      setParts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="trait-recommender">
      <h2>Trait-based recommendations</h2>
      <div className="trait-input-row">
        <input
          type="text"
          value={trait}
          onChange={(e) => setTrait(e.target.value)}
          placeholder="Describe your desired trait (e.g. high fluorescence, biosensing, insulin production)"
          onKeyDown={(e) => e.key === "Enter" && recommend()}
        />
        <button type="button" className="primary" onClick={recommend} disabled={loading}>
          {loading ? "Loading…" : "Recommend Parts"}
        </button>
      </div>
      {loading && <p className="hint">Fetching recommendations…</p>}
      {error && <p className="error">{error}</p>}
      {parts.length > 0 && (
        <div className="recommended-parts">
          {parts.map((part) => (
            <PartCard key={`rec-${part.part_id}`} part={part} onAddPart={onAddPart} />
          ))}
        </div>
      )}
    </section>
  );
}
