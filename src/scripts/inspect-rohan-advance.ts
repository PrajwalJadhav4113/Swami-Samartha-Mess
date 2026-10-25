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

async function inspectAdvance() {
  const { connectToDatabase } = await import("../lib/db");
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan not found!");
    process.exit(1);
  }

  console.log("Customer Record:");
  console.log({
    id: rohan._id.toString(),
    name: rohan.name,
    advanceBalance: rohan.advanceBalance,
  });

  const payments = await Payment.find({ customerId: rohan._id }).sort({ paymentDate: 1 });
  console.log(`\nFound ${payments.length} payment records for Rohan:`);
  payments.forEach((p) => {
    console.log({
      id: p._id.toString(),
      paymentType: p.paymentType,
      amount: p.amount,
      remainingAmount: p.remainingAmount,
      billId: p.billId ? p.billId.toString() : null,
      allocations: p.allocations,
      paymentMode: p.paymentMode,
      paymentDate: p.paymentDate,
    });
  });

  process.exit(0);
}

inspectAdvance().catch((err) => {
  console.error("Inspect error:", err);
  process.exit(1);
});
