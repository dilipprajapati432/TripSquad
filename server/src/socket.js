import mongoose from "mongoose";
import { Server } from "socket.io";
import { Trip } from "./models/Trip.js";
import { verifyToken } from "./middleware/auth.js";
import { setIO, roomFor } from "./services/realtime.js";
import { setLocation, clearLocation, getLocations } from "./services/location.js";

// tripId -> Map(userId -> number of open tabs). Used for "who's online".
const online = new Map();

function presence(tripId) {
  return [...(online.get(tripId)?.keys() || [])];
}

function addOnline(tripId, userId) {
  if (!online.has(tripId)) online.set(tripId, new Map());
  const m = online.get(tripId);
  m.set(userId, (m.get(userId) || 0) + 1);
}

function removeOnline(tripId, userId) {
  const m = online.get(tripId);
  if (!m) return;
  const n = (m.get(userId) || 1) - 1;
  if (n <= 0) m.delete(userId);
  else m.set(userId, n);
}

async function isMember(tripId, userId) {
  if (!mongoose.isValidObjectId(tripId)) return false;
  return Boolean(await Trip.exists({ _id: tripId, "members.user": userId }));
}

export function setupSocket(httpServer, clientUrl) {
  const io = new Server(httpServer, { cors: { origin: clientUrl } });
  setIO(io);

  // Every socket must send a valid login token
  io.use((socket, next) => {
    const userId = verifyToken(socket.handshake.auth?.token);
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    socket.data.trips = new Set();
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    socket.on("trip:join", async ({ tripId } = {}, ack) => {
      tripId = String(tripId || "");
      if (!(await isMember(tripId, userId))) return ack?.({ ok: false });
      if (!socket.data.trips.has(tripId)) {
        socket.data.trips.add(tripId);
        socket.join(roomFor(tripId));
        addOnline(tripId, userId);
      }
      io.to(roomFor(tripId)).emit("presence", { userIds: presence(tripId) });
      ack?.({ ok: true, locations: getLocations(tripId) });
    });

    socket.on("trip:leave", ({ tripId } = {}) => leave(String(tripId || "")));

    // Live location: { tripId, lat, lng, accuracy }. Only sent to people in the same trip.
    let lastLocationAt = 0;
    socket.on("location:update", ({ tripId, lat, lng, accuracy } = {}) => {
      tripId = String(tripId || "");
      if (!socket.data.trips.has(tripId) || !socket.rooms.has(roomFor(tripId))) return;
      const now = Date.now();
      if (now - lastLocationAt < 2000) return; // max 1 update / 2s per person
      lat = Number(lat);
      lng = Number(lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      lastLocationAt = now;
      const loc = { lat, lng, accuracy: Math.round(Number(accuracy) || 0), ts: now };
      setLocation(tripId, userId, loc);
      socket.to(roomFor(tripId)).emit("location:update", { userId, ...loc });
    });

    socket.on("location:stop", ({ tripId } = {}) => {
      tripId = String(tripId || "");
      clearLocation(tripId, userId);
      io.to(roomFor(tripId)).emit("location:stop", { userId });
    });

    function leave(tripId) {
      if (!socket.data.trips.has(tripId)) return;
      socket.data.trips.delete(tripId);
      socket.leave(roomFor(tripId));
      removeOnline(tripId, userId);
      io.to(roomFor(tripId)).emit("presence", { userIds: presence(tripId) });
    }

    socket.on("disconnect", () => {
      for (const tripId of [...socket.data.trips]) leave(tripId);
    });
  });

  return io;
}
