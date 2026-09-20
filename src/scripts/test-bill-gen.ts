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

async function testWriteWithSession() {
  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const mongoose = (await import("mongoose")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.log("Rohan not found");
    process.exit(1);
  }

  const existingActiveBills = await Bill.find({
    customerId: rohan._id,
    status: { $nin: ["SUPERSEDED", "CANCELLED"] },
  });

  console.log("Found bills:", existingActiveBills.map((b) => b.billNumber));

  let session: any = null;
  let transactionStarted = false;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    transactionStarted = true;
    console.log("Session and transaction started");
  } catch (e: any) {
    console.log("startTransaction error:", e.message);
  }

  try {
    // Attempt write with session
    const res = await Bill.updateOne(
      { _id: existingActiveBills[0]._id },
      { $set: { notes: "test note" } },
      transactionStarted && session ? { session } : undefined
    );
    console.log("UpdateOne with session result:", res);

    if (transactionStarted && session) {
      await session.commitTransaction();
      console.log("Transaction committed successfully");
    }
  } catch (err: any) {
    console.error("Write with session FAILED:", err);
    if (transactionStarted && session) {
      await session.abortTransaction();
    }
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  process.exit(0);
}

testWriteWithSession().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
