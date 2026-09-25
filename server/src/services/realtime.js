// Small helper so routes can broadcast to everyone in a trip without importing Socket.io.

let io = null;

export function setIO(instance) {
  io = instance;
}

export function roomFor(tripId) {
  return `trip:${tripId}`;
}

/** Send an event to everyone viewing this trip. */
export function emitToTrip(tripId, event, payload) {
  if (io) io.to(roomFor(tripId)).emit(event, payload);
}

/** Remove a user's open connections from a trip room (e.g. after they are removed from the trip). */
export async function kickFromTrip(tripId, userId) {
  if (!io) return;
  const sockets = await io.in(roomFor(tripId)).fetchSockets();
  for (const s of sockets) {
    if (s.data.userId === String(userId)) {
      s.leave(roomFor(tripId));
      s.emit("trip:removed", { tripId: String(tripId) });
    }
  }
}
