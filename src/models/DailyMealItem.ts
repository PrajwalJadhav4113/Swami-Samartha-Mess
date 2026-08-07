import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDailyMealItem extends Document {
  customerId: mongoose.Types.ObjectId;
  date: Date; // Normalized to YYYY-MM-DD
  menuItemId: mongoose.Types.ObjectId;
  name: string; // Historical snapshot name
  price: number; // Historical snapshot price
  quantity: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyMealItemSchema = new Schema<IDailyMealItem>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    date: { type: Date, required: true, index: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String },
  },
  { timestamps: true }
);

// Optional: compound index for efficient searches
DailyMealItemSchema.index({ customerId: 1, date: 1 });

const DailyMealItem: Model<IDailyMealItem> =
  mongoose.models.DailyMealItem ||
  mongoose.model<IDailyMealItem>("DailyMealItem", DailyMealItemSchema);

export default DailyMealItem;
