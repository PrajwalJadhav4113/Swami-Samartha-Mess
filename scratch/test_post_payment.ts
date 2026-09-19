import mongoose from "mongoose";
import Customer from "../src/models/Customer";
import Payment from "../src/models/Payment";
import fs from "fs";
import path from "path";

// Load environment variables
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.substring(0, eqIdx).trim();
        const value = line.substring(eqIdx + 1).trim();
        if (key && !key.startsWith("#")) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/swami-samartha-mess";

async function test() {
  console.log("Connecting to DB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  // Find any customer
  const customer = await Customer.findOne();
  if (!customer) {
    console.error("No customer found in database to run diagnostic test.");
    await mongoose.disconnect();
    return;
  }

  try {
    console.log("Attempting to create general/advance payment...");
    const payment = await Payment.create({
      customerId: customer._id,
      billId: null,
      amount: 100,
      paymentType: "ADVANCE",
      paymentDate: new Date(),
      paymentMode: "upi",
      remainingAmount: 100,
      allocations: []
    });
    console.log("Payment created successfully:", payment);
    
    // Clean up
    await Payment.findByIdAndDelete(payment._id);
  } catch (err: any) {
    console.error("ERROR CREATING PAYMENT:");
    console.error(err);
  }

  await mongoose.disconnect();
}

test().catch(console.error);
