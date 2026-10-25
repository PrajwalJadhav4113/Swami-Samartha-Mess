import fs from "fs";
import path from "path";

// Load .env.local before imports
const envPath = path.join(__dirname, "../../.env.local");
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

async function reconcileGanesh() {
  const { connectToDatabase } = await import("../lib/db");
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;
  const Bill = (await import("../models/Bill")).default;
  const mongoose = (await import("mongoose")).default;
  const { syncCustomerAdvanceBalance } = await import("../lib/billing-helper");

  await connectToDatabase();

  const ganesh = await Customer.findOne({ name: { $regex: /Ganesh/i } });
  if (!ganesh) {
    console.log("Customer Ganesh not found.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Reconciling data for customer Ganesh (${ganesh._id})...`);

  // Find current ACTIVE bill for Ganesh
  const activeBill = await Bill.findOne({
    customerId: ganesh._id,
    status: "ACTIVE",
  });

  if (!activeBill) {
    console.log("No ACTIVE bill found for Ganesh.");
  } else {
    console.log(`Found active bill: ${activeBill.billNumber}, finalTotal: ₹${activeBill.finalTotal}, current advancePayment: ₹${activeBill.advancePayment}`);

    // Fetch all ADVANCE payments for Ganesh sorted by paymentDate
    const advancePayments = await Payment.find({
      customerId: ganesh._id,
      paymentType: "ADVANCE",
    }).sort({ paymentDate: 1 });

    const totalAdvanceReceived = advancePayments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`Total Advance Credit Payments received: ₹${totalAdvanceReceived}`);

    // First clear any existing allocations to active bill to re-allocate cleanly
    for (const adv of advancePayments) {
      adv.allocations = adv.allocations.filter((a: any) => a.billId.toString() !== activeBill._id.toString());
      adv.remainingAmount = adv.amount; // reset remaining to original amount
    }

    // Determine subtotal before advance for active bill
    const grossConsumptionAndPrev = activeBill.mealDetails.reduce((s: number, m: any) => s + m.amount, 0)
      + activeBill.extraItemsDetails.reduce((s: number, e: any) => s + e.amount, 0)
      + activeBill.previousBalance;
    const subtotalAfterDiscount = Math.max(0, grossConsumptionAndPrev - activeBill.discount);

    const advanceToApply = Math.min(totalAdvanceReceived, subtotalAfterDiscount);
    console.log(`Subtotal after discount: ₹${subtotalAfterDiscount}. Re-allocating advance: ₹${advanceToApply}`);

    let creditNeeded = advanceToApply;
    for (const adv of advancePayments) {
      if (creditNeeded <= 0) break;
      const toAllocate = Math.min(adv.remainingAmount, creditNeeded);
      adv.remainingAmount -= toAllocate;
      adv.allocations.push({
        billId: activeBill._id,
        amountApplied: toAllocate,
        appliedAt: new Date(),
      });
      await adv.save();
      creditNeeded -= toAllocate;
      console.log(`Allocated ₹${toAllocate} from payment ${adv._id} (rem: ₹${adv.remainingAmount}) to ${activeBill.billNumber}`);
    }

    // Update active bill document
    activeBill.advancePayment = advanceToApply;
    activeBill.finalTotal = Math.max(0, subtotalAfterDiscount - advanceToApply);
    if (activeBill.amountPaid >= activeBill.finalTotal || activeBill.finalTotal === 0) {
      activeBill.paymentStatus = "paid";
    } else if (activeBill.amountPaid > 0) {
      activeBill.paymentStatus = "partially_paid";
    } else {
      activeBill.paymentStatus = "pending";
    }
    await activeBill.save();
    console.log(`Updated Bill ${activeBill.billNumber}: finalTotal = ₹${activeBill.finalTotal}, advancePayment = ₹${activeBill.advancePayment}, paymentStatus = ${activeBill.paymentStatus}`);
  }

  // Authoritative sync of Ganesh's advance balance
  const availableCredit = await syncCustomerAdvanceBalance(ganesh._id.toString());
  console.log(`Authoritative Available Advance Credit for Ganesh: ₹${availableCredit}`);

  await mongoose.disconnect();
  console.log("Reconciliation complete.");
  process.exit(0);
}

reconcileGanesh().catch(async (err) => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});
