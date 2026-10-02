import { Router } from "express";
import crypto from "node:crypto";
import { Trip } from "../models/Trip.js";
import { Expense } from "../models/Expense.js";
import { Poll } from "../models/Poll.js";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/errors.js";
import { loadTrip, requireOwner } from "../middleware/trip.js";
import { CURRENCIES, toMinor } from "../utils/money.js";
import { computeBalances } from "../utils/settle.js";
import { serializeCover, serializeTrip, serializeTripSummary } from "../utils/serialize.js";
import { updateWithRetry } from "../utils/retry.js";
import { searchPlaces } from "../services/geocode.js";
import { closeTripRoom, emitToTrip, kickFromTrip } from "../services/realtime.js";
import { announce } from "../services/activity.js";
import { tripForecast } from "../services/weather.js";
import { ensureCover, ensurePlacePhotos, lookupCover } from "../services/tripPhotos.js";
import { Message, ChatRead } from "../models/Message.js";
import { User } from "../models/User.js";
import { CoverImage } from "../models/CoverImage.js";
import { str } from "../utils/input.js";

const router = Router();
const MAX_TRIP_DAYS = 60;

const newInviteCode = () => crypto.randomBytes(6).toString("base64url"); // e.g. "k3J_9aQz"

const MEMBER_FIELDS = "name avatarThumb phone emergencyName emergencyPhone";

async function tripPayload(trip, viewerId) {
  await trip.populate("members.user", MEMBER_FIELDS);
  const data = serializeTrip(trip, viewerId);
  // Currency can't change once money has been recorded (old balances would be wrong)
  data.hasExpenses = Boolean(await Expense.exists({ trip: trip._id }));
  return data;
}

async function sendTrip(res, trip, viewerId, status = 200) {
  res.status(status).json({ trip: await tripPayload(trip, viewerId) });
}

/** Tell everyone in the trip that trip details or members changed. */
export async function broadcastTrip(trip) {
  const data = await tripPayload(trip, null);
  delete data.isOwner; // each client works this out from its own user id
  emitToTrip(trip._id.toString(), "trip:updated", data);
}

/**
 * Trip dates are calendar days, stored as UTC midnight ("2026-10-01" -> 2026-10-01T00:00Z),
 * so every server and every browser time zone agrees on which day it is.
 */
