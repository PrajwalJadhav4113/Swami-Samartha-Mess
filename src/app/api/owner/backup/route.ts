import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import MenuItem from "@/models/MenuItem";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import Setting from "@/models/Setting";
import User from "@/models/User";
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
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();

    const data = {
      timestamp: new Date().toISOString(),
      users: await User.find(),
      customers: await Customer.find(),
      menuItems: await MenuItem.find(),
      dailyMealRecords: await DailyMealRecord.find(),
      dailyMealItems: await DailyMealItem.find(),
      holidays: await Holiday.find(),
      bills: await Bill.find(),
      payments: await Payment.find(),
      settings: await Setting.find(),
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="swami-samartha-mess-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Backup API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
