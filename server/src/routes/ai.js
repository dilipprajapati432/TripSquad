import { Router } from "express";
import { HttpError } from "../middleware/errors.js";
import { aiAvailable, generatePlan } from "../services/ai.js";
import { searchPhoton, searchPlaces } from "../services/geocode.js";
import { str } from "../utils/input.js";

// Mounted at /api/trips/:tripId/ai (loadTrip already ran)
const router = Router({ mergeParams: true });

const GEO_BUDGET_MS = 70_000; // stop looking up places after this; the rest can be found by hand
const MAX_KM = 600; // a match further than this from the trip is probably a different place with the same name

function km(a, b) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Finds an AI-suggested place on the map.
 * 1. By name, only within ~300 km of the trip: multi-town trips (Rishikesh, Mussoorie... on a
 *    "Kedarnath" trip) would fail if we always added the destination town to the search.
 * 2. Otherwise "name, region" (the destination without its first part, e.g. "Uttarakhand, India"),
 *    rejecting matches far from the trip.
 */
async function locateOnce(name, { near, destination, nearOnly = false }) {
  if (near) {
    const hits = await searchPlaces(name, { near, bounded: true, radius: 3, limit: 3 });
    if (hits.length) return hits.reduce((best, h) => (km(h, near) < km(best, near) ? h : best));
  }
  if (!nearOnly || !near) {
    const parts = destination.split(",").map((s) => s.trim()).filter(Boolean);
    const region = parts.length > 1 ? parts.slice(1).join(", ") : parts[0] || "";
    const hits = await searchPlaces(region ? `${name}, ${region}` : name, { near, limit: 3 });
    const hit = hits.find((h) => !near || km(h, near) <= MAX_KM);
    if (hit) return hit;
  }
  // Last try: Photon forgives spelling differences ("Daksheshwar" → "Daksheswar"), only around the trip
  const fuzzy = await searchPhoton(name, near ? { near, bounded: true, radius: 3, limit: 3 } : { limit: 3 });
  return fuzzy[0] || null;
}

/**
 * Simpler versions of an AI place name, for when the full one isn't on the map:
 * "Bheem Tal (Lake)" → "Bheem Tal"; "Chorabari Glacier (Kedarnath Glacier)" → also "Kedarnath Glacier";
 * "Vishwanath Temple, Guptkashi" → "Vishwanath Temple".
 */
export function nameVariants(name) {
  const plain = name.replace(/\s*\([^)]*\)/g, "").trim();
  const inBrackets = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim())
    .filter((t) => t.split(/\s+/).length > 1 || /^[A-Z]/.test(t)) // skip "(lake)", "(restaurant)"
    .filter((t) => !/^(lake|restaurant|dhaba|temple|cafe|café|trek|village|market)$/i.test(t));
  const beforeComma = plain.split(",")[0].trim();
  return [...new Set([name.trim(), plain, beforeComma, ...inBrackets])].filter((v) => v.length >= 3);
}

/** Tries the name and its simpler versions; retries once if the map search itself fails (timeout, busy). */
async function locate(name, opts, deadline) {
  const variants = nameVariants(name);
  for (const [i, v] of variants.entries()) {
    if (Date.now() > deadline) return null;
    // The full name gets both searches (near the trip, then the region); simpler versions only the nearby one
    const search = i === 0 ? () => locateOnce(v, opts) : () => locateOnce(v, { ...opts, nearOnly: true });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const hit = await search();
        if (hit) return hit;
        break;
      } catch (err) {
        console.warn(`Map search failed for "${v}" (try ${attempt}): ${err.message}`);
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return null;
}

/**
 * Generate an itinerary with AI, then find each suggested place on the real map.
 * Places the map can't find are marked found:false instead of being placed at a wrong spot —
 * AI sometimes invents places, so we never trust its output blindly.
 * Nothing is saved here: the user reviews the plan first and adds it with /places/bulk.
 */
router.post("/plan", async (req, res) => {
  if (!aiAvailable()) throw new HttpError(503, "AI planner is off. Add GEMINI_API_KEY or GROQ_API_KEY to server/.env");
  const request = str(req.body?.request).trim().slice(0, 500);
  if (request.length < 5) throw new HttpError(400, "Tell the AI a bit about your trip (e.g. beaches, food, budget)");

  const trip = req.trip;
  let days;
  try {
    days = await generatePlan({
      destination: trip.destination,
      days: Math.min(trip.dayCount(), 10),
      request,
      members: trip.members.length,
    });
  } catch (err) {
    console.error("AI plan error:", err.message);
    throw new HttpError(502, err.message.startsWith("The AI") ? err.message : "The AI service didn't respond. Please try again.");
  }

  const near = trip.center?.lat != null ? { lat: trip.center.lat, lng: trip.center.lng } : undefined;
  const total = days.reduce((n, d) => n + d.places.length, 0);
  if (total > 25) days = days.map((d) => ({ ...d, places: d.places.slice(0, 3) }));

  const started = Date.now();
  const deadline = started + GEO_BUDGET_MS;
  let found = 0, count = 0;
  for (const d of days) {
    for (const p of d.places) {
      count++;
      p.found = false;
      const hit = await locate(p.name, { near, destination: trip.destination }, deadline);
      if (hit) {
        Object.assign(p, { found: true, lat: hit.lat, lng: hit.lng, address: hit.address });
        found++;
      } // otherwise the user can still pick it with "Find on map"
    }
  }
  const late = Date.now() > deadline ? " (stopped early: time limit)" : "";
  console.log(`AI plan: found ${found} of ${count} places on the map in ${Math.round((Date.now() - started) / 1000)}s${late}`);
  res.json({ days });
});

export default router;
