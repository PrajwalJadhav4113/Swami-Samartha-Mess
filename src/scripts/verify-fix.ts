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

  // 1. Check statuses of bills 0017 - 0021
  const bill17 = await Bill.findOne({ billNumber: "SSM-202609-0017" });
  const bill18 = await Bill.findOne({ billNumber: "SSM-202609-0018" });
  const bill19 = await Bill.findOne({ billNumber: "SSM-202609-0019" });
  const bill20 = await Bill.findOne({ billNumber: "SSM-202609-0020" });
  const bill21 = await Bill.findOne({ billNumber: "SSM-202609-0021" });

  console.log("\nBill Status Checks:");
  if (bill17) console.log(`  SSM-202609-0017 Status: ${bill17.status} (Expected: SUPERSEDED)`);
  if (bill18) console.log(`  SSM-202609-0018 Status: ${bill18.status} (Expected: SUPERSEDED)`);
  if (bill19) console.log(`  SSM-202609-0019 Status: ${bill19.status} (Expected: SUPERSEDED)`);
  if (bill20) console.log(`  SSM-202609-0020 Status: ${bill20.status} (Expected: SUPERSEDED)`);
  if (bill21) console.log(`  SSM-202609-0021 Status: ${bill21.status} (Expected: ACTIVE)`);

  const activeBillsForPeriod = await Bill.find({
    customerId: rohan._id,
    billingPeriodStart: { $lte: new Date("2026-09-30T23:59:59.999Z") },
    billingPeriodEnd: { $gte: new Date("2026-09-01T00:00:00.000Z") },
    status: { $nin: ["SUPERSEDED", "CANCELLED"] },
  });

  console.log(`\nActive bills count for Rohan in Sep 2026: ${activeBillsForPeriod.length} (Expected: 1)`);

  // 2. Check Date Formatting for customer-facing billing period
  if (bill21) {
    const formattedRange = formatBillingPeriod(bill21.billingPeriodStart, bill21.billingPeriodEnd);
    console.log(`\nCustomer-facing Date Range Display Test:`);
    console.log(`  Raw start: ${bill21.billingPeriodStart.toISOString()}`);
    console.log(`  Raw end:   ${bill21.billingPeriodEnd.toISOString()}`);
    console.log(`  Formatted display: ${formattedRange} (Expected: 01/09/2026 – 30/09/2026)`);

    if (formattedRange !== "01/09/2026 – 30/09/2026") {
      console.error("FAILURE: Date range formatting did not output 01/09/2026 – 30/09/2026!");
      process.exit(1);
    }
  }

  // 3. Outstanding calculation for Rohan
  const outstandingSum = activeBillsForPeriod.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);
  console.log(`\nTotal Outstanding for Rohan across active bills: ₹${outstandingSum} (Expected: ₹292)`);

  if (
    bill17?.status === "SUPERSEDED" &&
    bill18?.status === "SUPERSEDED" &&
    bill19?.status === "SUPERSEDED" &&
    bill20?.status === "SUPERSEDED" &&
    bill21?.status === "ACTIVE" &&
    activeBillsForPeriod.length === 1 &&
    outstandingSum === 292
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
