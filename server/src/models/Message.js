import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * A chat message inside a trip.
 * channel = "group" for the whole trip, or "dm:<userA>_<userB>" (ids sorted) for a private chat.
 */
const messageSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true },
    channel: { type: String, required: true },
    kind: { type: String, enum: ["text", "place", "location", "system"], default: "text" },
    from: { type: Schema.Types.ObjectId, ref: "User" }, // empty for system messages
    text: { type: String, default: "", maxlength: 2000 },
    // For "place" and "location" messages
    place: {
      name: String,
      lat: Number,
      lng: Number,
    },
    editedAt: { type: Date, default: null },
    // For system messages: which icon the client shows (join, expense, poll...)
    icon: { type: String, default: null },
    // Soft delete: the content is wiped, a "This message was deleted" placeholder stays in the chat
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

messageSchema.index({ trip: 1, channel: 1, createdAt: -1 });

/** Tracks how far each person has read in each channel (for unread badges and "Seen by"). */
const chatReadSchema = new Schema({
  trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  channel: { type: String, required: true },
  lastReadAt: { type: Date, default: () => new Date(0) },
});

chatReadSchema.index({ trip: 1, user: 1, channel: 1 }, { unique: true });

export const Message = mongoose.model("Message", messageSchema);
export const ChatRead = mongoose.model("ChatRead", chatReadSchema);
