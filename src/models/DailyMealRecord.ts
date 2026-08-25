import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDailyMealRecord extends Document {
  customerId: mongoose.Types.ObjectId;
  date: Date; // Normalized to YYYY-MM-DD start of day
  morningMeal: "none" | "half" | "full";
  morningPrice: number; // Price snapshot of full/half tiffin at this time
  nightMeal: "none" | "half" | "full";
  nightPrice: number; // Price snapshot of full/half tiffin at this time
  notes?: string;
  billingStatus?: "UNBILLED" | "BILLED";
  billId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DailyMealRecordSchema = new Schema<IDailyMealRecord>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    date: { type: Date, required: true, index: true },
    morningMeal: { type: String, enum: ["none", "half", "full"], default: "none" },
    morningPrice: { type: Number, required: true, default: 0 },
    nightMeal: { type: String, enum: ["none", "half", "full"], default: "none" },
    nightPrice: { type: Number, required: true, default: 0 },
    notes: { type: String },
    billingStatus: { type: String, enum: ["UNBILLED", "BILLED"], default: "UNBILLED", index: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
  },
  { timestamps: true }
);

// Ensure compound index for unique customer record per day
DailyMealRecordSchema.index({ customerId: 1, date: 1 }, { unique: true });

const DailyMealRecord: Model<IDailyMealRecord> =
  mongoose.models.DailyMealRecord ||
  mongoose.model<IDailyMealRecord>("DailyMealRecord", DailyMealRecordSchema);

export default DailyMealRecord;
