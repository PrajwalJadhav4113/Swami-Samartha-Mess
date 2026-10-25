import fs from "fs";
import path from "path";

// 1. Read .env.local synchronously BEFORE importing db helper
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

async function runMigration() {
  console.log("Starting Migration: Supersede Old Duplicate Bills...");
  console.log("Connecting to MongoDB URI:", process.env.MONGODB_URI ? "URI Loaded Successfully" : "Fallback URI");

  // Dynamically import DB and models after process.env is set
  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const DailyMealItem = (await import("../models/DailyMealItem")).default;
  const Payment = (await import("../models/Payment")).default;

  await connectToDatabase();

  const customers = await Customer.find();
  console.log(`Found ${customers.length} total customers.`);

  let totalSuperseded = 0;

  for (const customer of customers) {
    // Fetch all active non-cancelled bills for this customer
    const activeBills = await Bill.find({
      customerId: customer._id,
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
    }).sort({ createdAt: -1 });

    // Group bills by date key: YYYY-MM-DD to YYYY-MM-DD
    const periodGroups = new Map<string, typeof activeBills>();

    activeBills.forEach((b) => {
      const pStart = new Date(b.billingPeriodStart).toISOString().split("T")[0];
      const pEnd = new Date(b.billingPeriodEnd).toISOString().split("T")[0];
      const key = `${pStart}_${pEnd}`;

      if (!periodGroups.has(key)) {
        periodGroups.set(key, []);
      }
      periodGroups.get(key)!.push(b);
    });

    for (const [periodKey, bills] of periodGroups.entries()) {
      if (bills.length > 1) {
        console.log(`Customer: ${customer.name} | Period: ${periodKey} has ${bills.length} active bills.`);

        // The newest bill is bills[0] (due to createdAt: -1 sort)
        const newestBill = bills[0];
        const olderBills = bills.slice(1);

        console.log(`  Current/Newest Bill: ${newestBill.billNumber} (ID: ${newestBill._id})`);

        for (const olderBill of olderBills) {
          console.log(`  -> Marking SUPERSEDED: ${olderBill.billNumber} (ID: ${olderBill._id})`);

          olderBill.status = "SUPERSEDED";
          olderBill.supersededBy = newestBill._id;
          olderBill.supersededAt = new Date();
          await olderBill.save();

          totalSuperseded++;

          // Update payments pointing to older bill
          await Payment.updateMany(
            { billId: olderBill._id },
            { $set: { billId: newestBill._id } }
          );

          await Payment.updateMany(
            { "allocations.billId": olderBill._id },
            { $set: { "allocations.$[elem].billId": newestBill._id } },
            { arrayFilters: [{ "elem.billId": olderBill._id }] }
          );
        }

        // Reassign all meal records and extra items in period to newestBill
        const start = new Date(newestBill.billingPeriodStart);
        const end = new Date(newestBill.billingPeriodEnd);

        await DailyMealRecord.updateMany(
          { customerId: customer._id, date: { $gte: start, $lte: end } },
          { $set: { billingStatus: "BILLED", billId: newestBill._id } }
        );

        await DailyMealItem.updateMany(
          { customerId: customer._id, date: { $gte: start, $lte: end } },
          { $set: { billingStatus: "BILLED", billId: newestBill._id } }
        );
      }
    }
  }

  console.log(`Migration Complete! Total older bills marked SUPERSEDED: ${totalSuperseded}`);
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration Error:", err);
  process.exit(1);
});
