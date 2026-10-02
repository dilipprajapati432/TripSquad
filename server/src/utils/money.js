// All money is stored as INTEGER minor units (paise, cents, fils).
// ₹24.50 -> 2450. Never store money as floating point numbers.

export const CURRENCIES = ["INR", "AED", "EUR", "USD", "GBP", "THB", "SGD", "CHF", "AUD", "CAD"];

/** Convert a user-entered amount like "24.5" to minor units (2450). Returns null if invalid. */
export function toMinor(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const minor = Math.round(n * 100);
  return minor > MAX_MINOR ? null : minor;
}

/** Biggest amount we accept anywhere: 10 crore / 100 million in minor units. Keeps all sums exact. */
export const MAX_MINOR = 100_000_000_00;

/** Split `total` minor units equally among `n` people. The leftover paise go to the first people. */
export function splitEqual(total, n) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  return Array.from({ length: n }, () => base + (remainder-- > 0 ? 1 : 0));
}

/**
 * Split `total` proportionally to `weights` so the parts always add up exactly to `total`
 * (largest remainder method). Used when converting custom shares into the trip currency.
 */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && left > 0; k++, left--) parts[order[k].i] += 1;
  return parts;
}

/** Convert minor units from one currency to another using `rate` (1 unit of FROM = rate units of TO). */
export function convert(amountMinor, rate) {
  return Math.round(amountMinor * rate);
}

/** "₹2,400.00" style text for chat/activity messages. */
export function formatMoney(minor, currency) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}
