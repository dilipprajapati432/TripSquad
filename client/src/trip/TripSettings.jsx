import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { Lock, MapPin } from "lucide-react";
import Cover from "../components/Cover.jsx";
import ThemePicker from "../components/ThemePicker.jsx";
import { useUI } from "../context/UIContext.jsx";
import Modal from "../components/Modal.jsx";

const DAY = 86400000;
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY) + 1;

/** One place to edit the trip (owner only): details, color and the danger zone. */
export default function TripSettings({ trip, currencies, onClose, onSaved }) {
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const [form, setForm] = useState({
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate.slice(0, 10),
    endDate: trip.endDate.slice(0, 10),
    currency: trip.currency,
    theme: trip.theme || 0,
    requireContact: Boolean(trip.requireContact),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Warn before shortening: which places would move back to Ideas?
  const newDays = form.endDate >= form.startDate ? daysBetween(form.startDate, form.endDate) : 0;
  const orphaned = trip.places.filter((p) => p.day > newDays);
  const datesInvalid = form.endDate < form.startDate;
  const changed = Object.keys(form).some((k) => String(form[k]) !== String(k === "startDate" || k === "endDate" ? trip[k].slice(0, 10) : trip[k] ?? 0));

  async function save(e) {
    e.preventDefault();
    if (orphaned.length) {
      const ok = await confirm({
        title: "Shorten the trip?",
        message: `${orphaned.length} place${orphaned.length > 1 ? "s" : ""} on removed days (${orphaned.map((p) => p.name).slice(0, 3).join(", ")}${orphaned.length > 3 ? "…" : ""}) will move back to Ideas. Nothing is deleted.`,
        confirmText: "Shorten trip",
      });
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      const { trip: updated } = await api(`/trips/${trip.id}`, { method: "PATCH", body: form });
      onSaved(updated);
      toast("Trip updated — everyone sees the change now", { type: "success" });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function del() {
    const ok = await confirm({
      title: `Delete "${trip.name}"?`,
      message: "This deletes the trip for everyone: all places, polls, expenses and chat messages. This can't be undone.",
      confirmText: "Delete for everyone",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/trips/${trip.id}`, { method: "DELETE" });
      toast("Trip deleted", { icon: "delete" });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Trip settings" onClose={onClose} wide>
      <form onSubmit={save} className="stack">
        <div className="settings-preview">
          <Cover cover={form.destination === trip.destination ? trip.cover : null} theme={form.theme} className="settings-thumb" />
          <div style={{ minWidth: 0 }}>
            <strong className="truncate block">{form.name || "Trip name"}</strong>
            <span className="muted small inline-icon"><MapPin size={13} /> {form.destination || "Destination"}</span>
          </div>
        </div>

        <label>
          Trip name
          <input value={form.name} onChange={set("name")} required minLength={2} maxLength={80} />
        </label>
        <label>
          Destination
          <input value={form.destination} onChange={set("destination")} required maxLength={120} />
          <span className="hint">Changing it re-centres the map and weather.</span>
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
        {datesInvalid && <div className="warn-box">The end date must be on or after the start date.</div>}
        {!datesInvalid && newDays !== trip.days && (
          <div className="warn-box">
            {newDays > trip.days ? `Adds ${newDays - trip.days} day${newDays - trip.days > 1 ? "s" : ""} (${newDays} total).` : `Trip becomes ${newDays} day${newDays > 1 ? "s" : ""}.`}
            {orphaned.length > 0 && ` ${orphaned.length} place${orphaned.length > 1 ? "s" : ""} will move back to Ideas.`}
          </div>
        )}
        <label>
          Trip currency
          <select value={form.currency} onChange={set("currency")} disabled={trip.hasExpenses}>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
          {trip.hasExpenses && <span className="hint inline-icon"><Lock size={12} /> Locked because expenses exist — changing it would make old balances wrong.</span>}
        </label>

        <label className="switch-row">
          <input type="checkbox" checked={form.requireContact} onChange={(e) => setForm({ ...form, requireContact: e.target.checked })} />
          <span>
            <strong>Require phone + emergency contact to join</strong>
            <span className="hint block">New members must add both before they can join. Good for group trips with people you don't know well.</span>
          </span>
        </label>

        <div className="stack-sm">
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Trip color</span>
          <ThemePicker value={form.theme} onChange={(theme) => setForm({ ...form, theme })} />
        </div>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || datesInvalid || !changed}>{busy ? "Saving…" : "Save changes"}</button>
        </div>

        <div className="danger-zone">
          <strong className="error" style={{ fontSize: "0.95rem" }}>Danger zone</strong>
          <p className="small muted">Deleting removes the trip, its expenses and its chat for all {trip.members.length} members.</p>
          <button type="button" className="btn btn-danger btn-sm" style={{ alignSelf: "flex-start" }} onClick={del}>Delete trip</button>
        </div>
      </form>
    </Modal>
  );
}
