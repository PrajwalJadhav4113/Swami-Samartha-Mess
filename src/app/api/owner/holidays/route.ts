import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Holiday from "@/models/Holiday";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function GET() {
  try {
    await connectToDatabase();
    // Fetch all holidays and populate customer details if present
    const holidays = await Holiday.find()
      .populate("customerId", "name mobile")
      .sort({ startDate: -1 });
      
    return NextResponse.json(holidays);
  } catch (error: any) {
    console.error("Get Holidays API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { customerId, startDate, endDate, reason } = await request.json();

    if (!startDate || !endDate || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date formats" }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json({ error: "Start date must be before or equal to End date" }, { status: 400 });
    }

    const holiday = await Holiday.create({
      customerId: customerId || null,
      startDate: start,
      endDate: end,
      reason,
    });

    const populated = await Holiday.findById(holiday._id).populate("customerId", "name mobile");

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Create Holiday API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
