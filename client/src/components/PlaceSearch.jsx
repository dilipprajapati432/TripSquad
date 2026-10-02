import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api.js";

/** Search box that finds real places (OpenStreetMap) near the trip destination. */
export default function PlaceSearch({ center, onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setResults([]);
      setError("");
      return;
    }
    // Debounce: wait until the user stops typing for 600ms
    const t = setTimeout(async () => {
      const id = ++latest.current;
      setLoading(true);
      setError("");
      try {
        const near = center ? `&lat=${center.lat}&lng=${center.lng}` : "";
        const d = await api(`/util/geo/search?q=${encodeURIComponent(query)}${near}`);
        if (id === latest.current) {
          setResults(d.results);
          setOpen(true);
        }
      } catch (e) {
        if (id === latest.current) setError(e.message);
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [q, center]);

  function pick(r) {
    onPick(r);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="search">
      <Search size={16} className="search-icon" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search a place to add (e.g. Baga Beach)"
        aria-label="Search places"
      />
      {loading && <span className="search-loading spinner-sm" />}
      {open && (results.length > 0 || error) && (
        <ul className="search-results card">
          {error && <li className="error small">{error}</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(r)}>
                <strong>{r.name}</strong>
                <span className="muted small">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && !error && q.trim().length >= 3 && results.length === 0 && (
        <ul className="search-results card"><li className="muted small pad">No places found. Try a different name.</li></ul>
      )}
    </div>
  );
}
