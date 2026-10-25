import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  customerId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "bill_generated" | "payment_received" | "general";
  read: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["bill_generated", "payment_received", "general"],
      default: "general",
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
    link: { type: String },
  },
  { timestamps: true }
);

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
