import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "customer" ? payload : null;
}

export async function GET(request: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const customerId = session.id;

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    if (!startStr || !endStr) {
      return NextResponse.json({ error: "Missing date range parameters" }, { status: 400 });
    }

    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T23:59:59.999Z`);

    // 1. Fetch Meal records
    const mealRecords = await DailyMealRecord.find({
      customerId,
      date: { $gte: start, $lte: end },
    });

    // 2. Fetch Extras items consumed
    const extraItems = await DailyMealItem.find({
      customerId,
      date: { $gte: start, $lte: end },
    });

    // 3. Fetch Holidays
    const holidays = await Holiday.find({
      $or: [
        { customerId: null },
        { customerId },
      ],
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    return NextResponse.json({
      mealRecords,
      extraItems,
      holidays,
    });
  } catch (error: any) {
    console.error("Customer Meals API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
