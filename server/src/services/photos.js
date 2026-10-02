import { env } from "../config/env.js";
import { setBounded } from "../utils/cache.js";

// Free photos for destinations and places from Wikimedia projects (no API key needed).
// Wikivoyage articles have wide travel banners; Wikipedia covers individual attractions.
// Uses the MediaWiki search + PageImages API and keeps results in memory.
// https://www.mediawiki.org/wiki/API:Search , https://www.mediawiki.org/wiki/Extension:PageImages

const cache = new Map(); // key -> { at, photo }
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

// Lead images of place articles are often maps, flags or seals — skip those.
const NOT_A_PHOTO = /(map|locator|location|flag|logo|seal|coat[_ ]of[_ ]arms|emblem|icon|symbol|banner_?test|montage_placeholder)/i;
const IS_PHOTO_FILE = /\.(jpe?g|webp)$/i;

const words = (s) => String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

/** The article title must share a word with what we searched for, so "Baga Beach" never gets a random photo. */
function relevant(title, query) {
  const t = new Set(words(title));
  return words(query).some((w) => t.has(w));
}

/** Photos (best match first) from one MediaWiki site. */
async function searchSite(apiUrl, query, size, match, limit = 1) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(Math.max(5, limit * 2)),
    gsrnamespace: "0",
    prop: "pageimages",
    piprop: "thumbnail|name",
    pithumbsize: String(size),
    redirects: "1",
  });
  const res = await fetch(`${apiUrl}?${params}`, {
    headers: { "User-Agent": `TripSquad/1.0 (${env.contactEmail})` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Photo search failed (${res.status})`);
  const data = await res.json();
  const pages = [...(data.query?.pages || [])].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const origin = new URL(apiUrl).origin;
  const found = [];
  for (const p of pages) {
    const file = p.pageimage || "";
    if (!p.thumbnail?.source || !IS_PHOTO_FILE.test(file) || NOT_A_PHOTO.test(file)) continue;
    if (!relevant(p.title, match)) continue;
    found.push({
      url: p.thumbnail.source,
      page: `${origin}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      credit: origin.includes("wikivoyage") ? "Wikivoyage" : "Wikipedia",
      title: p.title,
    });
    if (found.length >= limit) break;
  }
  return found;
}

/**
 * Finds a photo for a search text. `match`: words the article title must share (defaults to the query).
 * Returns { url, page, credit } or null.
 * Throws only on network errors, so callers can try again later.
 */
export async function findPhoto(query, { kind = "destination", match = query } = {}) {
  const q = String(query || "").trim().slice(0, 150);
  if (q.length < 2) return null;
  const key = `${kind}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.photo;

  const sites = kind === "destination" ? [env.wikivoyageApi, env.wikipediaApi] : [env.wikipediaApi];
  const size = kind === "destination" ? 1600 : 400;
  let photo = null;
  for (const site of sites) {
    [photo = null] = await searchSite(site, q, size, match);
    if (photo) break;
  }
  setBounded(cache, key, { at: Date.now(), photo });
  return photo;
}

/**
 * Several candidate cover photos for a destination (for "Change cover"), from both sites,
 * without duplicates. Cached like findPhoto. Throws on network errors.
 */
export async function suggestPhotos(query, { limit = 8 } = {}) {
  const q = String(query || "").trim().slice(0, 150);
  if (q.length < 2) return [];
  const key = `suggest|${q.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.photo;
  const results = await Promise.all([env.wikivoyageApi, env.wikipediaApi].map((site) => searchSite(site, q, 1600, q, limit).catch(() => [])));
  const seen = new Set();
  const photos = results.flat().filter((p) => !seen.has(p.url) && seen.add(p.url)).slice(0, limit);
  setBounded(cache, key, { at: Date.now(), photo: photos });
  return photos;
}

/** Like findPhoto, but never throws (returns undefined on network errors). */
export async function tryFindPhoto(query, opts) {
  try {
    return await findPhoto(query, opts);
  } catch (err) {
    console.warn("photo lookup failed:", err.message);
    return undefined;
  }
}
