import mongoose from "mongoose";

const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    budget: { type: Number, default: 0 }, // minor units in trip currency, 0 = no budget
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const placeSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, default: "", maxlength: 300 },
  note: { type: String, default: "", maxlength: 500 },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  day: { type: Number, default: 0, min: 0 }, // 0 = "Ideas" (not scheduled yet)
  order: { type: Number, default: 0 },
  addedBy: { type: Schema.Types.ObjectId, ref: "User" },
  source: { type: String, enum: ["manual", "ai"], default: "manual" },
});

const tripSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    center: { lat: Number, lng: Number }, // map center for the destination
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    currency: { type: String, required: true, default: "INR" },
    inviteCode: { type: String, required: true, unique: true },
    members: [memberSchema],
    places: [placeSchema],
  },
  // optimisticConcurrency: if two people save the same trip at the same moment,
  // the second save fails with a VersionError and we retry it (see utils/retry.js).
  { timestamps: true, optimisticConcurrency: true }
);

tripSchema.index({ "members.user": 1 });

tripSchema.methods.isMember = function (userId) {
  return this.members.some((m) => m.user.toString() === String(userId));
};

tripSchema.methods.isOwner = function (userId) {
  return this.members.some((m) => m.user.toString() === String(userId) && m.role === "owner");
};

/** Number of days in the trip, inclusive. */
tripSchema.methods.dayCount = function () {
  const ms = new Date(this.endDate).setHours(0, 0, 0, 0) - new Date(this.startDate).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

export const Trip = mongoose.model("Trip", tripSchema);
