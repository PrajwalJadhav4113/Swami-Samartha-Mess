import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  photo?: string; // base64 representation of image or url
  mobile: string;
  address: string;
  username: string;
  passwordHash: string; // hashed password for customer login
  joiningDate: Date;
  status: "active" | "inactive";
  notes?: string;
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
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
