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

async function cleanupRohanBills() {
  console.log("Starting Rohan Deshmukh Duplicate Bills Cleanup...");

  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const DailyMealItem = (await import("../models/DailyMealItem")).default;
  const Payment = (await import("../models/Payment")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan Deshmukh customer record not found!");
    process.exit(1);
  }

  console.log(`Found Rohan Deshmukh (ID: ${rohan._id})`);

  const bill20 = await Bill.findOne({ billNumber: "SSM-202609-0020" });
  if (!bill20) {
    console.error("Bill SSM-202609-0020 not found!");
    process.exit(1);
  }

  console.log(`Active Target Bill: ${bill20.billNumber} (ID: ${bill20._id})`);

  // Ensure bill 0020 is ACTIVE
  bill20.status = "ACTIVE";
  bill20.supersededBy = null;
  bill20.supersededAt = null;
  await bill20.save();

  const olderBills = await Bill.find({
    customerId: rohan._id,
    billNumber: { $in: ["SSM-202609-0017", "SSM-202609-0018", "SSM-202609-0019"] },
  });

  const olderBillIds = olderBills.map((b) => b._id);

  for (const olderBill of olderBills) {
    console.log(`Marking ${olderBill.billNumber} (ID: ${olderBill._id}) as SUPERSEDED by ${bill20.billNumber}`);
    olderBill.status = "SUPERSEDED";
    olderBill.supersededBy = bill20._id;
    olderBill.supersededAt = new Date();
    await olderBill.save();
  }

  // Update payments attached to older bills to point to bill 0020
  if (olderBillIds.length > 0) {
    const payRes1 = await Payment.updateMany(
      { billId: { $in: olderBillIds } },
      { $set: { billId: bill20._id } }
    );
    console.log("Updated Payments billId reference count:", payRes1.modifiedCount);

    const payRes2 = await Payment.updateMany(
      { "allocations.billId": { $in: olderBillIds } },
      { $set: { "allocations.$[elem].billId": bill20._id } },
      { arrayFilters: [{ "elem.billId": { $in: olderBillIds } }] }
    );
    console.log("Updated Payment allocations reference count:", payRes2.modifiedCount);
  }

  // Re-associate meals & extras for Sept 2026 to bill 0020
  const start = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-09-30T23:59:59.999Z");

  await DailyMealRecord.updateMany(
    { customerId: rohan._id, date: { $gte: start, $lte: end } },
    { $set: { billingStatus: "BILLED", billId: bill20._id } }
  );

  await DailyMealItem.updateMany(
    { customerId: rohan._id, date: { $gte: start, $lte: end } },
    { $set: { billingStatus: "BILLED", billId: bill20._id } }
  );

  // Verify status in DB
  const allRohanBills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log("\nPost-Cleanup Rohan Bills Status:");
  allRohanBills.forEach((b) => {
    console.log(` - ${b.billNumber}: status=${b.status}, supersededBy=${b.supersededBy}`);
  });

  const activeBills = allRohanBills.filter((b) => b.status === "ACTIVE");
  console.log(`Total ACTIVE bills for Rohan: ${activeBills.length}`);

  if (activeBills.length === 1 && activeBills[0].billNumber === "SSM-202609-0020") {
    console.log("CLEANUP SUCCESSFUL! Only SSM-202609-0020 is ACTIVE.");
  } else {
    console.error("CLEANUP WARNING: Expected exactly 1 active bill (0020).");
  }

  process.exit(0);
}

cleanupRohanBills().catch((err) => {
  console.error("Cleanup Error:", err);
  process.exit(1);
});
