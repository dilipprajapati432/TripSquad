// Exchange rates from a free, no-key API (open.er-api.com), cached for 6 hours.
// The rate is SAVED on each expense, so old expenses never change when rates move.

import { env } from "../config/env.js";

const cache = new Map(); // base -> { at, rates }
const CACHE_MS = 6 * 60 * 60 * 1000;

async function ratesFor(base) {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rates;
  const res = await fetch(`${env.fxApiUrl}/${base}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Exchange rate service error (${res.status})`);
  const data = await res.json();
  if (data.result !== "success") throw new Error("Exchange rate service error");
  cache.set(base, { at: Date.now(), rates: data.rates });
  return data.rates;
}

/** How many units of `to` you get for 1 unit of `from`. */
export async function getRate(from, to) {
  if (from === to) return 1;
  const rates = await ratesFor(from);
  const rate = rates[to];
  if (!rate) throw new Error(`No exchange rate for ${from} → ${to}`);
  return rate;
}
