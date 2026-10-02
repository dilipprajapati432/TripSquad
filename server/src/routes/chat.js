import { Router } from "express";
import mongoose from "mongoose";
import { Message, ChatRead } from "../models/Message.js";
import { HttpError } from "../middleware/errors.js";
import { serializeMessage } from "../utils/serialize.js";
import { emitToTrip, emitToUsers } from "../services/realtime.js";
import { setBounded } from "../utils/cache.js";
import { str } from "../utils/input.js";

// Mounted at /api/trips/:tripId/chat (loadTrip already ran)
const router = Router({ mergeParams: true });

const PAGE = 40;
const MAX_TEXT = 2000;
const RATE = { windowMs: 10_000, max: 15 }; // max 15 messages per 10 seconds per person
const recent = new Map(); // userId -> [timestamps]
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // messages can be edited for 15 minutes

export const dmChannel = (a, b) => `dm:${[String(a), String(b)].sort().join("_")}`;

/** Checks the channel name and that the user may use it. Returns the DM partner id (or null for group). */
function checkChannel(req, channel) {
  const me = req.user._id.toString();
  if (channel === "group") return null;
  const m = /^dm:([a-f0-9]{24})_([a-f0-9]{24})$/.exec(channel);
  if (!m || (m[1] !== me && m[2] !== me) || m[1] === m[2]) throw new HttpError(404, "Chat not found");
  const other = m[1] === me ? m[2] : m[1];
  if (!req.trip.isMember(other)) throw new HttpError(404, "This person is no longer in the trip");
  if (channel !== dmChannel(m[1], m[2])) throw new HttpError(404, "Chat not found");
  return other;
}

function rateLimited(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < RATE.windowMs);
  if (list.length >= RATE.max) return true;
  list.push(now);
  setBounded(recent, userId, list);
  return false;
}

/** Deliver an event to whoever can see this channel. */
function deliver(req, channel, event, payload) {
  const tripId = req.trip._id.toString();
  if (channel === "group") emitToTrip(tripId, event, { tripId, ...payload });
  else emitToUsers(channel.slice(3).split("_"), event, { tripId, ...payload });
}

// Channel list with last message + unread count, for the chat sidebar
router.get("/channels", async (req, res) => {
  const me = req.user._id.toString();
  const tripId = req.trip._id;
  const others = req.trip.members.map((m) => m.user.toString()).filter((id) => id !== me);
  const channels = ["group", ...others.map((o) => dmChannel(me, o))];
  const reads = await ChatRead.find({ trip: tripId, user: me, channel: { $in: channels } });
  const readAt = Object.fromEntries(reads.map((r) => [r.channel, r.lastReadAt]));

  const out = await Promise.all(
    channels.map(async (channel, i) => {
      const [last] = await Message.find({ trip: tripId, channel }).sort({ createdAt: -1 }).limit(1);
      const unread = await Message.countDocuments({
        trip: tripId,
        channel,
        createdAt: { $gt: readAt[channel] || new Date(0) },
        from: { $ne: req.user._id },
        kind: { $ne: "system" },
        deletedAt: null, // deleted messages don't count as unread
      });
      return { channel, withUser: i === 0 ? null : others[i - 1], last: last ? serializeMessage(last) : null, unread };
    })
  );
  res.json({ channels: out });
});

// Messages, newest last. Use ?before=<ISO date> to load older ones.
router.get("/:channel/messages", async (req, res) => {
  const { channel } = req.params;
  checkChannel(req, channel);
  const filter = { trip: req.trip._id, channel };
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const list = await Message.find(filter).sort({ createdAt: -1 }).limit(PAGE + 1);
  const hasMore = list.length > PAGE;
  const messages = list.slice(0, PAGE).reverse().map(serializeMessage);

  // Read positions of everyone in the channel, for "Seen by"
  const reads = await ChatRead.find({ trip: req.trip._id, channel });
  res.json({
    messages,
    hasMore,
    reads: Object.fromEntries(reads.map((r) => [r.user.toString(), r.lastReadAt])),
  });
});

