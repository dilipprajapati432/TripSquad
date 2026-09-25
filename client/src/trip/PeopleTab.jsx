import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { money } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";

function TripSettings({ trip, currencies }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate.slice(0, 10),
    endDate: trip.endDate.slice(0, 10),
    currency: trip.currency,
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      await api(`/trips/${trip.id}`, { method: "PATCH", body: form });
      setMsg("Saved ✓");
    } catch (err) {
      setError(err.message);
    }
  }

  async function del() {
    if (!confirm(`Delete "${trip.name}" for everyone? This removes all places, polls and expenses.`)) return;
    try {
      await api(`/trips/${trip.id}`, { method: "DELETE" });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h3>Trip settings</h3>
      <label>Name<input value={form.name} onChange={set("name")} required /></label>
      <label>Destination<input value={form.destination} onChange={set("destination")} required /></label>
      <div className="row-2">
        <label>Start<input type="date" value={form.startDate} onChange={set("startDate")} required /></label>
        <label>End<input type="date" value={form.endDate} min={form.startDate} onChange={set("endDate")} required /></label>
      </div>
      <label>
        Currency
        <select value={form.currency} onChange={set("currency")}>
          {currencies.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <p className="muted small">If you shorten the trip, places on removed days move back to Ideas.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary btn-sm">Save changes</button>
        {msg && <span className="ok-text small">{msg}</span>}
        <button type="button" className="btn btn-danger btn-sm push" onClick={del}>Delete trip</button>
      </div>
    </form>
  );
}

export default function PeopleTab({ trip, userId, online, meta }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const link = `${window.location.origin}/join/${trip.inviteCode}`;

  async function copy() {
    try {
      if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
        await navigator.share({ title: trip.name, text: `Join our trip "${trip.name}" on TripSquad`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }

  async function resetLink() {
    if (!confirm("Reset the invite link? The old link will stop working.")) return;
    try {
      await api(`/trips/${trip.id}/invite/reset`, { method: "POST" });
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeMember(m) {
    const self = m.id === userId;
    if (!confirm(self ? `Leave "${trip.name}"?` : `Remove ${m.name} from the trip?`)) return;
    setError("");
    try {
      await api(`/trips/${trip.id}/members/${m.id}`, { method: "DELETE" });
      if (self) navigate("/", { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="people">
      <section className="card stack">
        <h3>Invite friends</h3>
        <p className="muted small">Anyone with this link can join the trip (max {meta.maxMembers || 30} people).</p>
        <div className="invite-box">
          <code>{link}</code>
          <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
        </div>
        <a
          className="btn btn-whatsapp btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(`Join our trip "${trip.name}" on TripSquad: ${link}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Share on WhatsApp
        </a>
        {trip.isOwner && <button className="link-btn" onClick={resetLink}>Reset invite link</button>}
      </section>

      <section className="card">
        <h3>People ({trip.members.length})</h3>
        {error && <p className="error">{error}</p>}
        <ul className="list">
          {trip.members.map((m) => (
            <li key={m.id} className="settle-row">
              <Avatar member={m} size={34} online={online.includes(m.id)} />
              <span>
                <strong>{m.name}</strong> {m.id === userId && <span className="muted">(you)</span>}
                <span className="muted small block">
                  {m.role === "owner" ? "Owner" : "Member"} · {online.includes(m.id) ? "online now" : "offline"}
                  {m.budget > 0 && ` · budget ${money(m.budget, trip.currency)}`}
                </span>
              </span>
              {m.role !== "owner" && (m.id === userId || trip.isOwner) && (
                <button className="btn btn-ghost btn-sm push" onClick={() => removeMember(m)}>
                  {m.id === userId ? "Leave" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="muted small">People can only leave once their balance is settled.</p>
      </section>

      {trip.isOwner && <TripSettings key={trip.id + trip.name + trip.startDate + trip.endDate} trip={trip} currencies={meta.currencies} />}
    </div>
  );
}
