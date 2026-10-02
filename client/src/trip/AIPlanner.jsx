import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { api } from "../lib/api.js";
import Modal from "../components/Modal.jsx";
import PlaceSearch from "../components/PlaceSearch.jsx";
import { dayColor } from "../lib/format.js";

const EXAMPLES = ["Beaches, seafood and nightlife, mid budget", "Relaxed trip with cafés, markets and sunsets", "Adventure activities and local street food"];

export default function AIPlanner({ trip, aiEnabled, onClose, onAdded }) {
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState(null);
  const [chosen, setChosen] = useState({}); // "day-index" -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finding, setFinding] = useState(null); // "day-index" of the place being searched by hand

  async function generate(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setPlan(null);
    setFinding(null);
    try {
      const { days } = await api(`/trips/${trip.id}/ai/plan`, { method: "POST", body: { request } });
      setPlan(days);
      const pick = {};
      days.forEach((d) => d.places.forEach((p, i) => p.found && (pick[`${d.day}-${i}`] = true)));
      setChosen(pick);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addChosen() {
    const places = plan.flatMap((d) =>
      d.places
        .filter((p, i) => p.found && chosen[`${d.day}-${i}`])
        .map((p) => ({ name: p.name, note: p.note, lat: p.lat, lng: p.lng, address: p.address, day: d.day }))
    );
    if (!places.length) return;
    setBusy(true);
    try {
      const d = await api(`/trips/${trip.id}/places/bulk`, { method: "POST", body: { places } });
      onAdded(d.places);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  /**
   * The user picked a spot on the map for a suggestion the search couldn't find: the place itself,
   * or a nearby town or trailhead (small lakes and treks are often missing from the map).
   * The suggestion keeps its own name and note; only the pin comes from the picked place.
   */
  function placeFound(day, index, r) {
    setPlan(plan.map((d) => (d.day !== day ? d : { ...d, places: d.places.map((p, i) => (i !== index ? p : { ...p, lat: r.lat, lng: r.lng, address: r.address, pinnedAt: r.name, found: true })) })));
    setChosen({ ...chosen, [`${day}-${index}`]: true });
    setFinding(null);
  }

  const count = Object.values(chosen).filter(Boolean).length;
  const missing = plan ? plan.reduce((n, d) => n + d.places.filter((p) => !p.found).length, 0) : 0;
  const short = (address) => address?.split(",").slice(1, 4).join(",").trim();

  return (
    <Modal title="AI trip planner" onClose={onClose} wide>
      {!aiEnabled ? (
        <p className="muted">
          The AI planner is turned off. Add a free <strong>GEMINI_API_KEY</strong> or <strong>GROQ_API_KEY</strong> to <code>server/.env</code> and restart the server.
        </p>
      ) : (
        <>
          <form onSubmit={generate} className="stack">
            <label>
              What does your group want from {trip.days} {trip.days === 1 ? "day" : "days"} in {trip.destination}?
              <textarea rows={3} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="e.g. beaches, seafood and nightlife, ₹15k each" maxLength={500} />
            </label>
            <div className="chips">
              {EXAMPLES.map((ex) => <button type="button" key={ex} className="chip" onClick={() => setRequest(ex)}>{ex}</button>)}
            </div>
            <button className="btn btn-primary" disabled={busy || request.trim().length < 5}>
              {busy && !plan ? "Planning… (finding each place on the map)" : plan ? "Regenerate" : "Generate plan"}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          {plan && (
            <div className="ai-plan">
              <p className="muted small">
                Review the plan and untick anything you don't want.
                {missing > 0 && <> {missing} {missing === 1 ? "place wasn't" : "places weren't"} found on the map: use <strong>Find on map</strong> to pick the right one, or skip it (AI sometimes invents places).</>}
              </p>
              {plan.map((d) => (
                <div key={d.day} className="ai-day">
                  <h4><span className="day-dot" style={{ background: dayColor(d.day) }} /> Day {d.day}</h4>
                  {d.places.map((p, i) => {
                    const key = `${d.day}-${i}`;
                    return (
                      <div key={i} className={`ai-place-row ${p.found ? "" : "ai-missing"}`}>
                        <div className="ai-place-line">
                          <label className="ai-place">
                            <input
                              type="checkbox"
                              disabled={!p.found}
                              checked={Boolean(chosen[key])}
                              onChange={(e) => setChosen({ ...chosen, [key]: e.target.checked })}
                            />
                            <span>
                              <strong>{p.name}</strong> {!p.found && <em className="small">— not found on map</em>}
                              {p.note && <span className="muted small block">{p.note}</span>}
                              {p.found && p.address && (
                                <span className="ai-address small block">
                                  <MapPin size={12} aria-hidden="true" /> {p.pinnedAt && p.pinnedAt !== p.name ? `Pinned at ${p.pinnedAt}` : short(p.address) || p.address}
                                </span>
                              )}
                            </span>
                          </label>
                          {!p.found && finding !== key && (
                            <button type="button" className="btn btn-ghost btn-sm ai-find" onClick={() => setFinding(key)}>
                              <Search size={14} aria-hidden="true" /> Find on map
                            </button>
                          )}
                        </div>
                        {finding === key && (
                          <div className="ai-find-panel">
                            <div className="ai-find-box">
                              <PlaceSearch center={trip.center} initialQuery={p.name} autoFocus placeholder="Search the place or a nearby town" onPick={(r) => placeFound(d.day, i, r)} />
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFinding(null)}>Cancel</button>
                            </div>
                            <p className="muted small ai-find-hint">Not on the map? Search the nearest town or trailhead to pin it there. It keeps the name “{p.name}”.</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <button className="btn btn-primary btn-block" disabled={busy || !count} onClick={addChosen}>
                Add {count} {count === 1 ? "place" : "places"} to the itinerary
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
