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

async function inspectGanesh() {
  const { connectToDatabase } = await import("../lib/db");
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;
  const Bill = (await import("../models/Bill")).default;

  await connectToDatabase();

  const ganesh = await Customer.findOne({ name: { $regex: /Ganesh/i } });
  if (!ganesh) {
    console.error("Ganesh not found");
    const allC = await Customer.find({});
    console.log("All customers:", allC.map(c => c.name));
    process.exit(1);
  }

  console.log("Ganesh Customer Record:", {
    id: ganesh._id.toString(),
    name: ganesh.name,
    advanceBalance: ganesh.advanceBalance,
  });

  const payments = await Payment.find({ customerId: ganesh._id });
  console.log("\nPayments:");
  payments.forEach(p => console.log({
    id: p._id.toString(),
    paymentType: p.paymentType,
    amount: p.amount,
    remainingAmount: p.remainingAmount,
    billId: p.billId,
    allocations: p.allocations
  }));

  const bills = await Bill.find({ customerId: ganesh._id });
  console.log("\nBills:");
  bills.forEach(b => console.log({
    id: b._id.toString(),
    billNumber: b.billNumber,
    billingPeriodStart: b.billingPeriodStart,
    billingPeriodEnd: b.billingPeriodEnd,
    finalTotal: b.finalTotal,
    advancePayment: b.advancePayment,
    amountPaid: b.amountPaid,
    status: b.status,
    paymentStatus: b.paymentStatus
  }));

  process.exit(0);
}

inspectGanesh().catch(err => {
  console.error(err);
  process.exit(1);
});
