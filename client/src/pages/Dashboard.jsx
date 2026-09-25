import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateRange } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const today = () => new Date().toISOString().slice(0, 10);

function CreateTripModal({ currencies, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", destination: "", startDate: today(), endDate: today(), currency: "INR" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { trip } = await api("/trips", { method: "POST", body: form });
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New trip" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label>
          Trip name
          <input value={form.name} onChange={set("name")} placeholder="Goa with the gang" required autoFocus />
        </label>
        <label>
          Destination
          <input value={form.destination} onChange={set("destination")} placeholder="Goa, India" required />
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
          Trip currency <span className="muted small">(balances are shown in this)</span>
          <select value={form.currency} onChange={set("currency")}>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating…" : "Create trip"}</button>
      </form>
    </Modal>
  );
}

export default function Dashboard() {
  const [trips, setTrips] = useState(null);
  const [meta, setMeta] = useState({ currencies: ["INR"] });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/trips").then((d) => setTrips(d.trips)).catch((e) => setError(e.message));
    api("/util/meta").then(setMeta).catch(() => {});
  }, []);

  function join(e) {
    e.preventDefault();
    // Accept a full invite link or just the code
    const code = joinCode.trim().split("/join/").pop().split(/[?#]/)[0];
    if (code) navigate(`/join/${code}`);
  }

  const now = new Date().setHours(0, 0, 0, 0);
  const upcoming = (trips || []).filter((t) => new Date(t.endDate) >= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const past = (trips || []).filter((t) => new Date(t.endDate) < now);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Your trips</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New trip</button>
      </div>

      <form className="join-bar card" onSubmit={join}>
        <span>Got an invite?</span>
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste invite link or code" />
        <button className="btn btn-secondary" disabled={!joinCode.trim()}>Join</button>
      </form>

      {error && <p className="error">{error}</p>}
      {!trips && !error && <div className="spinner" />}
      {trips?.length === 0 && (
        <div className="empty card">
          <div className="empty-icon">🧳</div>
          <h3>No trips yet</h3>
          <p className="muted">Create a trip and share the invite link with your friends.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Plan your first trip</button>
        </div>
      )}

      {[["Upcoming & ongoing", upcoming], ["Past trips", past]].map(([title, list]) =>
        list.length ? (
          <section key={title}>
            <h2 className="section-title">{title}</h2>
            <div className="trip-grid">
              {list.map((t) => (
                <Link key={t.id} to={`/trips/${t.id}`} className="trip-card card">
                  <div className="trip-card-dest">📍 {t.destination}</div>
                  <h3>{t.name}</h3>
                  <p className="muted small">{dateRange(t.startDate, t.endDate)}</p>
                  <div className="trip-card-meta">
                    <span>👥 {t.memberCount}</span>
                    <span>📌 {t.placeCount} places</span>
                    <span>{t.currency}</span>
                    {t.isOwner && <span className="badge">Owner</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null
      )}

      {creating && <CreateTripModal currencies={meta.currencies} onClose={() => setCreating(false)} />}
    </main>
  );
}
