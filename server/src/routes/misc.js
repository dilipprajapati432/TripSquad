import { Router } from "express";
import { HttpError } from "../middleware/errors.js";
import { CURRENCIES } from "../utils/money.js";
import { CATEGORIES } from "./expenses.js";
import { searchPhoton, searchPlaces } from "../services/geocode.js";
import { getRate } from "../services/fx.js";
import { aiAvailable } from "../services/ai.js";
import { env } from "../config/env.js";
import { FOOD_OPTIONS } from "../models/User.js";

const router = Router();

router.get("/meta", (_req, res) => {
  res.json({ currencies: CURRENCIES, categories: CATEGORIES, aiEnabled: aiAvailable(), maxMembers: env.maxMembers, foodOptions: FOOD_OPTIONS.filter(Boolean) });
});

/**
 * Shorter versions of what someone typed, for when the full text finds nothing. OpenStreetMap
 * search needs every word to match, so one unknown part of a long address ("…, niranjani akhada, …") fails it.
 * "Maa Mansa Devi Temple, niranjani akhada, Haridwar" → "Maa Mansa Devi Temple" → "Mansa Devi Temple"
 */
export function shorterQueries(q) {
  const text = String(q || "").replace(/\s+/g, " ").trim();
  const first = text.split(",")[0].trim();
  const noTitle = first.replace(/^(maa|ma|shri|sri|shree|sree|the|old|new)\s+/i, "").trim();
  return [...new Set([first, noTitle])].filter((v) => v.length >= 3 && v.toLowerCase() !== text.toLowerCase()).slice(0, 2);
}

/** Photon as a second try; its errors never break the search (Nominatim's answer stands). */
async function photonTry(query, near) {
  try {
    return await searchPhoton(query, { near, maxKm: near ? 600 : undefined });
  } catch (err) {
    console.warn(`Photon search failed for "${query}": ${err.message}`);
    return [];
  }
}

// Place search for the "Add place" box: /api/geo/search?q=baga beach&lat=15.5&lng=73.8
// Order: OpenStreetMap search → Photon (forgives spelling differences) → the same with a shorter
// version of the text. When a shorter version was used, it says which one (usedQuery).
router.get("/geo/search", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && req.query.lat !== undefined ? { lat, lng } : undefined;
  const q = String(req.query.q || "");
  let results = [];
  let failed = false;
  for (const [i, text] of [q, ...shorterQueries(q)].entries()) {
    try {
      results = await searchPlaces(text, { near });
    } catch {
      failed = true; // Nominatim busy: Photon can still answer
    }
    if (!results.length) results = await photonTry(text, near);
    if (results.length) return res.json({ results, ...(i > 0 && { usedQuery: text }) });
  }
  if (failed) throw new HttpError(502, "Place search is busy right now. Try again in a moment.");
  res.json({ results: [] });
});

// /api/fx?from=AED&to=INR
router.get("/fx", async (req, res) => {
  const from = String(req.query.from || "").toUpperCase();
  const to = String(req.query.to || "").toUpperCase();
  if (!CURRENCIES.includes(from) || !CURRENCIES.includes(to)) throw new HttpError(400, "Unsupported currency");
  try {
    res.json({ from, to, rate: await getRate(from, to) });
  } catch {
    throw new HttpError(502, "Couldn't fetch the exchange rate right now");
  }
});

export default router;
