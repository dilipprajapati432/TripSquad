import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { Trip } from "./models/Trip.js";
import { env } from "./config/env.js";
import { verifyToken } from "./middleware/auth.js";
import { setIO, setRoomControl, roomFor, userRoom } from "./services/realtime.js";
import { setLocation, clearLocation, getLocations } from "./services/location.js";

// tripId -> Map(userId -> number of open tabs). Used for "who's online".
const online = new Map();
// `${tripId}:${userId}` -> Set of socket ids currently sharing live location.
// With two tabs open, stopping in one tab must not hide you while the other still shares.
const sharers = new Map();

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
  if (!m.size) online.delete(tripId);
}

async function isMember(tripId, userId) {
  if (!mongoose.isValidObjectId(tripId)) return false;
  return Boolean(await Trip.exists({ _id: tripId, "members.user": userId }));
}

/**
 * Wraps a socket event handler so bad input can never crash the server:
 * the payload is always an object, the ack is always a function, and errors are logged.
 */
function safe(handler) {
  return async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      await handler(payload && typeof payload === "object" ? payload : {}, reply);
    } catch (err) {
      console.error("socket handler failed:", err.message);
      reply({ ok: false });
    }
  };
}

export function setupSocket(httpServer, clientUrls) {
  const io = new Server(httpServer, { cors: { origin: clientUrls }, maxHttpBufferSize: 1e5 });
  setIO(io);

  // Every socket must send a valid login token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const userId = typeof token === "string" ? verifyToken(token) : null;
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    socket.data.trips = new Set();
    // The token is only checked here, so end the connection when it expires
    const { exp } = jwt.decode(token) || {};
    if (exp) socket.data.expiresAt = exp * 1000;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(userRoom(userId)); // private messages + personal notifications
    let expiry = null;
    if (socket.data.expiresAt) {
      const ms = socket.data.expiresAt - Date.now();
      expiry = setTimeout(() => socket.disconnect(true), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    }

    function stopSharing(tripId) {
      const key = `${tripId}:${userId}`;
      const set = sharers.get(key);
      if (!set?.delete(socket.id)) return;
      if (set.size) return; // still sharing from another tab
      sharers.delete(key);
      clearLocation(tripId, userId);
      io.to(roomFor(tripId)).emit("location:stop", { userId });
    }

    function leave(tripId) {
      if (!socket.data.trips.has(tripId)) return;
      stopSharing(tripId);
      socket.data.trips.delete(tripId);
      socket.leave(roomFor(tripId));
      removeOnline(tripId, userId);
      io.to(roomFor(tripId)).emit("presence", { userIds: presence(tripId) });
    }
    socket.data.leaveTrip = leave; // used by kickUser() below

    // "DP is typing…" — relayed, never stored. { tripId, channel }
    let lastTypingAt = 0;
    socket.on("chat:typing", safe(({ tripId, channel }) => {
      tripId = String(tripId || "");
      channel = String(channel || "");
      if (!socket.data.trips.has(tripId) || Date.now() - lastTypingAt < 1500) return;
      lastTypingAt = Date.now();
      const payload = { tripId, channel, userId };
      if (channel === "group") socket.to(roomFor(tripId)).emit("chat:typing", payload);
      else {
        const m = /^dm:([a-f0-9]{24})_([a-f0-9]{24})$/.exec(channel);
        if (!m || (m[1] !== userId && m[2] !== userId)) return;
        const other = m[1] === userId ? m[2] : m[1];
        socket.to(userRoom(other)).emit("chat:typing", payload);
      }
    }));

    socket.on("trip:join", safe(async ({ tripId }, ack) => {
      tripId = String(tripId || "");
      const member = await isMember(tripId, userId);
      // The tab may have closed while we were checking — don't count it as online
      if (!member || !socket.connected) return ack({ ok: false });
      if (!socket.data.trips.has(tripId)) {
        socket.data.trips.add(tripId);
        socket.join(roomFor(tripId));
        addOnline(tripId, userId);
      }
      io.to(roomFor(tripId)).emit("presence", { userIds: presence(tripId) });
      ack({ ok: true, locations: getLocations(tripId) });
    }));

    socket.on("trip:leave", safe(({ tripId }) => leave(String(tripId || ""))));

    // Live location: { tripId, lat, lng, accuracy }. Only sent to people in the same trip.
    let lastLocationAt = 0;
    socket.on("location:update", safe(({ tripId, lat, lng, accuracy }) => {
      tripId = String(tripId || "");
      if (!socket.data.trips.has(tripId) || !socket.rooms.has(roomFor(tripId))) return;
      const now = Date.now();
      if (now - lastLocationAt < 2000) return; // max 1 update / 2s per person
      lat = Number(lat);
      lng = Number(lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      lastLocationAt = now;
      const key = `${tripId}:${userId}`;
      if (!sharers.has(key)) sharers.set(key, new Set());
      sharers.get(key).add(socket.id);
      const acc = Number(accuracy);
      const loc = { lat, lng, accuracy: Number.isFinite(acc) ? Math.min(Math.max(Math.round(acc), 0), 100000) : 0, ts: now };
      setLocation(tripId, userId, loc);
      socket.to(roomFor(tripId)).emit("location:update", { userId, ...loc });
    }));

    socket.on("location:stop", safe(({ tripId }) => stopSharing(String(tripId || ""))));

    // Closing the tab stops sharing right away (no 10-minute ghost pin)
    socket.on("disconnect", () => {
      clearTimeout(expiry);
      for (const tripId of [...socket.data.trips]) leave(tripId);
    });
  });

  // Called by routes when someone is removed from a trip or the trip is deleted
  setRoomControl({
    kickUser(tripId, uid, by) {
      tripId = String(tripId);
      for (const s of io.sockets.sockets.values()) {
        if (s.data.userId === String(uid) && s.data.trips?.has(tripId)) {
          s.data.leaveTrip(tripId);
          s.emit("trip:removed", { tripId, by: by ? String(by) : null });
        }
      }
      clearLocation(tripId, String(uid)); // in case they shared from a tab that already closed
    },
    closeTrip(tripId) {
      tripId = String(tripId);
      for (const s of io.sockets.sockets.values()) if (s.data.trips?.has(tripId)) s.data.leaveTrip(tripId);
    },
  });

  return io;
}