router.post("/:channel/messages", async (req, res) => {
  const { channel } = req.params;
  checkChannel(req, channel);
  const me = req.user._id.toString();
  if (rateLimited(me)) throw new HttpError(429, "You're sending messages too fast. Wait a few seconds.");

  const kind = ["text", "place", "location"].includes(req.body?.kind) ? req.body.kind : "text";
  const text = str(req.body?.text).trim().slice(0, MAX_TEXT);
  let place;
  if (kind === "text") {
    if (!text) throw new HttpError(400, "Message is empty");
  } else {
    const lat = Number(req.body?.place?.lat);
    const lng = Number(req.body?.place?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, "Invalid location");
    }
    place = { name: (str(req.body.place.name) || (kind === "location" ? "My location" : "Place")).slice(0, 120), lat, lng };
  }

  const msg = await Message.create({ trip: req.trip._id, channel, kind, from: me, text, place });
  const message = serializeMessage(msg);
  // Sending a message means you've read everything before it
  await ChatRead.updateOne({ trip: req.trip._id, user: me, channel }, { $set: { lastReadAt: msg.createdAt } }, { upsert: true });
  deliver(req, channel, "chat:message", { message });
  deliver(req, channel, "chat:read", { channel, userId: me, at: msg.createdAt });
  res.status(201).json({ message });
});

async function findMessage(req) {
  const { channel, messageId } = req.params;
  checkChannel(req, channel);
  if (!mongoose.isValidObjectId(messageId)) throw new HttpError(404, "Message not found");
  const msg = await Message.findOne({ _id: messageId, trip: req.trip._id, channel });
  if (!msg) throw new HttpError(404, "Message not found");
  if (msg.kind === "system") throw new HttpError(403, "Automatic trip updates can't be changed");
  if (msg.deletedAt) throw new HttpError(400, "This message was already deleted");
  return msg;
}

// Edit your own text message (within 15 minutes)
router.patch("/:channel/messages/:messageId", async (req, res) => {
  const msg = await findMessage(req);
  if (msg.from?.toString() !== req.user._id.toString()) throw new HttpError(403, "You can only edit your own messages");
  if (msg.kind !== "text") throw new HttpError(400, "Only text messages can be edited");
  if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) throw new HttpError(400, "Messages can only be edited for 15 minutes after sending");
  const text = str(req.body?.text).trim().slice(0, MAX_TEXT);
  if (!text) throw new HttpError(400, "Message is empty");
  if (text !== msg.text) {
    msg.text = text;
    msg.editedAt = new Date();
    await msg.save();
  }
  const message = serializeMessage(msg);
  deliver(req, msg.channel, "chat:updated", { message });
  res.json({ message });
});

// Delete for everyone: your own messages, or anyone's in the group chat if you own the trip
router.delete("/:channel/messages/:messageId", async (req, res) => {
  const msg = await findMessage(req);
  const mine = msg.from?.toString() === req.user._id.toString();
  const moderator = msg.channel === "group" && req.trip.isOwner(req.user._id);
  if (!mine && !moderator) throw new HttpError(403, "You can only delete your own messages");
  msg.deletedAt = new Date();
  msg.deletedBy = req.user._id;
  msg.text = ""; // really remove the content, not just hide it
  msg.place = undefined;
  await msg.save();
  const message = serializeMessage(msg);
  deliver(req, msg.channel, "chat:updated", { message });
  res.json({ message });
});

// Mark a channel as read up to now
router.post("/:channel/read", async (req, res) => {
  const { channel } = req.params;
  checkChannel(req, channel);
  const me = req.user._id.toString();
  const at = new Date();
  await ChatRead.updateOne({ trip: req.trip._id, user: me, channel }, { $set: { lastReadAt: at } }, { upsert: true });
  deliver(req, channel, "chat:read", { channel, userId: me, at });
  res.json({ ok: true });
});

export default router;
