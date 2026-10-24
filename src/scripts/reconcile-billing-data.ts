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

async function reconcileBillingData() {
  console.log("Starting Database Billing Reconciliation...");

  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Payment = (await import("../models/Payment")).default;
  const Customer = (await import("../models/Customer")).default;
  const { syncCustomerAdvanceBalance } = await import("../lib/billing-helper");

  await connectToDatabase();

  const bills = await Bill.find({});
  let updatedCount = 0;

  for (const bill of bills) {
    // Direct bill payments (BILL_PAYMENT) registered specifically for this bill
    const directPayments = await Payment.find({
      billId: bill._id,
      paymentType: "BILL_PAYMENT",
    });

    const directPaid = directPayments.reduce((sum, p) => sum + p.amount, 0);

    let newStatus = bill.paymentStatus;
    if (bill.finalTotal === 0 || directPaid >= bill.finalTotal) {
      newStatus = "paid";
    } else if (directPaid > 0) {
      newStatus = "partially_paid";
    } else {
      newStatus = "pending";
    }

    if (bill.amountPaid !== directPaid || bill.paymentStatus !== newStatus) {
      console.log(
        `Reconciling Bill ${bill.billNumber}: amountPaid ${bill.amountPaid} -> ${directPaid}, paymentStatus ${bill.paymentStatus} -> ${newStatus}`
      );
      bill.amountPaid = directPaid;
      bill.paymentStatus = newStatus as any;
      await bill.save();
      updatedCount++;
    }
  }

  console.log(`Reconciled ${updatedCount} bill(s).`);

  // Sync advance balances for all customers
  const customers = await Customer.find({});
  for (const customer of customers) {
    await syncCustomerAdvanceBalance(customer._id.toString());
  }
  console.log(`Synced advance balances for ${customers.length} customer(s).`);
  console.log("Reconciliation complete.");
  process.exit(0);
}

reconcileBillingData().catch((err) => {
  console.error("Reconciliation Error:", err);
  process.exit(1);
});
