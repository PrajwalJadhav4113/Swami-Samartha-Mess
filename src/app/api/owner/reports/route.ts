import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import DailyMealItem from "@/models/DailyMealItem";
import DailyMealRecord from "@/models/DailyMealRecord";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function GET(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    if (!startStr || !endStr) {
      return NextResponse.json({ error: "Missing startDate or endDate parameters" }, { status: 400 });
    }

    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T23:59:59.999Z`);

    // 1. Fetch Revenue (Bills generated)
    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
    }).populate("customerId", "name mobile");

    const totalRevenue = bills.reduce((sum, b) => sum + b.finalTotal, 0);

    // 2. Fetch Payments received
    const payments = await Payment.find({
      paymentDate: { $gte: start, $lte: end },
    }).populate("customerId", "name mobile");

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    // 3. Outstanding Payments List (Any customer with unpaid bills)
    const outstandingBills = await Bill.find({
      paymentStatus: { $in: ["pending", "partially_paid"] },
    }).populate("customerId", "name mobile");

    const outstandingCustomersMap = new Map<string, { customerName: string; mobile: string; outstanding: number }>();
    outstandingBills.forEach((b) => {
      const c = b.customerId as any;
      if (!c) return;
      const cId = c._id.toString();
      const unpaid = b.finalTotal - b.amountPaid;

      if (!outstandingCustomersMap.has(cId)) {
        outstandingCustomersMap.set(cId, {
          customerName: c.name,
          mobile: c.mobile,
          outstanding: 0,
        });
      }
      outstandingCustomersMap.get(cId)!.outstanding += unpaid;
    });

    const outstandingPayments = Array.from(outstandingCustomersMap.values()).sort(
      (a, b) => b.outstanding - a.outstanding
    );

    // 4. Popular Extras
    const extraItems = await DailyMealItem.find({
      date: { $gte: start, $lte: end },
    });

    const popularItemsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    extraItems.forEach((item) => {
      const name = item.name;
      if (!popularItemsMap.has(name)) {
        popularItemsMap.set(name, { name, quantity: 0, revenue: 0 });
      }
      const entry = popularItemsMap.get(name)!;
      entry.quantity += item.quantity;
      entry.revenue += item.quantity * item.price;
    });

    // Add basic meals tally to popular items
    const mealRecords = await DailyMealRecord.find({
      date: { $gte: start, $lte: end },
    });

    let morningFullQty = 0;
    let morningFullRev = 0;
    let morningHalfQty = 0;
    let morningHalfRev = 0;
    let nightFullQty = 0;
    let nightFullRev = 0;
    let nightHalfQty = 0;
    let nightHalfRev = 0;

    mealRecords.forEach((r) => {
      if (r.morningMeal === "full") {
        morningFullQty += 1;
        morningFullRev += r.morningPrice;
      } else if (r.morningMeal === "half") {
        morningHalfQty += 1;
        morningHalfRev += r.morningPrice;
      }

      if (r.nightMeal === "full") {
        nightFullQty += 1;
        nightFullRev += r.nightPrice;
      } else if (r.nightMeal === "half") {
        nightHalfQty += 1;
        nightHalfRev += r.nightPrice;
      }
    });

    const popularItems = Array.from(popularItemsMap.values());
    if (morningFullQty > 0) popularItems.push({ name: "Morning Full Tiffin", quantity: morningFullQty, revenue: morningFullRev });
    if (morningHalfQty > 0) popularItems.push({ name: "Morning Half Tiffin", quantity: morningHalfQty, revenue: morningHalfRev });
    if (nightFullQty > 0) popularItems.push({ name: "Night Full Tiffin", quantity: nightFullQty, revenue: nightFullRev });
    if (nightHalfQty > 0) popularItems.push({ name: "Night Half Tiffin", quantity: nightHalfQty, revenue: nightHalfRev });

    popularItems.sort((a, b) => b.quantity - a.quantity);

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalCollected,
        netOutstanding: outstandingBills.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0),
      },
      revenueList: bills.map((b) => ({
        billNumber: b.billNumber,
        customerName: (b.customerId as any)?.name || "Unknown",
        amount: b.finalTotal,
        date: b.createdAt,
        status: b.paymentStatus,
      })),
      collectionList: payments.map((p) => ({
        customerName: (p.customerId as any)?.name || "Unknown",
        amount: p.amount,
        date: p.paymentDate,
        mode: p.paymentMode,
        reference: p.transactionReference || "",
      })),
      outstandingPayments,
      popularItems,
    });
  } catch (error: any) {
    console.error("Get Reports API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
