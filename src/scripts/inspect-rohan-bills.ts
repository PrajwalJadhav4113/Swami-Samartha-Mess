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

async function inspectRohan() {
  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan not found!");
    process.exit(1);
  }

  const bills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log(`Found ${bills.length} bills for Rohan Deshmukh:`);
  bills.forEach((b) => {
    console.log({
      id: b._id.toString(),
      billNumber: b.billNumber,
      status: b.status,
      paymentStatus: b.paymentStatus,
      finalTotal: b.finalTotal,
      billingPeriodStart: b.billingPeriodStart ? b.billingPeriodStart.toISOString() : null,
      billingPeriodEnd: b.billingPeriodEnd ? b.billingPeriodEnd.toISOString() : null,
      createdAt: b.createdAt ? b.createdAt.toISOString() : null,
      supersededBy: b.supersededBy ? b.supersededBy.toString() : null,
      supersededAt: b.supersededAt ? b.supersededAt.toISOString() : null,
    });
  });

  process.exit(0);
}

inspectRohan().catch((err) => {
  console.error(err);
  process.exit(1);
});
