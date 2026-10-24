import fs from "fs";
import path from "path";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

async function main() {
  const { connectToDatabase } = await import("../src/lib/db");
  const Customer = (await import("../src/models/Customer")).default;
  const Payment = (await import("../src/models/Payment")).default;
  const Bill = (await import("../src/models/Bill")).default;
  const mongoose = (await import("mongoose")).default;

  await connectToDatabase();

  const ganesh = await Customer.findOne({ name: { $regex: /Ganesh/i } });
  if (!ganesh) {
    console.log("Ganesh not found");
    await mongoose.disconnect();
    return;
  }

  const payments = await Payment.find({ customerId: ganesh._id }).sort({ paymentDate: 1 });
  const bills = await Bill.find({ customerId: ganesh._id }).sort({ createdAt: 1 });

  const result = {
    customer: {
      id: ganesh._id.toString(),
      name: ganesh.name,
      advanceBalance: ganesh.advanceBalance,
    },
    payments: payments.map((p) => ({
      id: p._id.toString(),
      amount: p.amount,
      paymentType: p.paymentType,
      paymentDate: p.paymentDate,
      billId: p.billId?.toString() || null,
      remainingAmount: p.remainingAmount,
      allocations: p.allocations,
    })),
    bills: bills.map((b) => ({
      id: b._id.toString(),
      billNumber: b.billNumber,
      status: b.status,
      supersededBy: b.supersededBy?.toString() || null,
      billingPeriodStart: b.billingPeriodStart,
      billingPeriodEnd: b.billingPeriodEnd,
      finalTotal: b.finalTotal,
      advancePayment: b.advancePayment,
      amountPaid: b.amountPaid,
      paymentStatus: b.paymentStatus,
    })),
  };

  fs.writeFileSync(path.join(__dirname, "ganesh_output.json"), JSON.stringify(result, null, 2));
  console.log("Wrote output to ganesh_output.json successfully!");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
