import { Router } from "express";
import { Trip } from "../models/Trip.js";
import { HttpError } from "../middleware/errors.js";
import { updateWithRetry } from "../utils/retry.js";
import { serializePlaces } from "../utils/serialize.js";
import { emitToTrip } from "../services/realtime.js";
import { announce } from "../services/activity.js";
import { ensurePlacePhotos } from "../services/tripPhotos.js";
import { str } from "../utils/input.js";

// Mounted at /api/trips/:tripId/places (loadTrip already ran)
const router = Router({ mergeParams: true });
const MAX_PLACES = 150;

function cleanPlace(body, trip, userId, source = "manual") {
  const name = str(body?.name).trim().slice(0, 120);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const day = Math.round(Number(body?.day ?? 0));
  if (!name) throw new HttpError(400, "Place needs a name");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, "Place needs a valid location");
  }
  if (!Number.isFinite(day) || day < 0 || day > trip.dayCount()) throw new HttpError(400, "Invalid day");
  return {
    name,
    lat,
    lng,
    day,
    address: str(body?.address).slice(0, 300),
    note: str(body?.note).slice(0, 500),
    addedBy: userId,
    source,
  };
}

const nextOrder = (trip, day) =>
  trip.places.filter((p) => p.day === day).reduce((max, p) => Math.max(max, p.order + 1), 0);

/** Save, then tell everyone in the trip about the new list of places. */
async function change(req, res, mutate) {
  const trip = await updateWithRetry(Trip, req.trip._id, mutate);
  if (!trip) throw new HttpError(404, "Trip not found");
  ensurePlacePhotos(trip); // thumbnails for new places arrive a moment later
  const places = serializePlaces(trip);
  emitToTrip(trip._id.toString(), "places:updated", { places, by: req.user._id.toString() });
  res.json({ places });
}

router.post("/", async (req, res) => {
  await change(req, res, (trip) => {
    if (trip.places.length >= MAX_PLACES) throw new HttpError(400, `A trip can have at most ${MAX_PLACES} places`);
    const place = cleanPlace(req.body, trip, req.user._id);
    trip.places.push({ ...place, order: nextOrder(trip, place.day) });
  });
  const where = Number(req.body?.day) > 0 ? `Day ${Number(req.body.day)}` : "Ideas";
  announce(req.trip._id, req.user._id, `${req.user.name} added ${str(req.body?.name, "a place").slice(0, 60)} to ${where}`, { icon: "place", chat: false });
});

// Add many places at once (used by the AI planner)
router.post("/bulk", async (req, res) => {
  const list = Array.isArray(req.body?.places) ? req.body.places.slice(0, 40) : [];
  if (!list.length) throw new HttpError(400, "No places to add");
  await change(req, res, (trip) => {
    if (trip.places.length + list.length > MAX_PLACES) throw new HttpError(400, `A trip can have at most ${MAX_PLACES} places`);
    for (const item of list) {
      const place = cleanPlace(item, trip, req.user._id, "ai");
      trip.places.push({ ...place, order: nextOrder(trip, place.day) });
    }
  });
  await announce(req.trip._id, req.user._id, `${req.user.name} added ${list.length} AI-suggested place${list.length > 1 ? "s" : ""} to the plan`, { icon: "ai" });
});

// Reorder places inside a day, or move places into a day: { day, ids: [placeId, ...] in the new order }
router.put("/reorder", async (req, res) => {
  const day = Math.round(Number(req.body?.day));
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  await change(req, res, (trip) => {
    if (!Number.isFinite(day) || day < 0 || day > trip.dayCount()) throw new HttpError(400, "Invalid day");
    ids.forEach((id, index) => {
      const place = trip.places.id(id);
      if (place) {
        place.day = day;
        place.order = index;
      }
    });
  });
});

router.patch("/:placeId", async (req, res) => {
  await change(req, res, (trip) => {
    const place = trip.places.id(req.params.placeId);
    if (!place) throw new HttpError(404, "This place was already removed");
    if (req.body?.name !== undefined) {
      const name = str(req.body.name).trim().slice(0, 120);
      if (!name) throw new HttpError(400, "Place needs a name");
      place.name = name;
    }
    if (req.body?.note !== undefined) place.note = str(req.body.note).slice(0, 500);
    if (req.body?.day !== undefined) {
      const day = Math.round(Number(req.body.day));
      if (!Number.isFinite(day) || day < 0 || day > trip.dayCount()) throw new HttpError(400, "Invalid day");
      if (day !== place.day) {
        place.order = nextOrder(trip, day);
        place.day = day;
      }
    }
  });
});

router.delete("/:placeId", async (req, res) => {
  await change(req, res, (trip) => {
    const place = trip.places.id(req.params.placeId);
    if (place) place.deleteOne();
  });
});

export default router;
