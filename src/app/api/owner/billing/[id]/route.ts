import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
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
      bill.billingPeriodEnd
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

    const result = await Bill.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

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
