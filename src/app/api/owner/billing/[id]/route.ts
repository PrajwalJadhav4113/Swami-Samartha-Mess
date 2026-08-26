import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { getBillDetailedLogs } from "@/lib/billing-helper";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const bill = await Bill.findById(id).populate("customerId", "name mobile address");
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const dailyRecords = await getBillDetailedLogs(
      bill.customerId._id.toString(),
      bill.billingPeriodStart,
      bill.billingPeriodEnd,
      bill._id.toString()
    );

    return NextResponse.json({
      ...bill.toObject(),
      dailyRecords,
    });
  } catch (error: any) {
    console.error("Get Bill Detail API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    // 1. Fetch the bill first to get customer details
    const bill = await Bill.findById(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // 2. Unlock all associated meals and extra items back to UNBILLED
    await DailyMealRecord.updateMany(
      { billId: bill._id },
      { $set: { billingStatus: "UNBILLED", billId: null } }
    );
    await DailyMealItem.updateMany(
      { billId: bill._id },
      { $set: { billingStatus: "UNBILLED", billId: null } }
    );

    // 3. Reset isCarriedForward to false for older unpaid bills of this customer
    if (bill.previousBalance > 0) {
      await Bill.updateMany(
        { customerId: bill.customerId, isCarriedForward: true, createdAt: { $lt: bill.createdAt } },
        { $set: { isCarriedForward: false } }
      );
    }

    // 4. Delete payments registered for this bill
    await Payment.deleteMany({ billId: bill._id });

    // 5. Delete the bill document
    await Bill.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Bill deleted successfully" });
  } catch (error: any) {
    console.error("Delete Bill API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { paymentStatus } = await request.json();

    if (paymentStatus !== "paid" && paymentStatus !== "pending") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await connectToDatabase();

    const bill = await Bill.findById(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (paymentStatus === "paid") {
      const diff = bill.finalTotal - bill.amountPaid;
      if (diff > 0) {
        await Payment.create({
          customerId: bill.customerId,
          billId: bill._id,
          amount: diff,
          paymentDate: new Date(),
          paymentMode: "cash",
          notes: "Settled directly from Invoice details page",
        });
      }
      bill.amountPaid = bill.finalTotal;
      bill.paymentStatus = "paid";
    } else {
      await Payment.deleteMany({ billId: bill._id });
      bill.amountPaid = 0;
      bill.paymentStatus = "pending";
    }

    await bill.save();

    return NextResponse.json({ success: true, bill });
  } catch (error: any) {
    console.error("Update Bill Status API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { mealDetails, extraItemsDetails, discount, advancePayment, previousBalance, adjustmentReason } = body;

    await connectToDatabase();
    const bill = await Bill.findById(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // 1. Calculate new amounts
    const mealsTotal = mealDetails.reduce((sum: number, m: any) => sum + (m.quantity * m.rate), 0);
    const extrasTotal = extraItemsDetails.reduce((sum: number, e: any) => sum + (e.quantity * e.rate), 0);
    
    const disc = parseFloat(discount || 0);
    const adv = parseFloat(advancePayment || 0);
    const prevBal = parseFloat(previousBalance || 0);
    
    const newSubtotal = mealsTotal + extrasTotal + prevBal;
    const newFinalTotal = Math.max(0, newSubtotal - disc - adv);

    // If originalTotal is not set yet, set it to the current finalTotal
    if (!bill.originalTotal) {
      bill.originalTotal = bill.finalTotal;
    }

    // 2. Identify changes for audit trail
    const changes: any[] = [];

    // Compare mealDetails
    const oldMealMap = new Map(bill.mealDetails.map((m: any) => [m.type, m]));
    const newMealMap = new Map(mealDetails.map((m: any) => [m.type, m]));

    const allTypes = Array.from(new Set([...oldMealMap.keys(), ...newMealMap.keys()]));
    allTypes.forEach((type) => {
      const oldItem = oldMealMap.get(type);
      const newItem = newMealMap.get(type);

      const oldQty = oldItem ? oldItem.quantity : 0;
      const newQty = newItem ? newItem.quantity : 0;
      const oldRate = oldItem ? oldItem.rate : 0;
      const newRate = newItem ? newItem.rate : 0;
      const oldAmt = oldItem ? oldItem.amount : 0;
      const newAmt = newItem ? newItem.amount : 0;

      if (oldQty !== newQty || oldRate !== newRate) {
        changes.push({
          itemName: type.replace("_", " "),
          oldQty,
          newQty,
          oldRate,
          newRate,
          oldAmount: oldAmt,
          newAmount: newAmt,
        });
      }
    });

    // Compare extraItemsDetails
    const oldExtraMap = new Map(bill.extraItemsDetails.map((e: any) => [e.name, e]));
    const newExtraMap = new Map(extraItemsDetails.map((e: any) => [e.name, e]));

    const allExtraNames = Array.from(new Set([...oldExtraMap.keys(), ...newExtraMap.keys()]));
    allExtraNames.forEach((name) => {
      const oldItem = oldExtraMap.get(name);
      const newItem = newExtraMap.get(name);

      const oldQty = oldItem ? oldItem.quantity : 0;
      const newQty = newItem ? newItem.quantity : 0;
      const oldRate = oldItem ? oldItem.rate : 0;
      const newRate = newItem ? newItem.rate : 0;
      const oldAmt = oldItem ? oldItem.amount : 0;
      const newAmt = newItem ? newItem.amount : 0;

      if (oldQty !== newQty || oldRate !== newRate) {
        changes.push({
          itemName: name,
          oldQty,
          newQty,
          oldRate,
          newRate,
          oldAmount: oldAmt,
          newAmount: newAmt,
        });
      }
    });

    // Check if other fields changed
    if (bill.discount !== disc) {
      changes.push({
        itemName: "Discount",
        oldQty: 1,
        newQty: 1,
        oldRate: bill.discount,
        newRate: disc,
        oldAmount: bill.discount,
        newAmount: disc,
      });
    }
    if (bill.advancePayment !== adv) {
      changes.push({
        itemName: "Advance Applied",
        oldQty: 1,
        newQty: 1,
        oldRate: bill.advancePayment,
        newRate: adv,
        oldAmount: bill.advancePayment,
        newAmount: adv,
      });
    }
    if (bill.previousBalance !== prevBal) {
      changes.push({
        itemName: "Previous Balance",
        oldQty: 1,
        newQty: 1,
        oldRate: bill.previousBalance,
        newRate: prevBal,
        oldAmount: bill.previousBalance,
        newAmount: prevBal,
      });
    }

    // 3. Save audit log record
    const auditRecord = {
      changedBy: "Owner",
      changedAt: new Date(),
      reason: adjustmentReason || "Invoice corrected by owner",
      originalAmount: bill.originalTotal,
      adjustmentAmount: newFinalTotal - bill.originalTotal,
      finalAmount: newFinalTotal,
      changes,
    };

    bill.adjustmentHistory.push(auditRecord);

    // 4. Update Bill document
    bill.mealDetails = mealDetails;
    bill.extraItemsDetails = extraItemsDetails;
    bill.discount = disc;
    bill.advancePayment = adv;
    bill.previousBalance = prevBal;
    bill.finalTotal = newFinalTotal;
    bill.adjustmentAmount = newFinalTotal - bill.originalTotal;
    bill.isAdjusted = true;
    bill.adjustmentReason = adjustmentReason || bill.adjustmentReason;

    // Recalculate payment status based on amountPaid vs finalTotal
    if (bill.amountPaid >= newFinalTotal) {
      bill.paymentStatus = "paid";
    } else if (bill.amountPaid > 0) {
      bill.paymentStatus = "partially_paid";
    } else {
      bill.paymentStatus = "pending";
    }

    await bill.save();

    return NextResponse.json({ success: true, bill });
  } catch (error: any) {
    console.error("Edit Bill API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
