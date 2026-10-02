import mongoose from "mongoose";

const { Schema } = mongoose;

// A trip cover the owner uploaded. Kept out of the Trip document so loading a trip
// never pulls ~200 KB of image data. One per trip; `key` changes on every upload,
// so the image URL can be cached forever by browsers.
const coverImageSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true, unique: true },
    key: { type: String, required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const CoverImage = mongoose.model("CoverImage", coverImageSchema);
