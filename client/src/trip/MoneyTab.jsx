import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { Handshake, Plus, Scale, Target, Trash2, Receipt } from "lucide-react";
import { money, formatDay } from "../lib/format.js";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_TINTS } from "../lib/icons.jsx";
import Avatar from "../components/Avatar.jsx";
import { useUI } from "../context/UIContext.jsx";
import AddExpense from "./AddExpense.jsx";

function CatIcon({ category, size = 15 }) {
  const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
  return <Icon size={size} />;
}

export default function MoneyTab({ trip, userId, meta, onProfile }) {
  const { confirm, toast } = useUI();
  const [expenses, setExpenses] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [settling, setSettling] = useState(null); // "from-to" of the payment being recorded
  const [payInfo, setPayInfo] = useState({}); // userId -> how they want to be paid

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
    socket.on("connect", load); // catch up on anything added while we were offline
    return () => {
      socket.off("expenses:updated", load);
      socket.off("connect", load);
    };
  }, [load]);

  // Balances change when members join/leave
  useEffect(() => {
    if (summary) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.members.length]);

  // Show "Pay via: Revolut @riya" next to payments I need to make
  const payees = summary?.payments.filter((p) => p.from === userId).map((p) => p.to).join(",") || "";
  useEffect(() => {
    for (const id of payees.split(",").filter(Boolean)) {
      api(`/users/${id}`)
        .then((d) => setPayInfo((prev) => ({ ...prev, [id]: d.user.paymentInfo })))
        .catch(() => {});
    }
  }, [payees]);

  async function settle(p) {
    if (settling) return;
    const ok = await confirm({
      title: "Record payment",
      message: `Record that ${name(p.from)} paid ${name(p.to)} ${money(p.amount, cur)}? Everyone's balances update right away.`,
      confirmText: "Mark paid",
    });
    if (!ok) return;
    setSettling(`${p.from}-${p.to}`);
    try {
      await api(`/trips/${trip.id}/expenses/settlements`, { method: "POST", body: p });
      toast("Payment recorded", { icon: "settle", type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setSettling(null);
      load(); // the server may have refused because someone else just recorded it
    }
  }

  async function remove(e) {
    const ok = await confirm({ title: "Delete expense", message: `Delete "${e.description}"? Balances will be recalculated.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/trips/${trip.id}/expenses/${e.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      toast(err.message, { type: "error" });
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
          <span className="stat-label"><span className="stat-icon tint-amber"><Receipt size={16} /></span> Group total</span>
          <strong className="stat-value">{money(summary.totalSpent, cur)}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label"><span className={`stat-icon ${myBalance < 0 ? "tint-red" : "tint-green"}`}><Scale size={16} /></span> Your balance</span>
          <strong className={`stat-value ${myBalance > 0 ? "pos" : myBalance < 0 ? "neg" : ""}`}>
            {myBalance === 0 ? "Settled" : `${myBalance > 0 ? "+" : "−"}${money(Math.abs(myBalance), cur)}`}
          </strong>
          <span className="muted small">{myBalance > 0 ? "others owe you" : myBalance < 0 ? "you owe" : "nothing owed"}</span>
        </div>
        <div className="card stat">
          <span className="stat-label"><span className="stat-icon tint-blue"><Target size={16} /></span> Your share of spending</span>
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
              <p className="muted">Everyone is settled up.</p>
            ) : (
              <>
                <p className="muted small">
                  {summary.payments.length} {summary.payments.length === 1 ? "payment" : "payments"} settles everything
                  {summary.naivePayments > summary.payments.length && ` (instead of ${summary.naivePayments} without simplifying)`}.
                </p>
                <ul className="list">
                  {summary.payments.map((p, i) => (
                    <li key={i} className="settle-row">
                      <Avatar member={memberById[p.from]} size={28} onClick={() => onProfile?.(p.from)} />
                      <span>
                        <strong>{name(p.from)}</strong> {p.from === userId ? "pay" : "pays"} <strong>{name(p.to)}</strong>
                      </span>
                      <strong className="push">{money(p.amount, cur)}</strong>
                      {canRecord(p) && <button className="btn btn-secondary btn-sm" onClick={() => settle(p)} disabled={settling === `${p.from}-${p.to}`}>{settling === `${p.from}-${p.to}` ? "Saving…" : "Mark paid"}</button>}
                      {p.from === userId && payInfo[p.to] && <span className="pay-hint">{memberById[p.to]?.name.split(" ")[0]} accepts: {payInfo[p.to]}</span>}
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
                    <Avatar member={m} size={28} onClick={() => onProfile?.(m.id)} />
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
                  <span className="inline-icon"><span className={`cat-dot ${CATEGORY_TINTS[c] || "tint-gray"}`}><CatIcon category={c} size={13} /></span> {CATEGORY_LABELS[c] || c}</span>
                  <div className={`bar bar-tint ${CATEGORY_TINTS[c] || "tint-gray"}`}><span style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                  <span className="small">{money(v, cur)}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <section className="card">
          <div className="section-head">
            <h3>Expenses</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={15} /> Add expense</button>
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
                    <span className={`expense-icon ${settlement ? "tint-green" : CATEGORY_TINTS[e.category] || "tint-gray"}`}>{settlement ? <Handshake size={18} /> : <CatIcon category={e.category} size={18} />}</span>
                    <div className="expense-main">
                      <strong>{settlement ? `${name(e.paidBy)} paid ${name(e.splits[0]?.user)}` : e.description}</strong>
                      <span className="muted small">
                        {formatDay(e.date)} · {settlement ? "settle-up" : `${name(e.paidBy)} paid`}
                        {!settlement && e.splits.length > 0 && ` · split ${e.splits.length} ways`}
                      </span>
                    </div>
                    <div className="expense-amt">
                      <strong>{money(e.amount, e.currency)}</strong>
                      {e.currency !== cur && <span className="muted small">≈ {money(e.amountBase, cur)}</span>}
                      {!settlement && myShare > 0 && <span className="small">your share {money(myShare, cur)}</span>}
                    </div>
                    {(e.createdBy === userId || trip.isOwner) && (
                      <button className="icon-btn" title="Delete" aria-label="Delete expense" onClick={() => remove(e)}><Trash2 size={16} /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {adding && <AddExpense trip={trip} userId={userId} meta={meta} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
}
