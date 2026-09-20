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

async function cleanupV2() {
  console.log("==========================================");
  console.log("Starting Rohan Bills Cleanup V2...");
  console.log("==========================================");

  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const DailyMealItem = (await import("../models/DailyMealItem")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan Deshmukh customer not found!");
    process.exit(1);
  }

  console.log(`Found Customer Rohan Deshmukh (ID: ${rohan._id})`);

  // Target latest bill: SSM-202609-0021 (₹293)
  const bill21 = await Bill.findOne({ billNumber: "SSM-202609-0021" });
  if (!bill21) {
    console.error("Bill SSM-202609-0021 not found!");
    process.exit(1);
  }

  console.log(`Active Target Bill: ${bill21.billNumber} (ID: ${bill21._id}, Total: ₹${bill21.finalTotal})`);

  // Mark all older bills (0017, 0018, 0019, 0020) as SUPERSEDED by 0021
  const olderBills = await Bill.find({
    customerId: rohan._id,
    billNumber: { $in: ["SSM-202609-0017", "SSM-202609-0018", "SSM-202609-0019", "SSM-202609-0020"] },
  });

  const olderBillIds = olderBills.map((b) => b._id);

  for (const older of olderBills) {
    console.log(`Marking ${older.billNumber} (ID: ${older._id}) -> SUPERSEDED by ${bill21.billNumber}`);
    older.status = "SUPERSEDED";
    older.supersededBy = bill21._id;
    older.supersededAt = new Date();
    await older.save();
  }

  // Ensure bill 0021 is ACTIVE
  bill21.status = "ACTIVE";
  bill21.supersededBy = null;
  bill21.supersededAt = null;
  bill21.amountPaid = 1; // Preserve the ₹1 payment
  bill21.paymentStatus = "partially_paid";
  await bill21.save();

  // Re-associate payments to 0021
  if (olderBillIds.length > 0) {
    await Payment.updateMany(
      { billId: { $in: olderBillIds } },
      { $set: { billId: bill21._id } }
    );

    await Payment.updateMany(
      { "allocations.billId": { $in: olderBillIds } },
      { $set: { "allocations.$[elem].billId": bill21._id } },
      { arrayFilters: [{ "elem.billId": { $in: olderBillIds } }] }
    );
  }

  // Re-associate September 2026 meals and extra items to 0021
  const start = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-09-30T23:59:59.999Z");

  await DailyMealRecord.updateMany(
    { customerId: rohan._id, date: { $gte: start, $lte: end } },
    { $set: { billingStatus: "BILLED", billId: bill21._id } }
  );

  await DailyMealItem.updateMany(
    { customerId: rohan._id, date: { $gte: start, $lte: end } },
    { $set: { billingStatus: "BILLED", billId: bill21._id } }
  );

  // Print final status of Rohan's bills in DB
  const finalBills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log("\n==========================================");
  console.log("Post-Cleanup Rohan Bills Status:");
  console.log("==========================================");
  finalBills.forEach((b) => {
    const due = b.status === "ACTIVE" ? b.finalTotal - b.amountPaid : 0;
    console.log(` - ${b.billNumber}: status=${b.status}, total=₹${b.finalTotal}, paid=₹${b.amountPaid}, due=₹${due}`);
  });

  const activeBills = finalBills.filter((b) => b.status === "ACTIVE");
  console.log(`\nActive Bills Count: ${activeBills.length}`);

  if (activeBills.length === 1 && activeBills[0].billNumber === "SSM-202609-0021") {
    console.log("SUCCESS: Only SSM-202609-0021 is ACTIVE for Rohan Deshmukh!");
  } else {
    console.error("FAILURE: Cleanup did not result in exactly 1 active bill.");
    process.exit(1);
  }

  process.exit(0);
}

cleanupV2().catch((err) => {
  console.error("Cleanup Error:", err);
  process.exit(1);
});
