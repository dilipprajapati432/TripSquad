import { Router } from "express";
import mongoose from "mongoose";
import { User, FOOD_OPTIONS } from "../models/User.js";
import { Trip } from "../models/Trip.js";
import { HttpError } from "../middleware/errors.js";
import { emitToTrip } from "../services/realtime.js";
import { str } from "../utils/input.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Expense } from "../models/Expense.js";
import { Message, ChatRead } from "../models/Message.js";
import { computeBalances } from "../utils/settle.js";
import { updateWithRetry } from "../utils/retry.js";
import { kickFromTrip } from "../services/realtime.js";
import { announce } from "../services/activity.js";
import { broadcastTrip, deleteTripData } from "./trips.js";

const router = Router();

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR = 120_000; // characters (~90 KB image)
const MAX_THUMB = 12_000;
const PHONE_RE = /^[+0-9 ()-]{6,25}$/;

function cleanText(value, max) {
  return str(value).trim().slice(0, max);
}

function cleanPhone(value, label) {
  const phone = cleanText(value, 25);
  if (phone && !PHONE_RE.test(phone)) throw new HttpError(400, `${label} can only contain numbers, spaces, + ( ) -`);
  return phone;
}

// My full profile
router.get("/me", async (req, res) => {
  const me = await User.findById(req.user._id);
  res.json({ user: me.toPublic() });
});

// Update my profile. Only the fields sent are changed.
router.patch("/me", async (req, res) => {
  const b = req.body || {};
  const me = await User.findById(req.user._id);
  let avatarChanged = false;

  if (b.name !== undefined) {
    const name = cleanText(b.name, 50);
    if (name.length < 2) throw new HttpError(400, "Name must be at least 2 characters");
    me.name = name;
  }
  if (b.bio !== undefined) me.bio = cleanText(b.bio, 160);
  if (b.homeCity !== undefined) me.homeCity = cleanText(b.homeCity, 80);
  if (b.food !== undefined) {
    if (!FOOD_OPTIONS.includes(b.food)) throw new HttpError(400, "Invalid food preference");
    me.food = b.food;
  }
  if (b.languages !== undefined) {
    const list = (Array.isArray(b.languages) ? b.languages : str(b.languages).split(","))
      .map((l) => cleanText(l, 30))
      .filter(Boolean);
    me.languages = [...new Set(list)].slice(0, 8);
  }
  if (b.phone !== undefined) me.phone = cleanPhone(b.phone, "Phone");
  if (b.emergencyName !== undefined) me.emergencyName = cleanText(b.emergencyName, 60);
  if (b.emergencyPhone !== undefined) me.emergencyPhone = cleanPhone(b.emergencyPhone, "Emergency phone");
  if (b.paymentInfo !== undefined) me.paymentInfo = cleanText(b.paymentInfo, 120);
  if (b.onboarded === true && !me.onboardedAt) me.onboardedAt = new Date();
  if (b.visibility && typeof b.visibility === "object") {
    for (const key of ["phone", "emergency", "payment"]) {
      if (b.visibility[key] !== undefined) {
        if (!["members", "private"].includes(b.visibility[key])) throw new HttpError(400, "Invalid visibility");
        me.visibility[key] = b.visibility[key];
      }
    }
  }
  if (b.avatar !== undefined) {
    // The browser resizes the photo before upload; we still check type and size here.
    if (b.avatar === "") {
      me.avatar = "";
      me.avatarThumb = "";
    } else {
      if (!DATA_URL_RE.test(b.avatar) || !DATA_URL_RE.test(b.avatarThumb || "")) throw new HttpError(400, "Photo must be a JPEG, PNG or WebP image");
      if (b.avatar.length > MAX_AVATAR || b.avatarThumb.length > MAX_THUMB) throw new HttpError(400, "Photo is too large");
      me.avatar = b.avatar;
      me.avatarThumb = b.avatarThumb;
    }
    avatarChanged = true;
  }

  await me.save();

  // Name or photo changed -> refresh the member list in all my open trips
  // (phone/emergency too: trip-mates see a warning when someone has no emergency contact)
  if (avatarChanged || b.name !== undefined || b.phone !== undefined || b.emergencyName !== undefined || b.emergencyPhone !== undefined) {
    const trips = await Trip.find({ "members.user": me._id }).select("_id");
    for (const t of trips) emitToTrip(t._id.toString(), "members:changed", { userId: me._id.toString() });
  }
  res.json({ user: me.toPublic() });
});

