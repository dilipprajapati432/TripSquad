import { useEffect, useRef, useState } from "react";
import { MapPinned, Search } from "lucide-react";
import { api } from "../lib/api.js";

/** Search box that finds real places (OpenStreetMap) near the trip destination. */
/**
 * `onDropPin(name)`, when given, offers "Drop a pin on the map" for places the search can't find.
 */
export default function PlaceSearch({ center, onPick, onDropPin, initialQuery = "", autoFocus = false, placeholder = "Search a place to add (e.g. Baga Beach)" }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [usedQuery, setUsedQuery] = useState(""); // the shorter search the server fell back to, if any
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
          setUsedQuery(d.usedQuery || "");
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

  function dropPin() {
    // A long address isn't a good place name: keep the part before the first comma
    onDropPin(q.split(",")[0].trim());
    setQ("");
    setResults([]);
    setOpen(false);
  }

  const pinButton = (label) => (
    <li className="search-pin">
      <button type="button" onClick={dropPin}><MapPinned size={15} aria-hidden="true" /> {label}</button>
    </li>
  );

  return (
    <div className="search">
      <Search size={16} className="search-icon" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        aria-label="Search places"
        autoFocus={autoFocus}
      />
      {loading && <span className="search-loading spinner-sm" />}
      {open && (results.length > 0 || error) && (
        <ul className="search-results card">
          {error && <li className="error small">{error}</li>}
          {usedQuery && <li className="muted small pad">No exact match. Showing results for “{usedQuery}”.</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(r)}>
                <strong>{r.name}</strong>
                <span className="muted small">{r.address}</span>
              </button>
            </li>
          ))}
          {onDropPin && results.length > 0 && pinButton("Not in the list? Drop a pin on the map")}
        </ul>
      )}
      {open && !loading && !error && q.trim().length >= 3 && results.length === 0 && (
        <ul className="search-results card">
          <li className="muted small pad">No places found. Try a shorter name{onDropPin ? ", or:" : "."}</li>
          {onDropPin && pinButton("Drop a pin on the map")}
        </ul>
      )}
    </div>
  );
}
