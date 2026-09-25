// Live locations are kept ONLY in memory, never saved to the database.
// Privacy by design: when someone stops sharing (or goes quiet for 10 minutes), it's gone.

const STALE_MS = 10 * 60 * 1000;
const locations = new Map(); // tripId -> Map(userId -> { lat, lng, accuracy, ts })

export function setLocation(tripId, userId, loc) {
  if (!locations.has(tripId)) locations.set(tripId, new Map());
  locations.get(tripId).set(userId, loc);
}

export function clearLocation(tripId, userId) {
  locations.get(tripId)?.delete(userId);
}

export function getLocations(tripId) {
  const trip = locations.get(tripId);
  if (!trip) return [];
  const now = Date.now();
  const out = [];
  for (const [userId, loc] of trip) {
    if (now - loc.ts > STALE_MS) trip.delete(userId);
    else out.push({ userId, ...loc });
  }
  return out;
}
