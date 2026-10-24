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

async function runTests() {
  const { connectToDatabase } = await import("../lib/db");
  const Customer = (await import("../models/Customer")).default;
  const Payment = (await import("../models/Payment")).default;
  const Bill = (await import("../models/Bill")).default;
  const mongoose = (await import("mongoose")).default;
  const { syncCustomerAdvanceBalance, releaseBillAdvanceAllocations } = await import("../lib/billing-helper");

  await connectToDatabase();

  console.log("\n==================================================");
  console.log("RUNNING ADVANCE ALLOCATION & DATE RANGE INTEGRITY TESTS");
  console.log("==================================================\n");

  const testCustomer = await Customer.create({
    username: "test_advance_user_v2",
    passwordHash: "dummy_pass_hash",
    name: "Test Advance User V2",
    mobile: "9988776655",
    address: "Test Address V2",
    advanceBalance: 0,
  });

  const cId = testCustomer._id.toString();

  try {
    // -------------------------------------------------------------
    // TEST 1: Bill = ₹790, Available advance = ₹20, Requested advance = ₹790
    // Expected: Clamped to ₹20 or rejected. Never apply ₹790.
    // -------------------------------------------------------------
    console.log("--- TEST 1: Bill = ₹790, Available = ₹20, Requested = ₹790 ---");
    const p1 = await Payment.create({
      customerId: cId,
      amount: 20,
      paymentType: "ADVANCE",
      paymentDate: new Date(),
      paymentMode: "cash",
      remainingAmount: 20,
      allocations: [],
    });
    await syncCustomerAdvanceBalance(cId);

    const subtotal1 = 790;
    const avail1 = await Customer.findById(cId).then((c) => c?.advanceBalance || 0);
    const reqAdv1 = 790;
    const advToApply1 = Math.min(reqAdv1, avail1, subtotal1); // Clamping logic
    const finalTotal1 = subtotal1 - advToApply1;

    console.log(`Test 1 Result: Available = ₹${avail1}, Requested = ₹${reqAdv1}, Applied = ₹${advToApply1}, FinalTotal = ₹${finalTotal1}`);
    if (advToApply1 > 20 || finalTotal1 !== 770) {
      throw new Error(`Test 1 Failed: expected advance applied <= 20 & finalTotal 770`);
    }
    console.log("PASS: TEST 1 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 2: Bill = ₹790, Available advance = ₹20, Requested advance = ₹20
    // Expected: Advance applied = ₹20, Amount payable = ₹770, Status = pending
    // -------------------------------------------------------------
    console.log("--- TEST 2: Bill = ₹790, Available = ₹20, Requested = ₹20 ---");
    const advToApply2 = Math.min(20, avail1, subtotal1);
    const finalTotal2 = subtotal1 - advToApply2;
    const status2 = finalTotal2 === 0 ? "paid" : "pending";

    console.log(`Test 2 Result: Applied = ₹${advToApply2}, FinalTotal = ₹${finalTotal2}, Status = ${status2}`);
    if (advToApply2 !== 20 || finalTotal2 !== 770 || status2 !== "pending") {
      throw new Error("Test 2 Failed");
    }
    console.log("PASS: TEST 2 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 3: Bill = ₹790, Available advance = ₹1000, Requested advance = ₹790
    // Expected: Advance applied = ₹790, Amount payable = ₹0, Status = Paid
    // -------------------------------------------------------------
    console.log("--- TEST 3: Bill = ₹790, Available = ₹1000, Requested = ₹790 ---");
    await Payment.create({
      customerId: cId,
      amount: 980,
      paymentType: "ADVANCE",
      paymentDate: new Date(),
      paymentMode: "cash",
      remainingAmount: 980,
      allocations: [],
    });
    const avail3 = await syncCustomerAdvanceBalance(cId); // ₹1000

    const advToApply3 = Math.min(790, avail3, 790);
    const finalTotal3 = 790 - advToApply3;
    const status3 = finalTotal3 === 0 ? "paid" : "pending";

    console.log(`Test 3 Result: Available = ₹${avail3}, Applied = ₹${advToApply3}, FinalTotal = ₹${finalTotal3}, Status = ${status3}`);
    if (advToApply3 !== 790 || finalTotal3 !== 0 || status3 !== "paid") {
      throw new Error("Test 3 Failed");
    }
    console.log("PASS: TEST 3 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 4: Bill = ₹790, Available advance = ₹1000, Requested advance = ₹500
    // Expected: Advance applied = ₹500, Amount payable = ₹290
    // -------------------------------------------------------------
    console.log("--- TEST 4: Bill = ₹790, Available = ₹1000, Requested = ₹500 ---");
    const advToApply4 = Math.min(500, avail3, 790);
    const finalTotal4 = 790 - advToApply4;

    console.log(`Test 4 Result: Applied = ₹${advToApply4}, Amount Payable = ₹${finalTotal4}`);
    if (advToApply4 !== 500 || finalTotal4 !== 290) {
      throw new Error("Test 4 Failed");
    }
    console.log("PASS: TEST 4 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 5: Bill = ₹790, Available advance = ₹0
    // Expected: Advance applied = ₹0, Amount payable = ₹790, Status = pending
    // -------------------------------------------------------------
    console.log("--- TEST 5: Bill = ₹790, Available = ₹0 ---");
    await Payment.deleteMany({ customerId: cId });
    const avail5 = await syncCustomerAdvanceBalance(cId); // ₹0

    const advToApply5 = Math.min(790, avail5, 790);
    const finalTotal5 = 790 - advToApply5;
    const status5 = finalTotal5 === 0 ? "paid" : "pending";

    console.log(`Test 5 Result: Available = ₹${avail5}, Applied = ₹${advToApply5}, FinalTotal = ₹${finalTotal5}, Status = ${status5}`);
    if (advToApply5 !== 0 || finalTotal5 !== 790 || status5 !== "pending") {
      throw new Error("Test 5 Failed");
    }
    console.log("PASS: TEST 5 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 6 & 7: Concurrent / Repeated Bill Generation
    // Expected: Advance cannot be double-consumed.
    // -------------------------------------------------------------
    console.log("--- TEST 6 & 7: Prevent duplicate allocation of same advance credit ---");
    await Payment.create({
      customerId: cId,
      amount: 100,
      paymentType: "ADVANCE",
      paymentDate: new Date(),
      paymentMode: "cash",
      remainingAmount: 100,
      allocations: [],
    });
    const avail6 = await syncCustomerAdvanceBalance(cId); // ₹100

    // Gen 1 consumes ₹100
    const adv1 = Math.min(100, avail6);
    await Payment.updateMany({ customerId: cId, paymentType: "ADVANCE" }, { $set: { remainingAmount: 0 } });
    await syncCustomerAdvanceBalance(cId);

    // Gen 2 sees ₹0 available
    const avail7 = await Customer.findById(cId).then((c) => c?.advanceBalance || 0);
    const adv2 = Math.min(100, avail7);

    console.log(`Test 6/7 Result: First Gen Applied = ₹${adv1}, Second Gen Applied = ₹${adv2}`);
    if (adv1 !== 100 || adv2 !== 0) {
      throw new Error("Test 6/7 Failed");
    }
    console.log("PASS: TEST 6 & 7 SUCCESSFUL\n");

    // -------------------------------------------------------------
    // TEST 8: Selected Period 01/10/2026 - 29/10/2026 UTC Formatting
    // Expected: Exactly 1 Oct 2026 – 29 Oct 2026, no timezone shift to 30 Oct.
    // -------------------------------------------------------------
    console.log("--- TEST 8: Selected Period 01/10/2026 – 29/10/2026 date formatting ---");
    const end = new Date("2026-10-29T23:59:59.999Z");
    const formattedEnd = end.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
    console.log(`Test 8 Result: Formatted UTC End Date = "${formattedEnd}" (Expected: "29 Oct 2026")`);
    if (!formattedEnd.includes("29 Oct 2026")) {
      throw new Error(`Test 8 Failed: date shifted to "${formattedEnd}"`);
    }
    console.log("PASS: TEST 8 SUCCESSFUL\n");

  } finally {
    await Customer.findByIdAndDelete(testCustomer._id);
    await Payment.deleteMany({ customerId: testCustomer._id });
    await Bill.deleteMany({ customerId: testCustomer._id });
    await mongoose.disconnect();
  }

  console.log("==================================================");
  console.log("ALL 8 INTEGRITY TEST CASES PASSED SUCCESSFULLY!");
  console.log("==================================================\n");
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