function calendarDay(value) {
  if (!(value instanceof Date) && typeof value !== "string") return new Date(NaN);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseTripInput(body, { partial = false, current = null } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = str(body.name).trim();
    if (out.name.length < 2) throw new HttpError(400, "Trip name must be at least 2 characters");
  }
  if (!partial || body.destination !== undefined) {
    out.destination = str(body.destination).trim();
    if (out.destination.length < 2) throw new HttpError(400, "Please enter a destination");
  }
  if (!partial || body.startDate !== undefined || body.endDate !== undefined) {
    // When editing, a missing date keeps the trip's current one
    const start = calendarDay(body.startDate ?? current?.startDate);
    const end = calendarDay(body.endDate ?? current?.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new HttpError(400, "Please choose valid dates");
    if (end < start) throw new HttpError(400, "End date must be after the start date");
    if (Math.round((end - start) / 86400000) + 1 > MAX_TRIP_DAYS) throw new HttpError(400, `Trips can be at most ${MAX_TRIP_DAYS} days`);
    out.startDate = start;
    out.endDate = end;
  }
  if (body.requireContact !== undefined) out.requireContact = Boolean(body.requireContact);
  if (body.theme !== undefined) {
    const theme = Math.round(Number(body.theme));
    if (!Number.isInteger(theme) || theme < 0 || theme > 7) throw new HttpError(400, "Invalid cover theme");
    out.theme = theme;
  }
  if (!partial || body.currency !== undefined) {
    out.currency = str(body.currency, "INR").toUpperCase();
    if (!CURRENCIES.includes(out.currency)) throw new HttpError(400, "Unsupported currency");
  }
  return out;
}

async function findCenter(destination) {
  try {
    // Never let a slow geocoder make "Create trip" hang
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
    const [first] = await Promise.race([searchPlaces(destination, { limit: 1 }), timeout]);
    return first ? { lat: first.lat, lng: first.lng } : undefined;
  } catch {
    return undefined; // the map will just use a default view
  }
}

// ---------- My trips ----------

router.get("/", async (req, res) => {
  const trips = await Trip.find({ "members.user": req.user._id }).sort({ startDate: -1 }).populate("members.user", MEMBER_FIELDS);
  // Total group spending per trip, for the dashboard cards
  const totals = {};
  const expenses = await Expense.find({ trip: { $in: trips.map((t) => t._id) }, kind: "expense" }).select("trip amountBase");
  for (const e of expenses) totals[e.trip] = (totals[e.trip] || 0) + e.amountBase;
  trips.forEach(ensureCover); // older trips get a cover photo in the background
  res.json({ trips: trips.map((t) => serializeTripSummary(t, req.user._id, { totalSpent: totals[t._id] || 0 })) });
});

router.post("/", async (req, res) => {
  const input = parseTripInput(req.body || {});
  const [center, cover] = await Promise.all([findCenter(input.destination), lookupCover(input.destination)]);
  const trip = await Trip.create({
    ...input,
    center,
    cover,
    inviteCode: newInviteCode(),
    members: [{ user: req.user._id, role: "owner" }],
  });
  await sendTrip(res, trip, req.user._id, 201);
});

// ---------- Invites (these routes don't need membership) ----------

router.get("/invite/:code", async (req, res) => {
  const trip = await Trip.findOne({ inviteCode: req.params.code }).populate("members.user", "name");
  const me = await User.findById(req.user._id).select("phone emergencyName emergencyPhone");
  if (!trip) throw new HttpError(404, "This invite link is invalid or has been reset");
  res.json({
    invite: {
      tripId: trip._id.toString(),
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      theme: trip.theme || 0,
      cover: serializeCover(trip),
      memberCount: trip.members.length,
      memberNames: trip.members.slice(0, 5).map((m) => m.user?.name).filter(Boolean),
      alreadyMember: trip.isMember(req.user._id),
      full: trip.members.length >= env.maxMembers,
      requireContact: Boolean(trip.requireContact),
      missing: trip.requireContact ? me.missingContact() : [],
    },
  });
});

router.post("/join/:code", async (req, res) => {
  const found = await Trip.findOne({ inviteCode: req.params.code }).select("_id requireContact members.user");
  if (!found) throw new HttpError(404, "This invite link is invalid or has been reset");
  if (found.requireContact && !found.isMember(req.user._id)) {
    const me = await User.findById(req.user._id).select("phone emergencyName emergencyPhone");
    if (me.missingContact().length) {
      throw new HttpError(400, "This trip asks every member for a phone number and an emergency contact. Add them to join.");
    }
  }
  const trip = await updateWithRetry(Trip, found._id, (t) => {
    if (t.isMember(req.user._id)) return;
    if (t.members.length >= env.maxMembers) throw new HttpError(400, `This trip is full (max ${env.maxMembers} people)`);
    t.members.push({ user: req.user._id, role: "member" });
    t.$locals.joined = true;
  });
  await broadcastTrip(trip);
  if (trip.$locals.joined) await announce(trip._id, req.user._id, `${req.user.name} joined the trip`, { icon: "join" });
  await sendTrip(res, trip, req.user._id);
});

// ---------- One trip ----------

router.get("/:tripId", loadTrip, async (req, res) => {
  ensureCover(req.trip);
  ensurePlacePhotos(req.trip);
  await sendTrip(res, req.trip, req.user._id);
});

router.patch("/:tripId", loadTrip, requireOwner, async (req, res) => {
  const input = parseTripInput(req.body || {}, { partial: true, current: req.trip });
  if (input.currency && input.currency !== req.trip.currency && (await Expense.exists({ trip: req.trip._id }))) {
    throw new HttpError(400, "You can't change the trip currency after expenses have been added");
  }
  const before = { name: req.trip.name, destination: req.trip.destination, start: +req.trip.startDate, end: +req.trip.endDate, requireContact: Boolean(req.trip.requireContact) };
  const newPlace = input.destination && input.destination !== req.trip.destination;
  const [center, cover] = newPlace ? await Promise.all([findCenter(input.destination), lookupCover(input.destination)]) : [null, null];
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    Object.assign(t, input);
    if (center) t.center = center;
    // New destination: find a new photo, unless the owner uploaded their own
    if (newPlace && t.cover?.kind !== "upload") t.cover = cover; // null = look it up again later
    // If the trip got shorter, places on removed days go back to "Ideas"
    const days = t.dayCount();
    let moved = 0;
    for (const p of t.places) {
      if (p.day > days) {
        p.day = 0;
        moved++;
      }
    }
    t.$locals.moved = moved;
  });
  await broadcastTrip(trip);
  const changes = [];
  if (trip.name !== before.name) changes.push(`renamed the trip to "${trip.name}"`);
  if (trip.destination !== before.destination) changes.push(`changed the destination to ${trip.destination}`);
  if (+trip.startDate !== before.start || +trip.endDate !== before.end) changes.push("changed the trip dates");
  if (Boolean(trip.requireContact) !== before.requireContact) {
    changes.push(trip.requireContact ? "now asks everyone for a phone number and emergency contact" : "made contact details optional");
  }
  if (changes.length) {
    const moved = trip.$locals.moved ? ` (${trip.$locals.moved} place${trip.$locals.moved > 1 ? "s" : ""} moved to Ideas)` : "";
    await announce(trip._id, req.user._id, `${req.user.name} ${changes.join(", ")}${moved}`, { icon: "edit" });
  }
  await sendTrip(res, trip, req.user._id);
});

