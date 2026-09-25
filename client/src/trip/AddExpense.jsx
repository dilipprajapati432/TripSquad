import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { money, CATEGORY_ICONS } from "../lib/format.js";
import Modal from "../components/Modal.jsx";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddExpense({ trip, userId, meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    currency: trip.currency,
    paidBy: userId,
    category: "food",
    date: today(),
    splitMode: "equal",
  });
  const [participants, setParticipants] = useState(() => Object.fromEntries(trip.members.map((m) => [m.id, true])));
  const [shares, setShares] = useState(() => Object.fromEntries(trip.members.map((m) => [m.id, ""])));
  const [rate, setRate] = useState(1);
  const [rateError, setRateError] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const foreign = form.currency !== trip.currency;

  // Live exchange rate preview for foreign currencies
  useEffect(() => {
    if (!foreign) {
      setRate(1);
      setRateError("");
      return;
    }
    let alive = true;
    setRate(null);
    setRateError("");
    api(`/util/fx?from=${form.currency}&to=${trip.currency}`)
      .then((d) => alive && setRate(d.rate))
      .catch((e) => alive && setRateError(e.message));
    return () => {
      alive = false;
    };
  }, [form.currency, trip.currency, foreign]);

  const amountMinor = Math.round((Number(form.amount) || 0) * 100);
  const effectiveRate = Number(manualRate) > 0 ? Number(manualRate) : rate;
  const sharesMinor = useMemo(
    () => Object.values(shares).reduce((sum, v) => sum + Math.round((Number(v) || 0) * 100), 0),
    [shares]
  );
  const remaining = amountMinor - sharesMinor;
  const chosenCount = Object.values(participants).filter(Boolean).length;

  async function submit(e) {
    e.preventDefault();
    setError("");
    const body = {
      description: form.description,
      amount: form.amount,
      currency: form.currency,
      paidBy: form.paidBy,
      category: form.category,
      date: form.date,
      splitMode: form.splitMode,
    };
    if (foreign && Number(manualRate) > 0) body.rate = Number(manualRate);
    if (form.splitMode === "equal") body.participants = Object.keys(participants).filter((id) => participants[id]);
    else body.shares = Object.entries(shares).map(([user, amount]) => ({ user, amount: amount || 0 }));
    setBusy(true);
    try {
      await api(`/trips/${trip.id}/expenses`, { method: "POST", body });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Add expense" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label>
          What was it for?
          <input value={form.description} onChange={set("description")} placeholder="Dinner at the beach shack" required autoFocus maxLength={100} />
        </label>
        <div className="row-2">
          <label>
            Amount
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" required />
          </label>
          <label>
            Currency
            <select value={form.currency} onChange={set("currency")}>
              {meta.currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {foreign && (
          <div className="fx-box">
            {rate && !manualRate && <span>1 {form.currency} = {rate.toFixed(4)} {trip.currency}</span>}
            {rateError && <span className="error small">{rateError}</span>}
            {effectiveRate && amountMinor > 0 && (
              <strong> ≈ {money(Math.round(amountMinor * effectiveRate), trip.currency)}</strong>
            )}
            <label className="small">
              Use my own rate (optional)
              <input type="number" step="any" min="0" value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder={rate ? rate.toFixed(4) : "rate"} />
            </label>
          </div>
        )}
        <div className="row-2">
          <label>
            Paid by
            <select value={form.paidBy} onChange={set("paidBy")}>
              {trip.members.map((m) => <option key={m.id} value={m.id}>{m.id === userId ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={set("date")} />
          </label>
        </div>
        <div className="chips">
          {meta.categories.map((c) => (
            <button type="button" key={c} className={`chip chip-cap ${form.category === c ? "chip-active" : ""}`} onClick={() => setForm({ ...form, category: c })}>
              {CATEGORY_ICONS[c]} {c}
            </button>
          ))}
        </div>

        <div className="segmented">
          <button type="button" className={form.splitMode === "equal" ? "active" : ""} onClick={() => setForm({ ...form, splitMode: "equal" })}>Split equally</button>
          <button type="button" className={form.splitMode === "exact" ? "active" : ""} onClick={() => setForm({ ...form, splitMode: "exact" })}>Exact amounts</button>
        </div>

        {form.splitMode === "equal" ? (
          <div className="split-list">
            {trip.members.map((m) => (
              <label key={m.id} className="split-row">
                <input type="checkbox" checked={participants[m.id]} onChange={(e) => setParticipants({ ...participants, [m.id]: e.target.checked })} />
                <span>{m.name}</span>
                <span className="muted small push">
                  {participants[m.id] && chosenCount && amountMinor ? `${form.currency} ${(amountMinor / chosenCount / 100).toFixed(2)}` : ""}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="split-list">
            {trip.members.map((m) => (
              <label key={m.id} className="split-row">
                <span>{m.name}</span>
                <input
                  className="push share-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={shares[m.id]}
                  onChange={(e) => setShares({ ...shares, [m.id]: e.target.value })}
                  placeholder="0.00"
                />
              </label>
            ))}
            <p className={`small ${remaining === 0 ? "ok-text" : "error"}`}>
              {remaining === 0 ? "✓ Shares match the total" : remaining > 0 ? `${(remaining / 100).toFixed(2)} ${form.currency} left to assign` : `${(-remaining / 100).toFixed(2)} ${form.currency} too much`}
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <button
          className="btn btn-primary btn-block"
          disabled={busy || (form.splitMode === "exact" && remaining !== 0) || (form.splitMode === "equal" && !chosenCount)}
        >
          {busy ? "Saving…" : "Save expense"}
        </button>
      </form>
    </Modal>
  );
}
