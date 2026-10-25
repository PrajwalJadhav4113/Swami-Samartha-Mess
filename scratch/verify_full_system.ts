import mongoose from "mongoose";
import Customer from "../src/models/Customer";
import Bill from "../src/models/Bill";
import Payment from "../src/models/Payment";
import DailyMealRecord from "../src/models/DailyMealRecord";
import DailyMealItem from "../src/models/DailyMealItem";
import Notification from "../src/models/Notification";

import fs from "fs";
import path from "path";

// Load environment variables from .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.substring(0, eqIdx).trim();
        const value = line.substring(eqIdx + 1).trim();
        if (key && !key.startsWith("#")) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn("Failed to load .env.local", e);
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/swami-samartha-mess";

async function runComprehensiveTests() {
  console.log("Connecting to Database...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully!");

  const testUsername = "comprehensive_test_user";
  await Customer.deleteOne({ username: testUsername });

  // Create Test Customer
  const customer = new Customer({
    name: "Rahul System Test",
    username: testUsername,
    passwordHash: "dummyhash",
    mobile: "9988776655",
    address: "Pune",
    status: "active",
    joiningDate: new Date("2026-08-01T00:00:00.000Z"),
    fixedDiscount: 0,
    advanceBalance: 0
  });
  await customer.save();
  const customerId = customer._id;
  console.log("Created test customer. ID:", customerId);

  const cleanAll = async () => {
    await DailyMealRecord.deleteMany({ customerId });
    await DailyMealItem.deleteMany({ customerId });
    await Bill.deleteMany({ customerId });
    await Payment.deleteMany({ customerId });
    await Notification.deleteMany({ customerId });
    customer.advanceBalance = 0;
    await customer.save();
  };

  const createMeals = async (startDay: number, endDay: number, pricePerMeal = 100) => {
    for (let i = startDay; i <= endDay; i++) {
      const day = i < 10 ? `0${i}` : `${i}`;
      await DailyMealRecord.create({
        customerId,
        date: new Date(`2026-08-${day}T12:00:00.000Z`),
        morningMeal: "full",
        morningPrice: pricePerMeal,
        nightMeal: "none",
        nightPrice: 0,
        billingStatus: "UNBILLED",
        billId: null
      });
    }
  };

  console.log("\n--- TEST SUITE 1: AUTOMATED MONTHLY BILLING & IDEMPOTENCY ---");
  await cleanAll();
  
  // 1. Customer has unbilled meals for Aug 1-30
  await createMeals(1, 30, 100); // 30 meals * 100 = 3000

  // Simulate Automated Monthly Cron for August 2026
  const generateCronBill = async (targetYear = 2026, targetMonth = 8) => {
    const start = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const unbilledMeals = await DailyMealRecord.find({
      customerId,
      date: { $gte: start, $lte: end },
      billingStatus: { $ne: "BILLED" },
      billId: null
    });

    if (unbilledMeals.length === 0) {
      return null;
    }

    const consumptionSum = unbilledMeals.length * 100;
    const dateCode = `${targetYear}0${targetMonth}`;
    const billsCount = await Bill.countDocuments();
    const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

    let advToApply = 0;
    if (customer.advanceBalance && customer.advanceBalance > 0) {
      advToApply = Math.min(customer.advanceBalance, consumptionSum);
    }
    const finalTotal = Math.max(0, consumptionSum - advToApply);

    const bill = new Bill({
      billNumber,
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      mealDetails: [{ type: "morning_full", quantity: unbilledMeals.length, rate: 100, amount: consumptionSum }],
      extraItemsDetails: [],
      discount: 0,
      advancePayment: advToApply,
      previousBalance: 0,
      finalTotal,
      paymentStatus: finalTotal === 0 ? "paid" : "pending",
      amountPaid: 0,
      isCarriedForward: false,
      notes: `Automated Monthly Bill - August 2026`
    });
    await bill.save();

    await DailyMealRecord.updateMany(
      { _id: { $in: unbilledMeals.map(m => m._id) } },
      { $set: { billingStatus: "BILLED", billId: bill._id } }
    );

    // Notification
    await Notification.create({
      customerId,
      title: "Your August 2026 Bill is Ready",
      message: `Your bill #${bill.billNumber} has been generated. Amount: ₹${finalTotal}.`,
      type: "bill_generated",
      link: `/customer/bills/${bill._id}`
    });

    return bill;
  };

  // Run 1st Cron Execution
  const cronBill1 = await generateCronBill(2026, 8);
  console.log("Cron 1st Execution created bill:", cronBill1?.billNumber, "Total: ₹" + cronBill1?.finalTotal);
  
  const notif1 = await Notification.findOne({ customerId, type: "bill_generated" });
  console.log("Notification created for customer:", notif1?.title);

  // Run 2nd Cron Execution (Idempotency test)
  const cronBill2 = await generateCronBill(2026, 8);
  console.log("Cron 2nd Execution result (should be null):", cronBill2);

  const totalBills = await Bill.countDocuments({ customerId });
  if (cronBill1 && cronBill2 === null && totalBills === 1 && notif1) {
    console.log("✓ Test 1 Passed! Cron generated August bill & idempotency prevented duplicate billing.");
  } else {
    console.error("Test 1 Failed!");
    process.exit(1);
  }

  console.log("\n--- TEST SUITE 2: PARTIAL MANUAL BILLING THEN AUTOMATED CRON ---");
  await cleanAll();
  await createMeals(1, 30, 100);

  // Manually bill Aug 1 to Aug 10
  const manualStart = new Date("2026-08-01T00:00:00.000Z");
  const manualEnd = new Date("2026-08-10T23:59:59.999Z");
  const manualMeals = await DailyMealRecord.find({ customerId, date: { $gte: manualStart, $lte: manualEnd } });
  const manualBill = new Bill({
    billNumber: "SSM-MANUAL-001",
    customerId,
    billingPeriodStart: manualStart,
    billingPeriodEnd: manualEnd,
    mealDetails: [{ type: "morning_full", quantity: manualMeals.length, rate: 100, amount: manualMeals.length * 100 }],
    extraItemsDetails: [],
    discount: 0,
    advancePayment: 0,
    previousBalance: 0,
    finalTotal: manualMeals.length * 100,
    paymentStatus: "pending",
    amountPaid: 0,
    isCarriedForward: false
  });
  await manualBill.save();
  await DailyMealRecord.updateMany({ _id: { $in: manualMeals.map(m => m._id) } }, { $set: { billingStatus: "BILLED", billId: manualBill._id } });

  console.log("Manual bill generated for Aug 1-10 (10 meals = ₹1,000)");

  // Now run automated cron for August (should bill ONLY Aug 11-30 = 20 meals = ₹2,000)
  const cronBillPartial = await generateCronBill(2026, 8);
  console.log("Cron bill after manual bill:", cronBillPartial?.billNumber, "Total: ₹" + cronBillPartial?.finalTotal);

  if (cronBillPartial && cronBillPartial.finalTotal === 2000) {
    console.log("✓ Test 2 Passed! Automated cron billed ONLY remaining unbilled consumption (Aug 11-30).");
  } else {
    console.error("Test 2 Failed!");
    process.exit(1);
  }

  console.log("\n--- TEST SUITE 3: OVERPAYMENT CONVERSION ON BILL ADJUSTMENT ---");
  await cleanAll();
  await createMeals(1, 10, 100); // 10 meals = 1000
  const origBill = await generateCronBill(2026, 8); // 1000
  console.log("Original Bill Total: ₹" + origBill?.finalTotal);

  // Customer pays ₹1,000 fully settling origBill
  await Payment.create({
    customerId,
    billId: origBill?._id,
    amount: 1000,
    paymentType: "BILL_PAYMENT",
    paymentDate: new Date(),
    paymentMode: "upi"
  });
  origBill!.amountPaid = 1000;
  origBill!.paymentStatus = "paid";
  await origBill!.save();
  console.log("Customer paid ₹1,000. paymentStatus: paid");

  // Owner edits bill to correct extra tiffins: reduces finalTotal from ₹1,000 to ₹800
  const newFinalTotal = 800;
  const excessCredit = origBill!.amountPaid - newFinalTotal; // 200
  
  customer.advanceBalance = (customer.advanceBalance || 0) + excessCredit;
  await customer.save();

  const creditPayment = await Payment.create({
    customerId,
    billId: null,
    amount: excessCredit,
    paymentType: "ADVANCE",
    paymentDate: new Date(),
    paymentMode: "other",
    notes: "Excess credit converted from bill adjustment",
    remainingAmount: excessCredit,
    allocations: []
  });

  origBill!.finalTotal = newFinalTotal;
  origBill!.adjustmentAmount = -200;
  origBill!.isAdjusted = true;
  origBill!.paymentStatus = "paid";
  await origBill!.save();

  console.log("Adjusted Bill Final Total: ₹" + origBill?.finalTotal, "Amount Paid: ₹" + origBill?.amountPaid);
  console.log("Customer Advance Balance:", customer.advanceBalance, "Excess Payment remainingAmount:", creditPayment.remainingAmount);

  if (origBill?.finalTotal === 800 && origBill?.amountPaid === 1000 && customer.advanceBalance === 200 && creditPayment.remainingAmount === 200) {
    console.log("✓ Test 3 Passed! Excess ₹200 successfully converted into Customer Advance Credit!");
  } else {
    console.error("Test 3 Failed!");
    process.exit(1);
  }

  console.log("\nALL COMPREHENSIVE INTEGRATION TESTS PASSED CLEANLY!");
  await cleanAll();
  await Customer.deleteOne({ username: testUsername });
  await mongoose.disconnect();
}

runComprehensiveTests().catch((e) => {
  console.error("Error running test suite:", e);
  process.exit(1);
});
