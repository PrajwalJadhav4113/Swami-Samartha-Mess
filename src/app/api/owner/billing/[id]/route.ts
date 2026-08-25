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
