import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMealDetail {
  type: "morning_full" | "morning_half" | "night_full" | "night_half";
  quantity: number;
  rate: number;
  amount: number;
}

export interface IExtraItemDetail {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface IBillChangeDetail {
  itemName: string;
  oldQty: number;
  newQty: number;
  oldRate: number;
  newRate: number;
  oldAmount: number;
  newAmount: number;
}

export interface IBillAdjustmentHistory {
  changedBy: string;
  changedAt: Date;
  reason: string;
  originalAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  changes: IBillChangeDetail[];
}

export interface IBill extends Document {
  billNumber: string; // e.g. SSM-202608-0001
  customerId: mongoose.Types.ObjectId;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  mealDetails: IMealDetail[];
  extraItemsDetails: IExtraItemDetail[];
  discount: number;
  advancePayment: number;
  previousBalance: number;
  finalTotal: number;
  originalTotal: number;
  adjustmentAmount: number;
  isAdjusted: boolean;
  adjustmentReason?: string;
  adjustmentHistory: IBillAdjustmentHistory[];
  paymentStatus: "pending" | "paid" | "partially_paid";
  amountPaid: number;
  isCarriedForward: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MealDetailSchema = new Schema<IMealDetail>({
  type: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
});

const ExtraItemDetailSchema = new Schema<IExtraItemDetail>({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
});

const BillChangeDetailSchema = new Schema<IBillChangeDetail>({
  itemName: { type: String, required: true },
  oldQty: { type: Number, required: true },
  newQty: { type: Number, required: true },
  oldRate: { type: Number, required: true },
  newRate: { type: Number, required: true },
  oldAmount: { type: Number, required: true },
  newAmount: { type: Number, required: true },
});

const BillAdjustmentHistorySchema = new Schema<IBillAdjustmentHistory>({
  changedBy: { type: String, required: true },
  changedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, required: true },
  originalAmount: { type: Number, required: true },
  adjustmentAmount: { type: Number, required: true },
  finalAmount: { type: Number, required: true },
  changes: [BillChangeDetailSchema],
});

const BillSchema = new Schema<IBill>(
  {
    billNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    mealDetails: [MealDetailSchema],
    extraItemsDetails: [ExtraItemDetailSchema],
    discount: { type: Number, required: true, default: 0 },
    advancePayment: { type: Number, required: true, default: 0 },
    previousBalance: { type: Number, required: true, default: 0 },
    finalTotal: { type: Number, required: true },
    originalTotal: { type: Number, required: true, default: 0 },
    adjustmentAmount: { type: Number, required: true, default: 0 },
    isAdjusted: { type: Boolean, required: true, default: false },
    adjustmentReason: { type: String },
    adjustmentHistory: { type: [BillAdjustmentHistorySchema], default: [] },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "partially_paid"],
      default: "pending",
      index: true,
    },
    amountPaid: { type: Number, required: true, default: 0 },
    isCarriedForward: { type: Boolean, required: true, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

const Bill: Model<IBill> = mongoose.models.Bill || mongoose.model<IBill>("Bill", BillSchema);

export default Bill;