/**
 * Delete my account (needed for the Play Store, and simply fair).
 * - Trips where I'm alone are deleted completely.
 * - Trips with others: I leave; if I owned it, the longest-standing member becomes the owner.
 * - Blocked while I still owe or am owed money in a shared trip, so friends' accounts stay right.
 * - My profile, contact details, photo and private messages are deleted. Group-chat messages
 *   and expenses I added stay in my friends' trips but show as "Deleted user".
 */
router.delete("/me", async (req, res) => {
  const password = str(req.body?.password);
  const me = await User.findById(req.user._id);
  if (!password || !(await bcrypt.compare(password, me.passwordHash))) throw new HttpError(400, "Your password is not correct");
  const myId = me._id.toString();

  const trips = await Trip.find({ "members.user": me._id });
  const unsettled = [];
  for (const t of trips) {
    if (t.members.length < 2) continue;
    const balance = computeBalances([myId], await Expense.find({ trip: t._id }))[myId] || 0;
    if (balance !== 0) unsettled.push(t.name);
  }
  if (unsettled.length) {
    throw new HttpError(400, `Settle up first — you still owe or are owed money in: ${unsettled.join(", ")}`);
  }

  for (const t of trips) {
    if (t.members.length < 2) {
      await deleteTripData(t._id, myId);
      continue;
    }
    const trip = await updateWithRetry(Trip, t._id, (doc) => {
      const wasOwner = doc.isOwner(myId);
      doc.members = doc.members.filter((m) => m.user.toString() !== myId);
      if (wasOwner && doc.members.length) {
        const next = [...doc.members].sort((a, b) => a.joinedAt - b.joinedAt)[0];
        next.role = "owner";
      }
    });
    kickFromTrip(trip._id.toString(), myId, myId);
    await broadcastTrip(trip);
    await announce(trip._id, me._id, `${me.name} deleted their account and left the trip`, { icon: "leave" });
  }

  await Promise.all([
    Message.deleteMany({ from: me._id, channel: /^dm:/ }),
    ChatRead.deleteMany({ user: me._id }),
  ]);
  // Keep the id (old expenses and messages point to it) but remove everything personal.
  await User.updateOne(
    { _id: me._id },
    {
      $set: {
        name: "Deleted user",
        email: `deleted-${myId}@deleted.invalid`,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 4),
        avatar: "", avatarThumb: "", bio: "", homeCity: "", languages: [], food: "",
        phone: "", emergencyName: "", emergencyPhone: "", paymentInfo: "",
        deletedAt: new Date(),
      },
    }
  );
  res.json({ ok: true });
});

// A trip-mate's profile. You can only see people who share at least one trip with you.
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(404, "Person not found");
  if (userId === req.user._id.toString()) {
    const me = await User.findById(userId);
    return res.json({ user: { ...me.toTripMate(), isMe: true }, sharedTrips: [] });
  }
  const myTrips = await Trip.find({ "members.user": req.user._id }).select("name destination startDate members.user").sort({ startDate: -1 });
  const shared = myTrips.filter((t) => t.isMember(userId)).slice(0, 10);
  if (!shared.length) throw new HttpError(404, "Person not found");
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "Person not found");
  res.json({
    user: user.toTripMate(),
    sharedTrips: shared.map((t) => ({ id: t._id.toString(), name: t.name, destination: t.destination, startDate: t.startDate })),
  });
});

export default router;
