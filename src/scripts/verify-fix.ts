import fs from "fs";
import path from "path";

// Load .env.local synchronously
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
  console.log("Starting Verification Tests...");
  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan Deshmukh customer record not found!");
    process.exit(1);
  }

  console.log(`Found Customer Rohan Deshmukh (ID: ${rohan._id})`);

  // 1. Verify status of 0017, 0018, 0019
  const bill17 = await Bill.findOne({ billNumber: "SSM-202609-0017" });
  const bill18 = await Bill.findOne({ billNumber: "SSM-202609-0018" });
  const bill19 = await Bill.findOne({ billNumber: "SSM-202609-0019" });

  console.log("Bill Status Checks:");
  if (bill17) console.log(`  SSM-202609-0017 Status: ${bill17.status} (Expected: SUPERSEDED)`);
  if (bill18) console.log(`  SSM-202609-0018 Status: ${bill18.status} (Expected: SUPERSEDED)`);
  if (bill19) console.log(`  SSM-202609-0019 Status: ${bill19.status} (Expected: ACTIVE)`);

  const activeBillsForPeriod = await Bill.find({
    customerId: rohan._id,
    billingPeriodStart: { $lte: new Date("2026-09-30T00:00:00.000Z") },
    billingPeriodEnd: { $gte: new Date("2026-09-01T00:00:00.000Z") },
    status: { $nin: ["SUPERSEDED", "CANCELLED"] },
  });

  console.log(`Active bills count for Rohan in Sep 2026: ${activeBillsForPeriod.length} (Expected: 1)`);

  if (
    bill17?.status === "SUPERSEDED" &&
    bill18?.status === "SUPERSEDED" &&
    bill19?.status === "ACTIVE" &&
    activeBillsForPeriod.length === 1
  ) {
    console.log("SUCCESS: All verification checks passed!");
  } else {
    console.error("FAILURE: Some verification checks failed!");
    process.exit(1);
  }

  process.exit(0);
}

verifyFix().catch((err) => {
  console.error("Verification Error:", err);
  process.exit(1);
});
