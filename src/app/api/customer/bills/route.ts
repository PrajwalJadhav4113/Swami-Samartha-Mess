import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
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

    const bills = await Bill.find({ customerId })
      .populate("customerId", "name mobile address")
      .sort({ createdAt: -1 });

    return NextResponse.json(bills);
  } catch (error: any) {
    console.error("Customer Bills API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
