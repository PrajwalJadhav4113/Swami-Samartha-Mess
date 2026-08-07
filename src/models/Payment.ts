import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPayment extends Document {
  customerId: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId; // Nullable, if payment was general account credit rather than specific bill
  amount: number;
  paymentDate: Date;
  paymentMode: "cash" | "upi" | "bank_transfer";
  transactionReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true, default: Date.now, index: true },
    paymentMode: { type: String, enum: ["cash", "upi", "bank_transfer"], required: true },
    transactionReference: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
