import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      process.env[key.trim()] = values.join("=").trim();
    }
  }
}

async function simulatePost() {
  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const DailyMealItem = (await import("../models/DailyMealItem")).default;
  const Payment = (await import("../models/Payment")).default;
  const mongoose = (await import("mongoose")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.log("Rohan not found");
    process.exit(1);
  }

  const customerId = rohan._id.toString();
  const startDate = "2026-09-01";
  const endDate = "2026-09-30";

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  console.log("Step 1: Finding existing active bills...");
  const existingActiveBills = await Bill.find({
    customerId,
    billingPeriodStart: { $lte: end },
    billingPeriodEnd: { $gte: start },
    status: { $nin: ["SUPERSEDED", "CANCELLED"] },
  }).sort({ billingPeriodStart: 1 });

  console.log("Found existing active bills:", existingActiveBills.map((b) => ({ id: b._id.toString(), num: b.billNumber, status: b.status })));

  const olderBillIds = existingActiveBills.map((b) => b._id);
  console.log("olderBillIds to mark SUPERSEDED:", olderBillIds);

  const billsCount = await Bill.countDocuments();
  const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

  const bill = new Bill({
    billNumber,
    customerId,
    billingPeriodStart: start,
    billingPeriodEnd: end,
    mealDetails: [],
    extraItemsDetails: [],
    discount: 0,
    advancePayment: 0,
    previousBalance: 0,
    finalTotal: 250,
    originalTotal: 250,
    adjustmentAmount: 0,
    paymentStatus: "pending",
    status: "ACTIVE",
    amountPaid: 0,
    isCarriedForward: false,
    notes: "Test simulation bill",
  });

  let session: any = null;
  let transactionStarted = false;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    transactionStarted = true;
    console.log("Started MongoDB session and transaction.");
  } catch (e: any) {
    console.log("Session/transaction init failed:", e.message);
  }

  try {
    await bill.save(transactionStarted && session ? { session } : undefined);
    console.log(`Saved new bill ${bill.billNumber} with ID ${bill._id}`);

    if (olderBillIds.length > 0) {
      console.log(`Executing updateMany for older bill IDs:`, olderBillIds);
      const updateResult = await Bill.updateMany(
        { _id: { $in: olderBillIds } },
        {
          $set: {
            status: "SUPERSEDED",
            supersededBy: bill._id,
            supersededAt: new Date(),
          },
        },
        transactionStarted && session ? { session } : undefined
      );
      console.log("UpdateMany result:", updateResult);
    }

    if (transactionStarted && session) {
      await session.commitTransaction();
      console.log("Transaction committed!");
    }
  } catch (err: any) {
    console.error("Simulation error during save/updateMany:", err);
    if (transactionStarted && session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  // Verify status of all Rohan's bills after simulation
  const allBills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log("\nDB Status After Simulation:");
  allBills.forEach((b) => console.log(` - ${b.billNumber}: status=${b.status}, supersededBy=${b.supersededBy}`));

  // Clean up the test simulation bill (so we don't leave fake test bill in DB)
  await Bill.deleteOne({ _id: bill._id });
  console.log(`Cleaned up temporary test bill ${bill.billNumber}`);

  process.exit(0);
}

simulatePost().catch((err) => {
  console.error("Sim Error:", err);
  process.exit(1);
});
