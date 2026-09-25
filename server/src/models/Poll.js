import mongoose from "mongoose";

const { Schema } = mongoose;

const pollSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    question: { type: String, required: true, trim: true, maxlength: 150 },
    options: [
      {
        _id: false,
        text: { type: String, required: true, trim: true, maxlength: 80 },
        votes: [{ type: Schema.Types.ObjectId, ref: "User" }],
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closed: { type: Boolean, default: false },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Poll = mongoose.model("Poll", pollSchema);
