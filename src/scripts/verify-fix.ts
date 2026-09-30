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

async function verifyFix() {
  console.log("Starting Comprehensive Verification Tests...");

  const { connectToDatabase } = await import("../lib/db");
  const { formatBillingPeriod, formatDateUTC } = await import("../lib/date-utils");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan Deshmukh customer record not found!");
    process.exit(1);
  }

  console.log(`Found Customer Rohan Deshmukh (ID: ${rohan._id})`);

  // 1. Check that all older bills are SUPERSEDED and only the latest bill is ACTIVE
  const allBills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log("\nBill Status Checks:");
  allBills.forEach((b) => {
    console.log(`  ${b.billNumber} Status: ${b.status}`);
  });

  const activeBillsForPeriod = await Bill.find({
    customerId: rohan._id,
    billingPeriodStart: { $lte: new Date("2026-09-30T23:59:59.999Z") },
    billingPeriodEnd: { $gte: new Date("2026-09-01T00:00:00.000Z") },
    status: { $nin: ["SUPERSEDED", "CANCELLED"] },
  });

  console.log(`\nActive bills count for Rohan in Sep 2026: ${activeBillsForPeriod.length} (Expected: 1)`);

  const latestBill = activeBillsForPeriod[0];

  // 2. Check Date Formatting for customer-facing billing period
  if (latestBill) {
    const formattedRange = formatBillingPeriod(latestBill.billingPeriodStart, latestBill.billingPeriodEnd);
    console.log(`\nCustomer-facing Date Range Display Test:`);
    console.log(`  Raw start: ${latestBill.billingPeriodStart.toISOString()}`);
    console.log(`  Raw end:   ${latestBill.billingPeriodEnd.toISOString()}`);
    console.log(`  Formatted display: ${formattedRange} (Expected: 01/09/2026 – 30/09/2026)`);

    if (formattedRange !== "01/09/2026 – 30/09/2026") {
      console.error("FAILURE: Date range formatting did not output 01/09/2026 – 30/09/2026!");
      process.exit(1);
    }
  }

  // 3. Outstanding calculation for Rohan
  const outstandingSum = activeBillsForPeriod.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);
  console.log(`\nTotal Outstanding for Rohan across active bills: ₹${outstandingSum}`);

  // 4. Verify Customer Advance Credit Balance
  const Payment = (await import("../models/Payment")).default;
  const advancePayments = await Payment.find({ customerId: rohan._id, paymentType: "ADVANCE" });
  const totalAvailableAdvance = advancePayments.reduce((sum, p) => sum + (p.remainingAmount ?? 0), 0);
  console.log(`Total Available Advance Credit for Rohan: ₹${totalAvailableAdvance} (Expected: ₹0, since ₹1 was applied)`);

  if (
    activeBillsForPeriod.length === 1 &&
    totalAvailableAdvance === 0 &&
    allBills.filter((b) => b._id.toString() !== latestBill?._id.toString()).every((b) => b.status === "SUPERSEDED")
  ) {
    console.log("\n==========================================");
    console.log("SUCCESS: ALL VERIFICATION CHECKS PASSED!");
    console.log("==========================================");
  } else {
    console.error("\n==========================================");
    console.error("FAILURE: Some verification checks failed!");
    console.error("==========================================");
    process.exit(1);
  }

  process.exit(0);
}

verifyFix().catch((err) => {
  console.error("Verification Error:", err);
  process.exit(1);
});
