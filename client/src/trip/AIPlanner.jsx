import { useState } from "react";
import { api } from "../lib/api.js";
import Modal from "../components/Modal.jsx";
import { dayColor } from "../lib/format.js";

const EXAMPLES = ["Beaches, seafood and nightlife, mid budget", "Relaxed trip with cafés, markets and sunsets", "Adventure activities and local street food"];

export default function AIPlanner({ trip, aiEnabled, onClose, onAdded }) {
  const [request, setRequest] = useState("");
  const [plan, setPlan] = useState(null);
  const [chosen, setChosen] = useState({}); // "day-index" -> true
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setPlan(null);
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

  const count = Object.values(chosen).filter(Boolean).length;

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
              <p className="muted small">Review the plan. Places the map couldn't find are greyed out (AI sometimes invents places).</p>
              {plan.map((d) => (
                <div key={d.day} className="ai-day">
                  <h4><span className="day-dot" style={{ background: dayColor(d.day) }} /> Day {d.day}</h4>
                  {d.places.map((p, i) => (
                    <label key={i} className={`ai-place ${p.found ? "" : "ai-missing"}`}>
                      <input
                        type="checkbox"
                        disabled={!p.found}
                        checked={Boolean(chosen[`${d.day}-${i}`])}
                        onChange={(e) => setChosen({ ...chosen, [`${d.day}-${i}`]: e.target.checked })}
                      />
                      <span>
                        <strong>{p.name}</strong> {!p.found && <em className="small">— not found on map</em>}
                        {p.note && <span className="muted small block">{p.note}</span>}
                      </span>
                    </label>
                  ))}
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
