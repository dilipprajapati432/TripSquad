import { env } from "../config/env.js";
import { setBounded } from "../utils/cache.js";

// Free geocoding with OpenStreetMap Nominatim, plus Photon (same OpenStreetMap data, but it
// forgives spelling differences: "Daksheshwar" still finds "Daksheswar") as a second try.
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
 * Search places by text. `near` ({lat,lng}) biases results towards the trip destination;
 * with `bounded` only places inside the box (`radius` degrees around `near`) are returned.
 * Returns [{ name, address, lat, lng }]
 */
export async function searchPlaces(query, { near, limit = 6, bounded = false, radius = 1.5 } = {}) {
  const q = String(query || "").trim().slice(0, 200);
  if (q.length < 2) return [];
  const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}|${limit}|${bounded ? radius : ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  const params = new URLSearchParams({ q, format: "jsonv2", limit: String(limit), addressdetails: "0" });
  if (near) {
    const d = radius; // 1.5 ≈ 150 km box around the destination (a preference, unless bounded)
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    if (bounded) params.set("bounded", "1");
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

// ----- Photon (https://github.com/komoot/photon) -----
// The public server is free "as long as the number of requests stay in a reasonable limit":
// one request at a time, at most ~2 per second, and results are cached.
let photonQueue = Promise.resolve();
let photonLast = 0;

const KM = (a, b) => {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export { KM as distanceKm };

/**
 * Typo-tolerant place search. `near` prefers places close to the trip; with `bounded` only places
 * within `radius` degrees are returned; `maxKm` drops matches further away (a fuzzy search can
 * match a similar-sounding place in another country). Returns [{ name, address, lat, lng }].
 */
export async function searchPhoton(query, { near, limit = 6, bounded = false, radius = 3, maxKm } = {}) {
  if (!env.photonUrl) return [];
  const q = String(query || "").trim().slice(0, 200);
  if (q.length < 3) return [];
  const key = `photon|${q.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}|${limit}|${bounded ? radius : ""}|${maxKm || ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

  const params = new URLSearchParams({ q, limit: String(limit), lang: "en" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
    if (bounded) params.set("bbox", [near.lng - radius, near.lat - radius, near.lng + radius, near.lat + radius].join(","));
  }
  const run = photonQueue.then(async () => {
    const wait = Math.max(0, photonLast + 500 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    photonLast = Date.now();
    const res = await fetch(`${env.photonUrl}/api?${params}`, {
      headers: { "User-Agent": `TripSquad/1.0 (${env.contactEmail})` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Photon search failed (${res.status})`);
    return res.json();
  });
  photonQueue = run.catch(() => {});
  const data = await run;

  let results = (data.features || [])
    .filter((f) => Array.isArray(f.geometry?.coordinates))
    .map((f) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry.coordinates.map(Number);
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(" ") || p.city || "";
      const parts = [name, p.street && p.street !== name ? p.street : "", p.district, p.city !== name ? p.city : "", p.county, p.state, p.country];
      return { name, address: [...new Set(parts.filter(Boolean))].join(", "), lat, lng };
    })
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (near && maxKm) results = results.filter((r) => KM(r, near) <= maxKm);

  setBounded(cache, key, { at: Date.now(), results });
  return results;
}
