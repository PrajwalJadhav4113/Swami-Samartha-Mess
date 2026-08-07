import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import DailyMealRecord from "@/models/DailyMealRecord";
import Holiday from "@/models/Holiday";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import MenuItem from "@/models/MenuItem";
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

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(`${todayStr}T00:00:00.000Z`);

    // 1. Today's Meal Record
    const todayMeal = await DailyMealRecord.findOne({ customerId, date: today });

    // 2. Active Menu Items (for today's menu preview)
    const menuItems = await MenuItem.find({ isActive: true }).select("name category price");

    // 3. Current Outstanding Amount
    const bills = await Bill.find({ customerId });
    let outstandingAmount = 0;
    bills.forEach((b) => {
      outstandingAmount += b.finalTotal - b.amountPaid;
    });

    // 4. Last 5 Payments
    const recentPayments = await Payment.find({ customerId })
      .sort({ paymentDate: -1 })
      .limit(5);

    // 5. Today's Holiday Status
    const todayHoliday = await Holiday.findOne({
      $or: [
        { customerId: null },
        { customerId },
      ],
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    return NextResponse.json({
      todayMeal: todayMeal ? {
        morningMeal: todayMeal.morningMeal,
        nightMeal: todayMeal.nightMeal,
        notes: todayMeal.notes || "",
      } : {
        morningMeal: "none",
        nightMeal: "none",
        notes: "",
      },
      todayHoliday: todayHoliday ? { reason: todayHoliday.reason } : null,
      outstandingAmount,
      recentPayments,
      menuItems,
    });
  } catch (error: any) {
    console.error("Customer Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
