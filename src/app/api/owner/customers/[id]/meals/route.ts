import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: customerId } = await params;
    await connectToDatabase();

    // Fetch meal records for this customer (sorted newest first)
    const mealRecords = await DailyMealRecord.find({ customerId })
      .sort({ date: -1 })
      .limit(60); // limit to last 60 entries for performance

    // Fetch extra items consumed
    const extraItems = await DailyMealItem.find({ customerId })
      .sort({ date: -1 })
      .limit(100);

    return NextResponse.json({
      mealRecords,
      extraItems,
    });
  } catch (error: any) {
    console.error("Get Customer Meals History Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
