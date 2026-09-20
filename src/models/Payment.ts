import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentAllocation {
  billId: mongoose.Types.ObjectId;
  amountApplied: number;
  appliedAt: Date;
}

export interface IPaymentEditHistory {
  changedBy: string;
  changedAt: Date;
  reason: string;
  oldAmount: number;
  newAmount: number;
  oldPaymentDate?: Date;
  newPaymentDate?: Date;
  oldPaymentMode?: string;
  newPaymentMode?: string;
  oldTransactionReference?: string;
  newTransactionReference?: string;
  oldNotes?: string;
  newNotes?: string;
}

export interface IPayment extends Document {
  customerId: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId; // Nullable, if payment was general account credit rather than specific bill
  amount: number;
  paymentType: "BILL_PAYMENT" | "ADVANCE";
  paymentDate: Date;
  paymentMode: "cash" | "upi" | "bank_transfer" | "other";
  transactionReference?: string;
  notes?: string;
  remainingAmount: number; // Only relevant if paymentType is ADVANCE
  allocations: IPaymentAllocation[];
  editHistory: IPaymentEditHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>({
  billId: { type: Schema.Types.ObjectId, ref: "Bill", required: true },
  amountApplied: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
});

const PaymentEditHistorySchema = new Schema<IPaymentEditHistory>({
  changedBy: { type: String, required: true, default: "Owner" },
  changedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, required: true },
  oldAmount: { type: Number, required: true },
  newAmount: { type: Number, required: true },
  oldPaymentDate: { type: Date },
  newPaymentDate: { type: Date },
  oldPaymentMode: { type: String },
  newPaymentMode: { type: String },
  oldTransactionReference: { type: String },
  newTransactionReference: { type: String },
  oldNotes: { type: String },
  newNotes: { type: String },
});

const PaymentSchema = new Schema<IPayment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentType: { type: String, enum: ["BILL_PAYMENT", "ADVANCE"], default: "BILL_PAYMENT", index: true },
    paymentDate: { type: Date, required: true, default: Date.now, index: true },
    paymentMode: { type: String, enum: ["cash", "upi", "bank_transfer", "other"], required: true },
    transactionReference: { type: String },
    notes: { type: String },
    remainingAmount: { type: Number, default: 0 },
    allocations: { type: [PaymentAllocationSchema], default: [] },
    editHistory: { type: [PaymentEditHistorySchema], default: [] },
  },
  { timestamps: true }
);

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
