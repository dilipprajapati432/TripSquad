import mongoose from "mongoose";

const VISIBILITY = ["members", "private"]; // "members" = people who share a trip with you
export const FOOD_OPTIONS = ["", "vegetarian", "non-vegetarian", "vegan", "jain", "eggetarian", "halal", "no preference"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // ----- Profile (shown to trip members) -----
    avatar: { type: String, default: "" }, // 256px JPEG as a data URL (~20-40 KB)
    avatarThumb: { type: String, default: "" }, // 64px version used in lists (~3 KB)
    bio: { type: String, default: "", maxlength: 160 },
    homeCity: { type: String, default: "", maxlength: 80 },
    languages: { type: [String], default: [] },
    food: { type: String, enum: FOOD_OPTIONS, default: "" },
    phone: { type: String, default: "", maxlength: 25 },
    emergencyName: { type: String, default: "", maxlength: 60 },
    emergencyPhone: { type: String, default: "", maxlength: 25 },
    paymentInfo: { type: String, default: "", maxlength: 120 }, // e.g. "Revolut @dp" or "PayPal dp@mail.com"
    onboardedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null }, // account deleted: personal data wiped, login disabled // set when the user finishes or skips the setup wizard
    visibility: {
      phone: { type: String, enum: VISIBILITY, default: "members" },
      emergency: { type: String, enum: VISIBILITY, default: "members" },
      payment: { type: String, enum: VISIBILITY, default: "members" },
    },
  },
  { timestamps: true }
);

/** Fields a trip can require before you join. */
userSchema.methods.missingContact = function () {
  const missing = [];
  if (!this.phone) missing.push("phone");
  if (!this.emergencyName || !this.emergencyPhone) missing.push("emergency");
  return missing;
};

/** What the logged-in user sees about themselves (everything). */
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    avatarThumb: this.avatarThumb,
    bio: this.bio,
    homeCity: this.homeCity,
    languages: this.languages,
    food: this.food,
    phone: this.phone,
    emergencyName: this.emergencyName,
    emergencyPhone: this.emergencyPhone,
    paymentInfo: this.paymentInfo,
    onboardedAt: this.onboardedAt,
    visibility: {
      phone: this.visibility?.phone || "members",
      emergency: this.visibility?.emergency || "members",
      payment: this.visibility?.payment || "members",
    },
  };
};

/** What a trip-mate sees: private fields are hidden. */
userSchema.methods.toTripMate = function () {
  const v = this.visibility || {};
  const show = (key) => (v[key] || "members") === "members";
  return {
    id: this._id.toString(),
    name: this.name,
    avatar: this.avatar,
    avatarThumb: this.avatarThumb,
    bio: this.bio,
    homeCity: this.homeCity,
    languages: this.languages,
    food: this.food,
    phone: show("phone") ? this.phone : "",
    emergencyName: show("emergency") ? this.emergencyName : "",
    emergencyPhone: show("emergency") ? this.emergencyPhone : "",
    paymentInfo: show("payment") ? this.paymentInfo : "",
    memberSince: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
