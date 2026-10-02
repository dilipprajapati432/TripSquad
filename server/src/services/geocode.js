import { env } from "../config/env.js";
import { setBounded } from "../utils/cache.js";

// Free geocoding with OpenStreetMap Nominatim.
// Their usage policy: max 1 request per second, and a real User-Agent. We queue
// requests to respect that, and cache results so repeated searches are instant.
// https://operations.osmfoundation.org/policies/nominatim/

const cache = new Map(); // query -> { at, results }
const CACHE_MS = 24 * 60 * 60 * 1000;
let queue = Promise.resolve();
let lastCall = 0;

let pending = 0;
const MAX_PENDING = 25; // ~30 s of waiting at most; beyond that, fail fast instead of piling up

function throttle(fn) {
  if (pending >= MAX_PENDING) return Promise.reject(new Error("Place search is busy. Try again in a moment."));
  pending++;
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run.finally(() => pending--);
}

/**
 * Search places by text. `near` ({lat,lng}) biases results towards the trip destination.
 * Returns [{ name, address, lat, lng }]
 */
export async function searchPlaces(query, { near, limit = 6 } = {}) {
  const q = String(query || "").trim().slice(0, 200);
  if (q.length < 2) return [];
  const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  const params = new URLSearchParams({ q, format: "jsonv2", limit: String(limit), addressdetails: "0" });
  if (near) {
    const d = 1.5; // ~150 km box around the destination (a preference, not a hard filter)
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }

  const results = await throttle(async () => {
    const res = await fetch(`${env.geocoderUrl}/search?${params}`, {
      headers: { "User-Agent": `TripSquad/1.0 (${env.contactEmail})`, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const data = await res.json();
    return data.map((r) => ({
      name: r.name || r.display_name.split(",")[0],
      address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  });

  setBounded(cache, key, { at: Date.now(), results });
  return results;
}
