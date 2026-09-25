import mongoose from "mongoose";

const { Schema } = mongoose;

const expenseSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    kind: { type: String, enum: ["expense", "settlement"], default: "expense" },
    description: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, default: "other" },
    // What was actually paid, in the currency it was paid in (minor units)
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
    // Exchange rate saved at the moment of the expense: 1 unit of `currency` = rate units of trip currency
    rate: { type: Number, required: true, default: 1 },
    // Same amount converted into the trip currency (minor units). Balances use this.
    amountBase: { type: Number, required: true, min: 1 },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Who owes what, in trip currency minor units. Shares always add up to amountBase.
    splits: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        share: { type: Number, required: true, min: 0 },
      },
    ],
    date: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Expense = mongoose.model("Expense", expenseSchema);
