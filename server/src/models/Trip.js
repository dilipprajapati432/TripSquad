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
  photo: { type: String, default: "" }, // small photo from Wikipedia, if one was found
  photoCheckedAt: { type: Date, default: null },
});

// Cover photo for the destination (from Wikivoyage/Wikipedia). checkedAt is set even
// when nothing was found, so we don't search again on every page load.
// kind: "auto" (found for the destination), "pick" (owner chose a suggested photo),
// "upload" (owner's own photo, stored in CoverImage), "none" (owner chose the plain color).
// position: which part of the photo shows in wide banners (0 = top, 100 = bottom).
const coverSchema = new Schema(
  {
    url: String,
    page: String,
    credit: String,
    kind: { type: String, enum: ["auto", "pick", "upload", "none"], default: "auto" },
    position: { type: Number, min: 0, max: 100, default: 50 },
    checkedAt: Date,
  },
  { _id: false }
);

const tripSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    center: { lat: Number, lng: Number }, // map center for the destination
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    currency: { type: String, required: true, default: "INR" },
    theme: { type: Number, default: 0, min: 0, max: 7 }, // cover color theme
    requireContact: { type: Boolean, default: false }, // members must add phone + emergency contact to join
    cover: { type: coverSchema, default: null },
    inviteCode: { type: String, required: true, unique: true },
    members: [memberSchema],
    places: [placeSchema],
  },
  // optimisticConcurrency: if two people save the same trip at the same moment,
  // the second save fails with a VersionError and we retry it (see utils/retry.js).
  { timestamps: true, optimisticConcurrency: true }
);

tripSchema.index({ "members.user": 1 });

// members.user may be an id or (after populate) a User document
const idOf = (u) => String(u?._id ?? u);

tripSchema.methods.isMember = function (userId) {
  return this.members.some((m) => idOf(m.user) === String(userId));
};

tripSchema.methods.isOwner = function (userId) {
  return this.members.some((m) => idOf(m.user) === String(userId) && m.role === "owner");
};

/** Number of days in the trip, inclusive. */
tripSchema.methods.dayCount = function () {
  // Dates are calendar days stored as UTC midnight — count in UTC so the server's time zone doesn't matter
  const day = (d) => { const x = new Date(d); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
  const ms = day(this.endDate) - day(this.startDate);
  return Math.max(1, Math.round(ms / 86400000) + 1);
};

export const Trip = mongoose.model("Trip", tripSchema);
