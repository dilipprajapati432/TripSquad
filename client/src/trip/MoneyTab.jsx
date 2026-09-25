import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { money, formatDate, CATEGORY_ICONS } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";
import AddExpense from "./AddExpense.jsx";

export default function MoneyTab({ trip, userId, meta }) {
  const [expenses, setExpenses] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const memberById = useMemo(() => Object.fromEntries(trip.members.map((m) => [m.id, m])), [trip.members]);
  const name = (id) => (id === userId ? "You" : memberById[id]?.name || "Former member");
  const cur = trip.currency;

  const load = useCallback(() => {
    Promise.all([api(`/trips/${trip.id}/expenses`), api(`/trips/${trip.id}/expenses/summary`)])
      .then(([e, s]) => {
        setExpenses(e.expenses);
        setSummary(s);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [trip.id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on("expenses:updated", load); // a friend added/removed an expense
    return () => socket.off("expenses:updated", load);
  }, [load]);

  // Balances change when members join/leave
  useEffect(() => {
    if (summary) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.members.length]);

  async function settle(p) {
    setConfirmation({ type: "settle", payment: p });
  }

  async function remove(e) {
    setConfirmation({ type: "remove", expense: e });
  }

  async function confirmAction() {
    const action = confirmation;
    setConfirmation(null);
    try {
      if (action.type === "settle") {
        await api(`/trips/${trip.id}/expenses/settlements`, { method: "POST", body: action.payment });
      } else {
        await api(`/trips/${trip.id}/expenses/${action.expense.id}`, { method: "DELETE" });
      }
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveBudget(ev) {
    ev.preventDefault();
    try {
      await api(`/trips/${trip.id}/me/budget`, { method: "PATCH", body: { budget: budgetInput || 0 } });
      setEditingBudget(false);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !summary) return <p className="error">{error}</p>;
  if (!summary || !expenses) return <div className="spinner" />;

  const me = trip.members.find((m) => m.id === userId);
  const myBalance = summary.balances[userId] || 0;
  const mySpent = summary.perMember[userId]?.spent || 0;
  const budget = me?.budget || 0;
  const pct = budget ? Math.min(100, Math.round((mySpent / budget) * 100)) : 0;
  const maxCat = Math.max(1, ...Object.values(summary.byCategory));
  const canRecord = (p) => p.from === userId || p.to === userId || trip.isOwner;

  return (
    <div className="money">
      <div className="stat-grid">
        <div className="card stat">
          <span className="muted small">Group total</span>
          <strong className="stat-value">{money(summary.totalSpent, cur)}</strong>
        </div>
        <div className="card stat">
          <span className="muted small">Your balance</span>
          <strong className={`stat-value ${myBalance > 0 ? "pos" : myBalance < 0 ? "neg" : ""}`}>
            {myBalance === 0 ? "Settled ✓" : `${myBalance > 0 ? "+" : "−"}${money(Math.abs(myBalance), cur)}`}
          </strong>
          <span className="muted small">{myBalance > 0 ? "others owe you" : myBalance < 0 ? "you owe" : "nothing owed"}</span>
        </div>
        <div className="card stat">
          <span className="muted small">Your share of spending</span>
          <strong className="stat-value">{money(mySpent, cur)}</strong>
          {editingBudget ? (
            <form className="row" onSubmit={saveBudget}>
              <input type="number" min="0" step="1" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder={`Budget in ${cur}`} autoFocus />
              <button className="btn btn-primary btn-sm">Save</button>
            </form>
          ) : budget ? (
            <>
              <div className={`bar ${pct >= 100 ? "bar-over" : pct >= 80 ? "bar-warn" : ""}`}><span style={{ width: `${pct}%` }} /></div>
              <span className="muted small">
                {pct}% of {money(budget, cur)} budget ·{" "}
                <button className="link-btn" onClick={() => { setBudgetInput(String(budget / 100)); setEditingBudget(true); }}>edit</button>
              </span>
            </>
          ) : (
            <button className="link-btn" onClick={() => setEditingBudget(true)}>Set a personal budget</button>
          )}
        </div>
      </div>

      <div className="money-cols">
        <div>
          <section className="card">
            <h3>Settle up</h3>
            {summary.payments.length === 0 ? (
              <p className="muted">Everyone is settled up. 🎉</p>
            ) : (
              <>
                <p className="muted small">
                  {summary.payments.length} {summary.payments.length === 1 ? "payment" : "payments"} settles everything
                  {summary.naivePayments > summary.payments.length && ` (instead of ${summary.naivePayments} without simplifying)`}.
                </p>
                <ul className="list">
                  {summary.payments.map((p, i) => (
                    <li key={i} className="settle-row">
                      <Avatar member={memberById[p.from]} size={28} />
                      <span>
                        <strong>{name(p.from)}</strong> {p.from === userId ? "pay" : "pays"} <strong>{name(p.to)}</strong>
                      </span>
                      <strong className="push">{money(p.amount, cur)}</strong>
                      {canRecord(p) && <button className="btn btn-secondary btn-sm" onClick={() => settle(p)}>Mark paid</button>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card">
            <h3>Balances</h3>
            <ul className="list">
              {trip.members.map((m) => {
                const b = summary.balances[m.id] || 0;
                return (
                  <li key={m.id} className="settle-row">
                    <Avatar member={m} size={28} />
                    <span>{m.id === userId ? `${m.name} (you)` : m.name}</span>
                    <span className="muted small">paid {money(summary.perMember[m.id]?.paid || 0, cur)}</span>
                    <strong className={`push ${b > 0 ? "pos" : b < 0 ? "neg" : ""}`}>{b === 0 ? "—" : `${b > 0 ? "+" : "−"}${money(Math.abs(b), cur)}`}</strong>
                  </li>
                );
              })}
            </ul>
          </section>

          {Object.keys(summary.byCategory).length > 0 && (
            <section className="card">
              <h3>By category</h3>
              {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <div key={c} className="cat-row">
                  <span>{CATEGORY_ICONS[c]} {c}</span>
                  <div className="bar"><span style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                  <span className="small">{money(v, cur)}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <section className="card">
          <div className="section-head">
            <h3>Expenses</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add expense</button>
          </div>
          {error && <p className="error">{error}</p>}
          {expenses.length === 0 ? (
            <p className="muted">No expenses yet. Add one when someone pays for something.</p>
          ) : (
            <ul className="list">
              {expenses.map((e) => {
                const myShare = e.splits.find((s) => s.user === userId)?.share || 0;
                const settlement = e.kind === "settlement";
                return (
                  <li key={e.id} className={`expense ${settlement ? "expense-settle" : ""}`}>
                    <span className="expense-icon">{settlement ? "🤝" : CATEGORY_ICONS[e.category]}</span>
                    <div className="expense-main">
                      <strong>{settlement ? `${name(e.paidBy)} paid ${name(e.splits[0]?.user)}` : e.description}</strong>
                      <span className="muted small">
                        {formatDate(e.date)} · {settlement ? "settle-up" : `${name(e.paidBy)} paid`}
                        {!settlement && e.splits.length > 0 && ` · split ${e.splits.length} ways`}
                      </span>
                    </div>
                    <div className="expense-amt">
                      <strong>{money(e.amount, e.currency)}</strong>
                      {e.currency !== cur && <span className="muted small">≈ {money(e.amountBase, cur)}</span>}
                      {!settlement && myShare > 0 && <span className="small">your share {money(myShare, cur)}</span>}
                    </div>
                    {(e.createdBy === userId || trip.isOwner) && (
                      <button className="icon-btn" title="Delete" onClick={() => remove(e)}>🗑</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {confirmation && (
        <Modal
          title={confirmation.type === "settle" ? "Record payment" : "Delete expense"}
          onClose={() => setConfirmation(null)}
        >
          <p>
            {confirmation.type === "settle"
              ? `Record that ${name(confirmation.payment.from)} paid ${name(confirmation.payment.to)} ${money(confirmation.payment.amount, cur)}?`
              : `Delete "${confirmation.expense.description}"?`}
          </p>
          <div className="row modal-actions">
            <button className="btn btn-danger" onClick={() => setConfirmation(null)}>Cancel</button>
            <button className={`btn ${confirmation.type === "remove" ? "btn-danger" : "btn-primary"}`} onClick={confirmAction}>
              {confirmation.type === "settle" ? "Mark paid" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
      {adding && <AddExpense trip={trip} userId={userId} meta={meta} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
}
