import { Trip } from "../models/Trip.js";
import { updateWithRetry } from "../utils/retry.js";
import { serializeCover, serializePlaces } from "../utils/serialize.js";
import { emitToTrip } from "./realtime.js";
import { tryFindPhoto } from "./photos.js";

// Fills in trip cover photos and place thumbnails in the background, then tells
// everyone in the trip. Nothing here blocks a request or fails it.

const running = new Set();
const MAX_PLACES_PER_RUN = 12;

function once(key, job) {
  if (running.has(key)) return;
  running.add(key);
  job()
    .catch((err) => console.warn(`${key} failed:`, err.message))
    .finally(() => running.delete(key));
}

/** Cover for a destination: { url, page, credit, checkedAt }, { checkedAt } if none exists, or null on network errors. */
export async function lookupCover(destination, { waitMs = 4000 } = {}) {
  // Don't make "Create trip" slow if Wikimedia is: give up after a few seconds, ensureCover retries later.
  const timeout = new Promise((r) => setTimeout(() => r(undefined), waitMs));
  const photo = await Promise.race([tryFindPhoto(destination, { kind: "destination" }), timeout]);
  if (photo === undefined) return null;
  return { ...(photo || {}), checkedAt: new Date() };
}

/** For trips created before cover photos existed (or when the lookup failed last time). */
export function ensureCover(trip) {
  if (trip.cover?.checkedAt) return;
  const id = String(trip._id);
  once(`cover:${id}`, async () => {
    const cover = await lookupCover(trip.destination);
    if (!cover) return;
    const saved = await updateWithRetry(Trip, id, (t) => {
      // Only fill in a missing cover: the owner may have picked or uploaded one meanwhile
      if (t.destination === trip.destination && !t.cover?.checkedAt) t.cover = cover;
    });
    if (saved) emitToTrip(id, "trip:cover", { tripId: id, cover: serializeCover(saved) });
  });
}

/** Look up thumbnails for places that don't have one yet ("Baga Beach" + "Goa"). */
export function ensurePlacePhotos(trip) {
  const todo = trip.places.filter((p) => !p.photoCheckedAt).slice(0, MAX_PLACES_PER_RUN);
  if (!todo.length) return;
  const id = String(trip._id);
  const area = trip.destination.split(",")[0].trim();
  once(`places:${id}`, async () => {
    const found = {};
    for (const p of todo) {
      const photo = await tryFindPhoto(`${p.name} ${area}`, { kind: "place", match: p.name });
      if (photo !== undefined) found[p._id] = { url: photo?.url || "", name: p.name };
    }
    if (!Object.keys(found).length) return;
    const saved = await updateWithRetry(Trip, id, (t) => {
      for (const p of t.places) {
        // Skip places renamed while we were searching (the photo was for the old name)
        if (p._id in found && found[p._id].name === p.name) {
          p.photo = found[p._id].url;
          p.photoCheckedAt = new Date();
        }
      }
    });
    if (saved) {
      emitToTrip(id, "places:updated", { places: serializePlaces(saved), by: null });
      // More than one batch: run again once this job has finished
      if (saved.places.some((p) => !p.photoCheckedAt)) setTimeout(() => ensurePlacePhotos(saved), 0);
    }
  });
}
