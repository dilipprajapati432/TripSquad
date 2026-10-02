import { Message } from "../models/Message.js";
import { serializeMessage } from "../utils/serialize.js";
import { emitToTrip } from "./realtime.js";

/**
 * Tell the group something happened, e.g. "Aman added expense ₹2,400 (Dinner)".
 *  - Always sends a live "activity" event (clients show a toast to everyone except `by`)
 *  - With chat: true, also saves it as a system message in the group chat, so the
 *    chat becomes the trip's timeline.
 *  - `icon` is a short key (join, expense, poll...) that the client maps to an icon.
 */
export async function announce(tripId, by, text, { chat = true, icon = "info" } = {}) {
  tripId = String(tripId);
  emitToTrip(tripId, "activity", { by: by ? String(by) : null, text, icon });
  if (!chat) return;
  try {
    const msg = await Message.create({ trip: tripId, channel: "group", kind: "system", text, icon });
    emitToTrip(tripId, "chat:message", { message: serializeMessage(msg) });
  } catch (err) {
    console.error("announce failed:", err.message);
  }
}
