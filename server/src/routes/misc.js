import { Router } from "express";
import { HttpError } from "../middleware/errors.js";
import { CURRENCIES } from "../utils/money.js";
import { CATEGORIES } from "./expenses.js";
import { searchPlaces } from "../services/geocode.js";
import { getRate } from "../services/fx.js";
import { aiAvailable } from "../services/ai.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/meta", (_req, res) => {
  res.json({ currencies: CURRENCIES, categories: CATEGORIES, aiEnabled: aiAvailable(), maxMembers: env.maxMembers });
});

// Place search for the "Add place" box: /api/geo/search?q=baga beach&lat=15.5&lng=73.8
router.get("/geo/search", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && req.query.lat !== undefined ? { lat, lng } : undefined;
  try {
    res.json({ results: await searchPlaces(req.query.q, { near }) });
  } catch {
    throw new HttpError(502, "Place search is busy right now. Try again in a moment.");
  }
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
