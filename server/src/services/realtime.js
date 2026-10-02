// Small helper so routes can broadcast without importing Socket.io everywhere.

let io = null;

export function setIO(instance) {
  io = instance;
}

export const roomFor = (tripId) => `trip:${tripId}`;
export const userRoom = (userId) => `user:${userId}`;

/** Send an event to everyone viewing this trip. */
export function emitToTrip(tripId, event, payload) {
  if (io) io.to(roomFor(tripId)).emit(event, payload);
}

/** Send an event to all open tabs of specific users (used for private messages). */
export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  io.to(userIds.map((id) => userRoom(String(id)))).emit(event, payload);
}

// Room bookkeeping (presence, live location) lives in socket.js, which registers these.
let control = { kickUser() {}, closeTrip() {} };
export function setRoomControl(c) {
  control = c;
}

/** Take a user out of a trip right away: their tabs leave the room, stop sharing location and get told. */
export function kickFromTrip(tripId, userId, by) {
  control.kickUser(tripId, userId, by);
}

/** Everyone leaves the trip room (the trip was deleted). */
export function closeTripRoom(tripId) {
  control.closeTrip(tripId);
}
