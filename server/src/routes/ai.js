import { Router } from "express";
import { HttpError } from "../middleware/errors.js";
import { aiAvailable, generatePlan } from "../services/ai.js";
import { searchPlaces } from "../services/geocode.js";

// Mounted at /api/trips/:tripId/ai (loadTrip already ran)
const router = Router({ mergeParams: true });

/**
 * Generate an itinerary with AI, then find each suggested place on the real map.
 * Places the map can't find are marked found:false instead of being placed at a wrong spot —
 * AI sometimes invents places, so we never trust its output blindly.
 * Nothing is saved here: the user reviews the plan first and adds it with /places/bulk.
 */
router.post("/plan", async (req, res) => {
  if (!aiAvailable()) throw new HttpError(503, "AI planner is off. Add GEMINI_API_KEY or GROQ_API_KEY to server/.env");
  const request = String(req.body?.request || "").trim().slice(0, 500);
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

  for (const d of days) {
    for (const p of d.places) {
      try {
        const [hit] = await searchPlaces(`${p.name}, ${trip.destination}`, { near, limit: 1 });
        Object.assign(p, hit ? { found: true, lat: hit.lat, lng: hit.lng, address: hit.address } : { found: false });
      } catch {
        p.found = false;
      }
    }
  }
  res.json({ days });
});

export default router;
