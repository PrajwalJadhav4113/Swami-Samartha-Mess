import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  photo?: string; // base64 representation of image or url
  mobile: string;
  address: string;
  username: string;
  passwordHash: string; // hashed password for customer login
  joiningDate: Date;
  status: "pending" | "active" | "inactive" | "rejected";
  advanceBalance: number;
  defaultRate?: number;
  fixedDiscount: number;
  dietPreference?: "veg" | "both";
  notes?: string;
  pricingType: "standard" | "special";
  specialPrices?: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true },
    photo: { type: String },
    mobile: { type: String, required: true },
    address: { type: String, required: true },
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    joiningDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["pending", "active", "inactive", "rejected"], default: "pending", index: true },
    advanceBalance: { type: Number, default: 0 },
    defaultRate: { type: Number, default: null },
    fixedDiscount: { type: Number, default: 0 },
    dietPreference: { type: String, enum: ["veg", "both"], default: "both" },
    notes: { type: String },
    pricingType: { type: String, enum: ["standard", "special"], default: "standard", index: true },
    specialPrices: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
