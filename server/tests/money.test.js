import { test } from "node:test";
import assert from "node:assert/strict";
import { splitEqual, allocate, toMinor } from "../src/utils/money.js";
import { computeBalances, simplifyDebts } from "../src/utils/settle.js";

test("toMinor converts rupees to paise without float bugs", () => {
  assert.equal(toMinor("24.50"), 2450);
  assert.equal(toMinor(0.1 + 0.2), 30);
  assert.equal(toMinor("-5"), null);
  assert.equal(toMinor("abc"), null);
});

test("splitEqual always adds up to the total", () => {
  assert.deepEqual(splitEqual(1000, 3), [334, 333, 333]);
  for (let n = 1; n <= 30; n++) {
    const parts = splitEqual(99999, n);
    assert.equal(parts.reduce((a, b) => a + b, 0), 99999);
  }
});

test("allocate keeps the exact total", () => {
  const parts = allocate(10000, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
});

test("balances and settle-up for a simple trip", () => {
  // A paid 300 for A, B, C. B paid 150 for B, C.
  const expenses = [
    { paidBy: "A", amountBase: 300, splits: [{ user: "A", share: 100 }, { user: "B", share: 100 }, { user: "C", share: 100 }] },
    { paidBy: "B", amountBase: 150, splits: [{ user: "B", share: 75 }, { user: "C", share: 75 }] },
  ];
  const bal = computeBalances(["A", "B", "C"], expenses);
  assert.deepEqual(bal, { A: 200, B: -25, C: -175 });
  const payments = simplifyDebts(bal);
  assert.deepEqual(payments, [
    { from: "C", to: "A", amount: 175 },
    { from: "B", to: "A", amount: 25 },
  ]);
});

test("settlement payments clear balances", () => {
  const expenses = [
    { paidBy: "A", amountBase: 200, splits: [{ user: "A", share: 100 }, { user: "B", share: 100 }] },
    { paidBy: "B", amountBase: 100, splits: [{ user: "A", share: 100 }] }, // B paid A back
  ];
  const bal = computeBalances(["A", "B"], expenses);
  assert.deepEqual(bal, { A: 0, B: 0 });
  assert.deepEqual(simplifyDebts(bal), []);
});

test("simplified payments always settle everyone to zero", () => {
  const users = Array.from({ length: 12 }, (_, i) => `U${i}`);
  const expenses = [];
  for (let k = 0; k < 40; k++) {
    const payer = users[k % users.length];
    const amount = 1000 + k * 137;
    const group = users.filter((_, i) => (i + k) % 3 !== 0);
    const shares = splitEqual(amount, group.length);
    expenses.push({ paidBy: payer, amountBase: amount, splits: group.map((u, i) => ({ user: u, share: shares[i] })) });
  }
  const bal = computeBalances(users, expenses);
  const payments = simplifyDebts(bal);
  assert.ok(payments.length <= users.length - 1);
  for (const p of payments) {
    bal[p.from] += p.amount;
    bal[p.to] -= p.amount;
  }
  assert.ok(Object.values(bal).every((v) => v === 0));
});
