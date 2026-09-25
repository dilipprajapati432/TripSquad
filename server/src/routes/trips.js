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
import { serializeTrip, serializeTripSummary } from "../utils/serialize.js";
import { updateWithRetry } from "../utils/retry.js";
import { searchPlaces } from "../services/geocode.js";
import { emitToTrip, kickFromTrip } from "../services/realtime.js";

const router = Router();
const MAX_TRIP_DAYS = 60;

const newInviteCode = () => crypto.randomBytes(6).toString("base64url"); // e.g. "k3J_9aQz"

async function sendTrip(res, trip, viewerId, status = 200) {
  await trip.populate("members.user", "name");
  res.status(status).json({ trip: serializeTrip(trip, viewerId) });
}

/** Tell everyone in the trip that trip details or members changed. */
async function broadcastTrip(trip) {
  await trip.populate("members.user", "name");
  const data = serializeTrip(trip, null);
  delete data.isOwner; // each client works this out from its own user id
  emitToTrip(trip._id.toString(), "trip:updated", data);
}

function parseTripInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = String(body.name || "").trim();
    if (out.name.length < 2) throw new HttpError(400, "Trip name must be at least 2 characters");
  }
  if (!partial || body.destination !== undefined) {
    out.destination = String(body.destination || "").trim();
    if (out.destination.length < 2) throw new HttpError(400, "Please enter a destination");
  }
  if (!partial || body.startDate !== undefined || body.endDate !== undefined) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new HttpError(400, "Please choose valid dates");
    if (end < start) throw new HttpError(400, "End date must be after the start date");
    if ((end - start) / 86400000 >= MAX_TRIP_DAYS) throw new HttpError(400, `Trips can be at most ${MAX_TRIP_DAYS} days`);
    out.startDate = start;
    out.endDate = end;
  }
  if (!partial || body.currency !== undefined) {
    out.currency = String(body.currency || "INR").toUpperCase();
    if (!CURRENCIES.includes(out.currency)) throw new HttpError(400, "Unsupported currency");
  }
  return out;
}

async function findCenter(destination) {
  try {
    const [first] = await searchPlaces(destination, { limit: 1 });
    return first ? { lat: first.lat, lng: first.lng } : undefined;
  } catch {
    return undefined; // the map will just use a default view
  }
}

// ---------- My trips ----------

router.get("/", async (req, res) => {
  const trips = await Trip.find({ "members.user": req.user._id }).sort({ startDate: -1 });
  res.json({ trips: trips.map((t) => serializeTripSummary(t, req.user._id)) });
});

router.post("/", async (req, res) => {
  const input = parseTripInput(req.body || {});
  const trip = await Trip.create({
    ...input,
    center: await findCenter(input.destination),
    inviteCode: newInviteCode(),
    members: [{ user: req.user._id, role: "owner" }],
  });
  await sendTrip(res, trip, req.user._id, 201);
});

// ---------- Invites (these routes don't need membership) ----------

router.get("/invite/:code", async (req, res) => {
  const trip = await Trip.findOne({ inviteCode: req.params.code }).populate("members.user", "name");
  if (!trip) throw new HttpError(404, "This invite link is invalid or has been reset");
  res.json({
    invite: {
      tripId: trip._id.toString(),
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      memberCount: trip.members.length,
      memberNames: trip.members.slice(0, 5).map((m) => m.user?.name).filter(Boolean),
      alreadyMember: trip.isMember(req.user._id),
      full: trip.members.length >= env.maxMembers,
    },
  });
});

router.post("/join/:code", async (req, res) => {
  const found = await Trip.findOne({ inviteCode: req.params.code }).select("_id");
  if (!found) throw new HttpError(404, "This invite link is invalid or has been reset");
  const trip = await updateWithRetry(Trip, found._id, (t) => {
    if (t.isMember(req.user._id)) return;
    if (t.members.length >= env.maxMembers) throw new HttpError(400, `This trip is full (max ${env.maxMembers} people)`);
    t.members.push({ user: req.user._id, role: "member" });
  });
  await broadcastTrip(trip);
  await sendTrip(res, trip, req.user._id);
});

// ---------- One trip ----------

router.get("/:tripId", loadTrip, async (req, res) => {
  await sendTrip(res, req.trip, req.user._id);
});

router.patch("/:tripId", loadTrip, requireOwner, async (req, res) => {
  const input = parseTripInput(req.body || {}, { partial: true });
  if (input.currency && input.currency !== req.trip.currency && (await Expense.exists({ trip: req.trip._id }))) {
    throw new HttpError(400, "You can't change the trip currency after expenses have been added");
  }
  const center = input.destination && input.destination !== req.trip.destination ? await findCenter(input.destination) : null;
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    Object.assign(t, input);
    if (center) t.center = center;
    // If the trip got shorter, places on removed days go back to "Ideas"
    const days = t.dayCount();
    for (const p of t.places) if (p.day > days) p.day = 0;
  });
  await broadcastTrip(trip);
  await sendTrip(res, trip, req.user._id);
});

router.delete("/:tripId", loadTrip, requireOwner, async (req, res) => {
  const id = req.trip._id;
  await Promise.all([Expense.deleteMany({ trip: id }), Poll.deleteMany({ trip: id }), Trip.deleteOne({ _id: id })]);
  emitToTrip(id.toString(), "trip:deleted", { tripId: id.toString() });
  res.json({ ok: true });
});

router.post("/:tripId/invite/reset", loadTrip, requireOwner, async (req, res) => {
  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    t.inviteCode = newInviteCode();
  });
  await broadcastTrip(trip);
  await sendTrip(res, trip, req.user._id);
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

  const expenses = await Expense.find({ trip: req.trip._id });
  const balance = computeBalances([userId], expenses)[userId] || 0;
  if (balance !== 0) throw new HttpError(400, "Settle up first — this person still owes or is owed money");

  const trip = await updateWithRetry(Trip, req.trip._id, (t) => {
    t.members = t.members.filter((m) => m.user.toString() !== userId);
  });
  await kickFromTrip(trip._id.toString(), userId);
  await broadcastTrip(trip);
  res.json({ ok: true });
});

export default router;
