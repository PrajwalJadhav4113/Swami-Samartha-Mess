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

async function runAdvanceCreditRulesTestSuite() {
  console.log("==================================================");
  console.log("RUNNING COMPREHENSIVE ADVANCE CREDIT RULES TEST SUITE");
  console.log("==================================================");

  const { connectToDatabase } = await import("../lib/db");
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;
  const Bill = (await import("../models/Bill")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const { syncCustomerAdvanceBalance } = await import("../lib/billing-helper");

  await connectToDatabase();

  const testMobile = "9888800000";
  const testUsername = "advance_rules_test_user";

  // Helper to clean customer data
  async function cleanupCustomer() {
    const cust = await Customer.findOne({ mobile: testMobile });
    if (cust) {
      await Bill.deleteMany({ customerId: cust._id });
      await Payment.deleteMany({ customerId: cust._id });
      await DailyMealRecord.deleteMany({ customerId: cust._id });
      await Customer.deleteOne({ _id: cust._id });
    }
  }

  await cleanupCustomer();

  // Helper to create test customer
  async function createTestCustomer() {
    return await Customer.create({
      name: "AdvanceRules TestCustomer",
      mobile: testMobile,
      address: "456 Accounting Lane",
      username: testUsername,
      passwordHash: "hashedpass",
      status: "active",
      advanceBalance: 0,
      joiningDate: new Date(),
    });
  }

  // --- TEST A: Fully applied advance ---
  console.log("\n--- TEST A: Fully Applied Advance ---");
  {
    await cleanupCustomer();
    const cust = await createTestCustomer();

    // Advance ₹700 fully applied
    const dummyBill = await Bill.create({
      billNumber: "SSM-TEST-A-01",
      customerId: cust._id,
      billingPeriodStart: new Date("2026-09-01"),
      billingPeriodEnd: new Date("2026-09-30"),
      finalTotal: 0,
      advancePayment: 700,
      amountPaid: 0,
      paymentStatus: "paid",
      status: "ACTIVE",
    });

    const advPay = await Payment.create({
      customerId: cust._id,
      amount: 700,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-01"),
      paymentMode: "upi",
      remainingAmount: 0,
      allocations: [{ billId: dummyBill._id, amountApplied: 700, appliedAt: new Date() }],
    });

    await syncCustomerAdvanceBalance(cust._id.toString());
    const reloadedCust = await Customer.findById(cust._id);

    console.log(`Customer Available Advance Credit: ₹${reloadedCust!.advanceBalance} (Expected: ₹0)`);
    if (reloadedCust!.advanceBalance !== 0) {
      console.error("FAIL TEST A: Available advance should be 0 when advance is fully applied!");
      process.exit(1);
    }

    // Bill preview for ₹790
    const consumptionTotal = 790;
    const available = reloadedCust!.advanceBalance; // 0
    const advToApply = Math.min(available, consumptionTotal); // 0
    const payable = consumptionTotal - advToApply; // 790

    console.log(`Consumption: ₹${consumptionTotal}, Advance Applied: ₹${advToApply}, Amount Payable: ₹${payable}`);
    if (advToApply !== 0 || payable !== 790) {
      console.error("FAIL TEST A: Expected Advance Applied = 0, Payable = 790");
      process.exit(1);
    }
    console.log("PASS: TEST A SUCCESSFUL");
  }

  // --- TEST B: Partially applied advance ---
  console.log("\n--- TEST B: Partially Applied Advance ---");
  {
    await cleanupCustomer();
    const cust = await createTestCustomer();

    const dummyBill = await Bill.create({
      billNumber: "SSM-TEST-B-01",
      customerId: cust._id,
      billingPeriodStart: new Date("2026-09-01"),
      billingPeriodEnd: new Date("2026-09-30"),
      finalTotal: 0,
      advancePayment: 700,
      amountPaid: 0,
      paymentStatus: "paid",
      status: "ACTIVE",
    });

    const advPay = await Payment.create({
      customerId: cust._id,
      amount: 1000,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-01"),
      paymentMode: "upi",
      remainingAmount: 300,
      allocations: [{ billId: dummyBill._id, amountApplied: 700, appliedAt: new Date() }],
    });

    await syncCustomerAdvanceBalance(cust._id.toString());
    const reloadedCust = await Customer.findById(cust._id);

    console.log(`Customer Available Advance Credit: ₹${reloadedCust!.advanceBalance} (Expected: ₹300)`);
    if (reloadedCust!.advanceBalance !== 300) {
      console.error("FAIL TEST B: Available advance should be 300!");
      process.exit(1);
    }

    const consumptionTotal = 790;
    const available = reloadedCust!.advanceBalance; // 300
    const advToApply = Math.min(available, consumptionTotal); // 300
    const payable = consumptionTotal - advToApply; // 490

    console.log(`Consumption: ₹${consumptionTotal}, Advance Applied: ₹${advToApply}, Amount Payable: ₹${payable}`);
    if (advToApply !== 300 || payable !== 490) {
      console.error("FAIL TEST B: Expected Advance Applied = 300, Payable = 490");
      process.exit(1);
    }
    console.log("PASS: TEST B SUCCESSFUL");
  }

  // --- TEST C: Advance greater than bill ---
  console.log("\n--- TEST C: Advance Greater Than Bill ---");
  {
    await cleanupCustomer();
    const cust = await createTestCustomer();

    const advPay = await Payment.create({
      customerId: cust._id,
      amount: 1000,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-01"),
      paymentMode: "upi",
      remainingAmount: 1000,
      allocations: [],
    });

    await syncCustomerAdvanceBalance(cust._id.toString());
    const reloadedCust = await Customer.findById(cust._id);

    const consumptionTotal = 500;
    const available = reloadedCust!.advanceBalance; // 1000
    const advToApply = Math.min(available, consumptionTotal); // 500
    const payable = consumptionTotal - advToApply; // 0

    // Perform allocation
    advPay.remainingAmount -= advToApply;
    advPay.allocations.push({ billId: cust._id as any, amountApplied: advToApply, appliedAt: new Date() });
    await advPay.save();
    await syncCustomerAdvanceBalance(cust._id.toString());

    const finalCust = await Customer.findById(cust._id);

    console.log(`Consumption: ₹${consumptionTotal}, Advance Applied: ₹${advToApply}, Payable: ₹${payable}, Remaining Credit: ₹${finalCust!.advanceBalance}`);
    if (advToApply !== 500 || payable !== 0 || finalCust!.advanceBalance !== 500) {
      console.error("FAIL TEST C: Expected Advance Applied = 500, Payable = 0, Remaining Credit = 500");
      process.exit(1);
    }
    console.log("PASS: TEST C SUCCESSFUL");
  }

  // --- TEST D: Multiple advance transactions ---
  console.log("\n--- TEST D: Multiple Advance Transactions ---");
  {
    await cleanupCustomer();
    const cust = await createTestCustomer();

    const dummyBill = await Bill.create({
      billNumber: "SSM-TEST-D-01",
      customerId: cust._id,
      billingPeriodStart: new Date("2026-09-01"),
      billingPeriodEnd: new Date("2026-09-30"),
      finalTotal: 0,
      advancePayment: 700,
      amountPaid: 0,
      paymentStatus: "paid",
      status: "ACTIVE",
    });

    // Advance 1: ₹500 fully applied
    await Payment.create({
      customerId: cust._id,
      amount: 500,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-01"),
      paymentMode: "upi",
      remainingAmount: 0,
      allocations: [{ billId: dummyBill._id, amountApplied: 500, appliedAt: new Date() }],
    });

    // Advance 2: ₹300 partially applied (₹200 applied, ₹100 remaining)
    await Payment.create({
      customerId: cust._id,
      amount: 300,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-02"),
      paymentMode: "upi",
      remainingAmount: 100,
      allocations: [{ billId: dummyBill._id, amountApplied: 200, appliedAt: new Date() }],
    });

    // Advance 3: ₹200 unused
    await Payment.create({
      customerId: cust._id,
      amount: 200,
      paymentType: "ADVANCE",
      paymentDate: new Date("2026-09-03"),
      paymentMode: "upi",
      remainingAmount: 200,
      allocations: [],
    });

    await syncCustomerAdvanceBalance(cust._id.toString());
    const reloadedCust = await Customer.findById(cust._id);

    console.log(`Customer Available Advance Credit: ₹${reloadedCust!.advanceBalance} (Expected: ₹300)`);
    if (reloadedCust!.advanceBalance !== 300) {
      console.error(`FAIL TEST D: Expected available advance = 300, got ${reloadedCust!.advanceBalance}`);
      process.exit(1);
    }
    console.log("PASS: TEST D SUCCESSFUL");
  }

  // --- TEST E: General Balance ---
  console.log("\n--- TEST E: General Balance (Type: BILL_PAYMENT) ---");
  {
    await cleanupCustomer();
    const cust = await createTestCustomer();

    // Direct payment / General balance of ₹100 (paymentType = BILL_PAYMENT)
    await Payment.create({
      customerId: cust._id,
      amount: 100,
      paymentType: "BILL_PAYMENT",
      paymentDate: new Date("2026-09-01"),
      paymentMode: "cash",
      notes: "General Balance payment",
      remainingAmount: 0,
      allocations: [],
    });

    await syncCustomerAdvanceBalance(cust._id.toString());
    const reloadedCust = await Customer.findById(cust._id);

    console.log(`Customer Available Advance Credit: ₹${reloadedCust!.advanceBalance} (Expected: ₹0)`);
    if (reloadedCust!.advanceBalance !== 0) {
      console.error("FAIL TEST E: BILL_PAYMENT transactions must NOT automatically count as available advance credit!");
      process.exit(1);
    }
    console.log("PASS: TEST E SUCCESSFUL");
  }

  await cleanupCustomer();

  console.log("\n==================================================");
  console.log("ALL ADVANCE CREDIT RULES TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
  process.exit(0);
}

runAdvanceCreditRulesTestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
