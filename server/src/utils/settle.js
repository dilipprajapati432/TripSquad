/**
 * Compute each member's balance in the trip currency.
 * balance > 0  -> the group owes them money
 * balance < 0  -> they owe the group money
 *
 * Every expense: payer gets +amount, every person in the split gets -share.
 * Settlements are stored the same way (payer = person paying back, split = receiver),
 * so they cancel out debts automatically.
 */
export function computeBalances(memberIds, expenses) {
  const balances = Object.fromEntries(memberIds.map((id) => [String(id), 0]));
  for (const e of expenses) {
    const payer = String(e.paidBy);
    balances[payer] = (balances[payer] || 0) + e.amountBase;
    for (const s of e.splits) {
      const u = String(s.user);
      balances[u] = (balances[u] || 0) - s.share;
    }
  }
  return balances;
}

/**
 * Debt simplification: turn balances into the fewest practical payments.
 * Greedy approach: repeatedly match the person who owes the most with the
 * person who is owed the most. Produces at most (n - 1) payments.
 * Returns [{ from, to, amount }] with amount in minor units.
 */
export function simplifyDebts(balances) {
  const debtors = [];
  const creditors = [];
  for (const [user, bal] of Object.entries(balances)) {
    if (bal < 0) debtors.push({ user, amount: -bal });
    else if (bal > 0) creditors.push({ user, amount: bal });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) payments.push({ from: debtors[i].user, to: creditors[j].user, amount: pay });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return payments;
}

/** How many payments would happen without simplification (every debt paid to its payer directly). */
export function naivePaymentCount(expenses) {
  const pairs = new Set();
  for (const e of expenses) {
    for (const s of e.splits) {
      if (String(s.user) !== String(e.paidBy) && s.share > 0) pairs.add(`${s.user}->${e.paidBy}`);
    }
  }
  return pairs.size;
}
