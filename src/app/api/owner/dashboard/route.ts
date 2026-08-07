import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import DailyMealRecord from "@/models/DailyMealRecord";
import Holiday from "@/models/Holiday";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
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

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(`${todayStr}T00:00:00.000Z`);

    const totalCustomers = await Customer.countDocuments();
    const activeCustomersList = await Customer.find({ status: "active" });
    const activeCustomers = activeCustomersList.length;
    const todayMeals = await DailyMealRecord.countDocuments({
      date: today,
      $or: [
        { morningMeal: { $in: ["half", "full"] } },
        { nightMeal: { $in: ["half", "full"] } },
      ],
    });

    const todayRecords = await DailyMealRecord.find({ date: today });
    let morningServed = 0;
    let nightServed = 0;

    const morningServedCustIds = new Set();
    const nightServedCustIds = new Set();

    todayRecords.forEach(r => {
      if (r.morningMeal && r.morningMeal !== "none") {
        morningServed++;
        morningServedCustIds.add(r.customerId.toString());
      }
      if (r.nightMeal && r.nightMeal !== "none") {
        nightServed++;
        nightServedCustIds.add(r.customerId.toString());
      }
    });
    const remainingMorning = Math.max(0, activeCustomers - morningServed);
    const remainingNight = Math.max(0, activeCustomers - nightServed);

    const remainingMorningCustomers = activeCustomersList
      .filter(c => !morningServedCustIds.has(c._id.toString()))
      .map(c => ({ _id: c._id, name: c.name, mobile: c.mobile }));

    const remainingNightCustomers = activeCustomersList
      .filter(c => !nightServedCustIds.has(c._id.toString()))
      .map(c => ({ _id: c._id, name: c.name, mobile: c.mobile }));

    const todayHolidays = await Holiday.countDocuments({
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    // 2. Financial Metrics
    const allBills = await Bill.find();
    let outstandingAmount = 0;
    let monthlyRevenue = 0;
    let weeklyRevenue = 0;

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    allBills.forEach((b) => {
      // Outstanding
      outstandingAmount += b.finalTotal - b.amountPaid;

      const billDate = new Date(b.createdAt);
      if (billDate >= startOfMonth) {
        monthlyRevenue += b.finalTotal;
      }
      if (billDate >= sevenDaysAgo) {
        weeklyRevenue += b.finalTotal;
      }
    });

    // 3. Payment Status Breakdown
    const paymentStatusCounts = {
      paid: 0,
      partially_paid: 0,
      pending: 0,
    };
    allBills.forEach((b) => {
      if (b.paymentStatus === "paid") paymentStatusCounts.paid += 1;
      else if (b.paymentStatus === "partially_paid") paymentStatusCounts.partially_paid += 1;
      else paymentStatusCounts.pending += 1;
    });

    // 4. Revenue Trend (Last 6 Months)
    const revenueTrend: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - i);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthName = d.toLocaleString("default", { month: "short" });

      const mStart = new Date(Date.UTC(year, month, 1));
      const mEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      const monthBills = allBills.filter(
        (b) => new Date(b.createdAt) >= mStart && new Date(b.createdAt) <= mEnd
      );
      const total = monthBills.reduce((sum, b) => sum + b.finalTotal, 0);

      revenueTrend.push({
        month: `${monthName} ${year}`,
        revenue: total,
      });
    }

    // 5. Meals Served (Last 7 Days)
    const mealsServedTrend: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dStr = d.toISOString().split("T")[0];
      const dateVal = new Date(`${dStr}T00:00:00.000Z`);

      const count = await DailyMealRecord.countDocuments({
        date: dateVal,
        $or: [
          { morningMeal: { $in: ["half", "full"] } },
          { nightMeal: { $in: ["half", "full"] } },
        ],
      });

      const dayName = d.toLocaleString("default", { weekday: "short" });
      mealsServedTrend.push({
        day: dayName,
        meals: count,
      });
    }

    // 6. Customer Growth (Last 6 Months)
    const customerGrowth: any[] = [];
    const allCustomers = await Customer.find();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setUTCMonth(d.getUTCMonth() - i);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const monthName = d.toLocaleString("default", { month: "short" });

      const mEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      // Active customers registered on or before this month end
      const count = allCustomers.filter((c) => new Date(c.joiningDate) <= mEnd).length;

      customerGrowth.push({
        month: `${monthName} ${year}`,
        customers: count,
      });
    }

    return NextResponse.json({
      stats: {
        totalCustomers,
        activeCustomers,
        todayMeals,
        todayHolidays,
        outstandingAmount,
        monthlyRevenue,
        weeklyRevenue,
        pendingPaymentsCount: paymentStatusCounts.pending + paymentStatusCounts.partially_paid,
        remainingMorning,
        remainingNight,
        remainingMorningCustomers,
        remainingNightCustomers,
      },
      charts: {
        revenueTrend,
        mealsServedTrend,
        customerGrowth,
        paymentStatus: [
          { name: "Paid", value: paymentStatusCounts.paid },
          { name: "Partially Paid", value: paymentStatusCounts.partially_paid },
          { name: "Pending", value: paymentStatusCounts.pending },
        ],
      },
    });
  } catch (error: any) {
    console.error("Dashboard Stats API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
