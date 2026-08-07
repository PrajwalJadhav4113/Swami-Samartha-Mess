import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Payment from "@/models/Payment";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "customer" ? payload : null;
}

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const customerId = session.id;

    const payments = await Payment.find({ customerId })
      .populate("billId", "billNumber finalTotal")
      .sort({ paymentDate: -1 });

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error("Customer Payments API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
