import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISetting extends Document {
  messName: string;
  address: string;
  contactNumber: string;
  logo?: string; // base64 representation of image
  upiId?: string; // e.g. upi-id@bank
  upiQrCode?: string; // base64 representation of QR image
  theme: "light" | "dark";
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    messName: { type: String, required: true, default: "Swami Samartha Mess" },
    address: { type: String, required: true, default: "123, Main Street, Pune, Maharashtra" },
    contactNumber: { type: String, required: true, default: "+91 9876543210" },
    logo: { type: String },
    upiId: { type: String, default: "" },
    upiQrCode: { type: String }, // base64 image string
    theme: { type: String, enum: ["light", "dark"], default: "light" },
  },
  { timestamps: true }
);

const Setting: Model<ISetting> =
  mongoose.models.Setting || mongoose.model<ISetting>("Setting", SettingSchema);

export default Setting;
