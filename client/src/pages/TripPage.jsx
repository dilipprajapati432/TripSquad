import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { dateRange } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";
import { useTrip } from "../trip/useTrip.js";
import { useLocationSharing } from "../trip/useLocationSharing.js";
import PlanTab from "../trip/PlanTab.jsx";
import MoneyTab from "../trip/MoneyTab.jsx";
import PollsTab from "../trip/PollsTab.jsx";
import PeopleTab from "../trip/PeopleTab.jsx";

const TABS = [
  { id: "plan", label: "🗺️ Plan" },
  { id: "money", label: "💸 Money" },
  { id: "polls", label: "🗳️ Polls" },
  { id: "people", label: "👥 People" },
];

function EditTripModal({ trip, currencies, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate.slice(0, 10),
    endDate: trip.endDate.slice(0, 10),
    currency: trip.currency,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { trip: updatedTrip } = await api(`/trips/${trip.id}`, { method: "PATCH", body: form });
      onSaved(updatedTrip);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit trip" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label>
          Trip name
          <input value={form.name} onChange={set("name")} required autoFocus />
        </label>
        <label>
          Destination
          <input value={form.destination} onChange={set("destination")} required />
        </label>
        <div className="row-2">
          <label>
            Start
            <input type="date" value={form.startDate} onChange={set("startDate")} required />
          </label>
          <label>
            End
            <input type="date" value={form.endDate} min={form.startDate} onChange={set("endDate")} required />
          </label>
        </div>
        <label>
          Trip currency
          <select value={form.currency} onChange={set("currency")}>
            {currencies.map((currency) => <option key={currency}>{currency}</option>)}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form>
    </Modal>
  );
}

export default function TripPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "plan";
  const [meta, setMeta] = useState({ currencies: ["INR"], categories: ["other"], aiEnabled: false, maxMembers: 30 });
  const [editing, setEditing] = useState(false);

  const { trip, setTrip, error, online, locations, setLocations, connected } = useTrip(tripId, user.id, {
    onGone: (message) => {
      alert(message);
      navigate("/", { replace: true });
    },
  });
  const loc = useLocationSharing(tripId, user.id, setLocations);

  useEffect(() => {
    api("/util/meta").then(setMeta).catch(() => {});
  }, []);

  if (error) {
    return (
      <main className="page narrow">
        <div className="card center">
          <p className="error">{error}</p>
          <Link to="/" className="btn btn-secondary">Back to my trips</Link>
        </div>
      </main>
    );
  }
  if (!trip) return <div className="center-screen"><div className="spinner" /></div>;

  return (
    <main className="trip">
      <div className="trip-head">
        <div>
          <Link to="/" className="muted small">← All trips</Link>
          <div className="row">
            <h1>{trip.name}</h1>
            {trip.isOwner && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit trip</button>}
          </div>
          <p className="muted">📍 {trip.destination} · {dateRange(trip.startDate, trip.endDate)} · {trip.days} {trip.days === 1 ? "day" : "days"}</p>
        </div>
        <div className="trip-head-right">
          <div className="avatars" title="People in this trip (green = online)">
            {trip.members.slice(0, 6).map((m) => <Avatar key={m.id} member={m} online={online.includes(m.id)} />)}
            {trip.members.length > 6 && <span className="avatar avatar-more">+{trip.members.length - 6}</span>}
          </div>
          <button className={`btn btn-sm ${loc.sharing ? "btn-live" : "btn-secondary"}`} onClick={loc.sharing ? loc.stop : loc.start}>
            {loc.sharing ? "● Sharing live location — stop" : "📍 Share my location"}
          </button>
        </div>
      </div>
      {loc.error && <p className="error">{loc.error}</p>}
      {loc.sharing && <p className="muted small">Visible only to people in this trip while this page is open. Turns off automatically after 1 hour.</p>}
      {!connected && <div className="offline-bar">Reconnecting… changes from friends will appear when you're back online.</div>}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "tab-active" : ""}`} onClick={() => setParams(t.id === "plan" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "plan" && <PlanTab trip={trip} setTrip={setTrip} locations={locations} aiEnabled={meta.aiEnabled} />}
      {tab === "money" && <MoneyTab trip={trip} userId={user.id} meta={meta} />}
      {tab === "polls" && <PollsTab trip={trip} userId={user.id} />}
      {tab === "people" && <PeopleTab trip={trip} userId={user.id} online={online} meta={meta} />}
      {editing && <EditTripModal trip={trip} currencies={meta.currencies} onClose={() => setEditing(false)} onSaved={(updatedTrip) => { setTrip(updatedTrip); setEditing(false); }} />}
    </main>
  );
}