/** Deletes a trip and everything in it (expenses, polls, chat, uploaded cover). */
export async function deleteTripData(id, by) {
  await Promise.all([
    Expense.deleteMany({ trip: id }),
    Poll.deleteMany({ trip: id }),
    Message.deleteMany({ trip: id }),
    ChatRead.deleteMany({ trip: id }),
    CoverImage.deleteMany({ trip: id }),
    Trip.deleteOne({ _id: id }),
  ]);
  emitToTrip(id.toString(), "trip:deleted", { tripId: id.toString(), by: by ? String(by) : null });
  closeTripRoom(id);
}

router.delete("/:tripId", loadTrip, requireOwner, async (req, res) => {
  await deleteTripData(req.trip._id, req.user._id);
  res.json({ ok: true });
});

router.post("/:tripId/invite/reset", loadTrip, requireOwner, async (req, res) => {
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    t.inviteCode = newInviteCode();
  });
  await broadcastTrip(trip);
  await sendTrip(res, trip, req.user._id);
});

router.get("/:tripId/weather", loadTrip, async (req, res) => {
  const c = req.trip.center;
  if (c?.lat == null) return res.json({ days: {}, note: "Weather needs a known destination." });
  try {
    res.json(await tripForecast({ lat: c.lat, lng: c.lng, startDate: req.trip.startDate, endDate: req.trip.endDate }));
  } catch {
    res.json({ days: {}, note: "Weather is unavailable right now." });
  }
});

// ---------- Members ----------

router.patch("/:tripId/me/budget", loadTrip, async (req, res) => {
  const raw = req.body?.budget;
  const budget = raw === 0 || raw === "0" || raw === "" || raw == null ? 0 : toMinor(raw);
  if (budget === null) throw new HttpError(400, "Please enter a valid budget");
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    const me = t.members.find((m) => m.user.toString() === req.user._id.toString());
    if (me) me.budget = budget;
  });
  await broadcastTrip(trip);
  await sendTrip(res, trip, req.user._id);
});

// Remove a member (owner), or leave the trip yourself (use your own id)
router.delete("/:tripId/members/:userId", loadTrip, async (req, res) => {
  const { userId } = req.params;
  const self = userId === req.user._id.toString();
  if (!self && !req.trip.isOwner(req.user._id)) throw new HttpError(403, "Only the trip owner can remove people");
  if (!req.trip.isMember(userId)) throw new HttpError(404, "This person is not in the trip");
  if (req.trip.isOwner(userId)) throw new HttpError(400, "The owner can't leave. Delete the trip instead.");

  const trip = await updateWithRetry(Trip, req.trip._id, async (t) => {
    if (!t.isMember(userId)) throw new HttpError(404, "This person is not in the trip");
    // Checked inside the trip lock, right before removing, so a just-added expense counts
    const balance = computeBalances([userId], await Expense.find({ trip: req.trip._id }))[userId] || 0;
    if (balance !== 0) throw new HttpError(400, "Settle up first — this person still owes or is owed money");
    t.members = t.members.filter((m) => m.user.toString() !== userId);
  });
  kickFromTrip(trip._id.toString(), userId, req.user._id);
  await broadcastTrip(trip);
  const gone = await User.findById(userId).select("name");
  await announce(trip._id, req.user._id, self ? `${req.user.name} left the trip` : `${gone?.name || "Someone"} was removed from the trip`, { icon: "leave" });
  res.json({ ok: true });
});

export default router;
