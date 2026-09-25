import { Router } from "express";
import mongoose from "mongoose";
import { Expense } from "../models/Expense.js";
import { HttpError } from "../middleware/errors.js";
import { CURRENCIES, toMinor, splitEqual, allocate, convert } from "../utils/money.js";
import { computeBalances, simplifyDebts, naivePaymentCount } from "../utils/settle.js";
import { serializeExpense } from "../utils/serialize.js";
import { getRate } from "../services/fx.js";
import { emitToTrip } from "../services/realtime.js";

// Mounted at /api/trips/:tripId/expenses (loadTrip already ran)
const router = Router({ mergeParams: true });
export const CATEGORIES = ["food", "stay", "transport", "activity", "shopping", "other"];

const memberIds = (trip) => trip.members.map((m) => m.user.toString());

function notify(req) {
  // Clients re-fetch the list + summary when this arrives
  emitToTrip(req.trip._id.toString(), "expenses:updated", { by: req.user._id.toString() });
}

router.get("/", async (req, res) => {
  const expenses = await Expense.find({ trip: req.trip._id }).sort({ date: -1, createdAt: -1 });
  res.json({ expenses: expenses.map(serializeExpense) });
});

router.get("/summary", async (req, res) => {
  const ids = memberIds(req.trip);
  const expenses = await Expense.find({ trip: req.trip._id });
  const balances = computeBalances(ids, expenses);
  const payments = simplifyDebts(balances);

  const perMember = Object.fromEntries(ids.map((id) => [id, { paid: 0, spent: 0 }]));
  let totalSpent = 0;
  for (const e of expenses) {
    if (e.kind !== "expense") continue;
    totalSpent += e.amountBase;
    const payer = e.paidBy.toString();
    if (perMember[payer]) perMember[payer].paid += e.amountBase;
    for (const s of e.splits) {
      const u = s.user.toString();
      if (perMember[u]) perMember[u].spent += s.share;
    }
  }
  const byCategory = {};
  for (const e of expenses) if (e.kind === "expense") byCategory[e.category] = (byCategory[e.category] || 0) + e.amountBase;

  res.json({
    currency: req.trip.currency,
    totalSpent,
    balances,
    perMember,
    byCategory,
    payments,
    naivePayments: naivePaymentCount(expenses.filter((e) => e.kind === "expense")),
  });
});

router.post("/", async (req, res) => {
  const trip = req.trip;
  const members = memberIds(trip);
  const body = req.body || {};

  const description = String(body.description || "").trim().slice(0, 100);
  if (!description) throw new HttpError(400, "What was this expense for?");
  const category = CATEGORIES.includes(body.category) ? body.category : "other";
  const amount = toMinor(body.amount);
  if (!amount) throw new HttpError(400, "Please enter an amount greater than 0");
  if (amount > 100_000_000_00) throw new HttpError(400, "That amount is too large");
  const currency = String(body.currency || trip.currency).toUpperCase();
  if (!CURRENCIES.includes(currency)) throw new HttpError(400, "Unsupported currency");
  const paidBy = String(body.paidBy || req.user._id);
  if (!members.includes(paidBy)) throw new HttpError(400, "The payer must be in the trip");

  // Exchange rate: saved with the expense so it never changes later
  let rate = 1;
  if (currency !== trip.currency) {
    const manual = Number(body.rate);
    if (Number.isFinite(manual) && manual > 0) rate = manual;
    else {
      try {
        rate = await getRate(currency, trip.currency);
      } catch {
        throw new HttpError(502, "Couldn't fetch the exchange rate. Enter the rate manually.");
      }
    }
  }
  const amountBase = Math.max(1, convert(amount, rate));

  let splits;
  if (body.splitMode === "exact") {
    const shares = (Array.isArray(body.shares) ? body.shares : [])
      .map((s) => ({ user: String(s.user), amount: s.amount === "" || Number(s.amount) === 0 ? 0 : toMinor(s.amount) }))
      .filter((s) => s.amount !== 0);
    if (!shares.length) throw new HttpError(400, "Enter how much each person owes");
    if (shares.some((s) => s.amount === null)) throw new HttpError(400, "Share amounts must be positive numbers");
    if (shares.some((s) => !members.includes(s.user))) throw new HttpError(400, "Everyone in the split must be in the trip");
    if (new Set(shares.map((s) => s.user)).size !== shares.length) throw new HttpError(400, "Each person can appear only once");
    const sum = shares.reduce((a, s) => a + s.amount, 0);
    if (sum !== amount) {
      throw new HttpError(400, `Shares add up to ${(sum / 100).toFixed(2)} but the total is ${(amount / 100).toFixed(2)}`);
    }
    const baseShares = allocate(amountBase, shares.map((s) => s.amount));
    splits = shares.map((s, i) => ({ user: s.user, share: baseShares[i] }));
  } else {
    const participants = [...new Set((Array.isArray(body.participants) ? body.participants : members).map(String))];
    if (!participants.length) throw new HttpError(400, "Choose at least one person to split with");
    if (participants.some((u) => !members.includes(u))) throw new HttpError(400, "Everyone in the split must be in the trip");
    const parts = splitEqual(amountBase, participants.length);
    splits = participants.map((user, i) => ({ user, share: parts[i] }));
  }

  const date = body.date ? new Date(body.date) : new Date();
  const expense = await Expense.create({
    trip: trip._id,
    kind: "expense",
    description,
    category,
    amount,
    currency,
    rate,
    amountBase,
    paidBy,
    splits,
    date: Number.isNaN(date.getTime()) ? new Date() : date,
    createdBy: req.user._id,
  });
  notify(req);
  res.status(201).json({ expense: serializeExpense(expense) });
});

// Record a payment between two members: { from, to, amount } (amount in trip currency minor units)
router.post("/settlements", async (req, res) => {
  const members = memberIds(req.trip);
  const from = String(req.body?.from || "");
  const to = String(req.body?.to || "");
  const amount = Math.round(Number(req.body?.amount));
  if (!members.includes(from) || !members.includes(to) || from === to) throw new HttpError(400, "Invalid people for this payment");
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, "Invalid amount");
  const me = req.user._id.toString();
  if (me !== from && me !== to && !req.trip.isOwner(me)) {
    throw new HttpError(403, "Only the payer, the receiver or the trip owner can record this");
  }
  const expense = await Expense.create({
    trip: req.trip._id,
    kind: "settlement",
    description: "Settle-up payment",
    category: "other",
    amount,
    currency: req.trip.currency,
    rate: 1,
    amountBase: amount,
    paidBy: from,
    splits: [{ user: to, share: amount }],
    createdBy: req.user._id,
  });
  notify(req);
  res.status(201).json({ expense: serializeExpense(expense) });
});

router.delete("/:expenseId", async (req, res) => {
  const { expenseId } = req.params;
  if (!mongoose.isValidObjectId(expenseId)) throw new HttpError(404, "Expense not found");
  const expense = await Expense.findOne({ _id: expenseId, trip: req.trip._id });
  if (!expense) throw new HttpError(404, "Expense not found");
  if (expense.createdBy.toString() !== req.user._id.toString() && !req.trip.isOwner(req.user._id)) {
    throw new HttpError(403, "Only the person who added it or the trip owner can delete this");
  }
  await expense.deleteOne();
  notify(req);
  res.json({ ok: true });
});

export default router;
