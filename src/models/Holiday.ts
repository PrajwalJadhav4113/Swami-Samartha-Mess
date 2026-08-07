import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHoliday extends Document {
  customerId?: mongoose.Types.ObjectId; // Nullable: if null, applies to ALL customers (shop closed)
  startDate: Date; // Start of holiday
  endDate: Date; // End of holiday (inclusive)
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
  },
  { timestamps: true }
);

const Holiday: Model<IHoliday> =
  mongoose.models.Holiday || mongoose.model<IHoliday>("Holiday", HolidaySchema);

export default Holiday;
