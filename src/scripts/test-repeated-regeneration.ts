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

async function testRepeatedRegeneration() {
  console.log("==========================================");
  console.log("Starting Repeated Bill Regeneration Test");
  console.log("==========================================");

  const { connectToDatabase } = await import("../lib/db");
  const Bill = (await import("../models/Bill")).default;
  const Customer = (await import("../models/Customer")).default;
  const DailyMealRecord = (await import("../models/DailyMealRecord")).default;
  const DailyMealItem = (await import("../models/DailyMealItem")).default;

  await connectToDatabase();

  const rohan = await Customer.findOne({ name: "Rohan Deshmukh" });
  if (!rohan) {
    console.error("Rohan Deshmukh customer record not found!");
    process.exit(1);
  }

  const customerId = rohan._id.toString();
  const startDate = "2026-09-01";
  const endDate = "2026-09-30";
  const testBillIds: string[] = [];

  for (let iteration = 1; iteration <= 3; iteration++) {
    console.log(`\n--- Iteration ${iteration}: Generating new bill... ---`);

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const existingActiveBills = await Bill.find({
      customerId,
      billingPeriodStart: { $lte: end },
      billingPeriodEnd: { $gte: start },
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
    }).sort({ billingPeriodStart: 1 });

    console.log(`Found ${existingActiveBills.length} existing active bill(s) before generation:`, existingActiveBills.map((b) => b.billNumber));

    const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const billsCount = await Bill.countDocuments();
    const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

    const newBill = new Bill({
      billNumber,
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      mealDetails: [],
      extraItemsDetails: [],
      discount: 0,
      advancePayment: 0,
      previousBalance: 0,
      finalTotal: 224,
      originalTotal: 224,
      adjustmentAmount: 0,
      paymentStatus: "pending",
      status: "ACTIVE",
      amountPaid: 0,
      isCarriedForward: false,
      notes: `Repeated Regeneration Test ${iteration}`,
    });

    await newBill.save();
    testBillIds.push(newBill._id.toString());
    console.log(`Saved New Bill ${newBill.billNumber} (ID: ${newBill._id})`);

    const supersededResult = await Bill.updateMany(
      {
        customerId,
        _id: { $ne: newBill._id },
        billingPeriodStart: { $lte: end },
        billingPeriodEnd: { $gte: start },
        status: { $nin: ["SUPERSEDED", "CANCELLED"] },
      },
      {
        $set: {
          status: "SUPERSEDED",
          supersededBy: newBill._id,
          supersededAt: new Date(),
        },
      }
    );

    console.log(`Superseded update result: matched=${supersededResult.matchedCount}, modified=${supersededResult.modifiedCount}`);

    // Verify DB count
    const activeBills = await Bill.find({
      customerId,
      billingPeriodStart: { $lte: end },
      billingPeriodEnd: { $gte: start },
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
    });

    console.log(`Active bills count after iteration ${iteration}: ${activeBills.length}`);
    if (activeBills.length !== 1) {
      console.error(`FAILURE on iteration ${iteration}: Expected 1 active bill, found ${activeBills.length}`);
      process.exit(1);
    }
    if (activeBills[0]._id.toString() !== newBill._id.toString()) {
      console.error(`FAILURE on iteration ${iteration}: Active bill is not the newly generated bill!`);
      process.exit(1);
    }
    console.log(`SUCCESS for iteration ${iteration}: Only ${newBill.billNumber} is ACTIVE.`);
  }

  console.log("\nCleaning up temporary test bills (deleting test bills, restoring 0020 as ACTIVE)...");
  await Bill.deleteMany({ _id: { $in: testBillIds } });

  const bill20 = await Bill.findOne({ billNumber: "SSM-202609-0020" });
  if (bill20) {
    bill20.status = "ACTIVE";
    bill20.supersededBy = null;
    bill20.supersededAt = null;
    await bill20.save();

    await Bill.updateMany(
      {
        customerId,
        billNumber: { $in: ["SSM-202609-0017", "SSM-202609-0018", "SSM-202609-0019"] },
      },
      {
        $set: {
          status: "SUPERSEDED",
          supersededBy: bill20._id,
          supersededAt: new Date(),
        },
      }
    );
  }

  // Final verification of Rohan's bills
  const finalRohanBills = await Bill.find({ customerId: rohan._id }).sort({ createdAt: 1 });
  console.log("\n==========================================");
  console.log("FINAL DATABASE VERIFICATION FOR ROHAN:");
  console.log("==========================================");
  finalRohanBills.forEach((b) => {
    console.log(`Bill ${b.billNumber} (Amount: ₹${b.finalTotal}) -> Status: ${b.status}`);
  });

  const finalActive = finalRohanBills.filter((b) => b.status === "ACTIVE");
  if (finalActive.length === 1 && finalActive[0].billNumber === "SSM-202609-0020") {
    console.log("\n>>> ALL TESTS PASSED SUCCESSFULLY! Only SSM-202609-0020 is ACTIVE! <<<");
  } else {
    console.error("\n>>> FINAL VERIFICATION FAILED! <<<");
    process.exit(1);
  }

  process.exit(0);
}

testRepeatedRegeneration().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
