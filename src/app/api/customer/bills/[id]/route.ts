import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { getBillDetailedLogs } from "@/lib/billing-helper";

async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "customer" ? payload : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const bill = await Bill.findById(id).populate("customerId", "name mobile address");
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // Security check: ensure the bill belongs to the logged-in customer
    if (bill.customerId._id.toString() !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
    console.error("Get Customer Bill Detail Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
