import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Customer from "@/models/Customer";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
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

// Helper to generate list of dates between start and end inclusive
function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate.getTime());
  // Normalize time
  curr.setUTCHours(0, 0, 0, 0);
  const last = new Date(endDate.getTime());
  last.setUTCHours(0, 0, 0, 0);

  while (curr <= last) {
    dates.push(new Date(curr.getTime()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");

    const query: any = {};
    if (customerId) query.customerId = customerId;
    if (status) query.paymentStatus = status;

    const bills = await Bill.find(query)
      .populate("customerId", "name mobile address")
      .sort({ createdAt: -1 });

    return NextResponse.json(bills);
  } catch (error: any) {
    console.error("Get Bills API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { customerId, startDate, endDate, discount, advancePayment, notes } = await request.json();

    if (!customerId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "Invalid billing period dates" }, { status: 400 });
    }

    // 1. Fetch customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // 2. Fetch all holidays in this period (global OR customer-specific)
    const holidays = await Holiday.find({
      $or: [
        { customerId: null },
        { customerId },
      ],
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    // Helper function to check if a specific date is a holiday
    const isHoliday = (date: Date) => {
      const dTime = date.getTime();
      return holidays.some((h) => {
        const hStart = new Date(h.startDate);
        hStart.setUTCHours(0, 0, 0, 0);
        const hEnd = new Date(h.endDate);
        hEnd.setUTCHours(23, 59, 59, 999);
        return dTime >= hStart.getTime() && dTime <= hEnd.getTime();
      });
    };

    // 3. Generate all dates in period
    const dates = getDatesInRange(start, end);

    // 4. Fetch daily meal records and extra items
    const mealRecords = await DailyMealRecord.find({
      customerId,
      date: { $gte: start, $lte: end },
    });
    const recordsMap = new Map(mealRecords.map((r) => [r.date.getTime(), r]));

    const extraItems = await DailyMealItem.find({
      customerId,
      date: { $gte: start, $lte: end },
    });

    // 5. Calculate Basic Meal Tally (excluding holidays)
    const mealTally = {
      morning_full: { quantity: 0, sumRates: 0 },
      morning_half: { quantity: 0, sumRates: 0 },
      night_full: { quantity: 0, sumRates: 0 },
      night_half: { quantity: 0, sumRates: 0 },
    };

    dates.forEach((date) => {
      if (isHoliday(date)) {
        // Skip charging basic meal if it's a holiday
        return;
      }

      const rec = recordsMap.get(date.getTime());
      if (!rec) return;

      if (rec.morningMeal === "full") {
        mealTally.morning_full.quantity += 1;
        mealTally.morning_full.sumRates += rec.morningPrice;
      } else if (rec.morningMeal === "half") {
        mealTally.morning_half.quantity += 1;
        mealTally.morning_half.sumRates += rec.morningPrice;
      }

      if (rec.nightMeal === "full") {
        mealTally.night_full.quantity += 1;
        mealTally.night_full.sumRates += rec.nightPrice;
      } else if (rec.nightMeal === "half") {
        mealTally.night_half.quantity += 1;
        mealTally.night_half.sumRates += rec.nightPrice;
      }
    });

    // Structure meal details
    const mealDetails: any[] = [];
    Object.entries(mealTally).forEach(([type, info]) => {
      if (info.quantity > 0) {
        const rate = Math.round((info.sumRates / info.quantity) * 100) / 100; // avg rate
        mealDetails.push({
          type,
          quantity: info.quantity,
          rate,
          amount: info.quantity * rate,
        });
      }
    });

    // 6. Aggregate extra items
    const extraTallyMap = new Map<string, { quantity: number; price: number }>();
    extraItems.forEach((item) => {
      if (isHoliday(new Date(item.date))) {
        // Normally extra items aren't consumed on holidays, but skip if they are
        return;
      }
      
      const key = `${item.name}-${item.price}`;
      if (!extraTallyMap.has(key)) {
        extraTallyMap.set(key, { quantity: 0, price: item.price });
      }
      extraTallyMap.get(key)!.quantity += item.quantity;
    });

    const extraItemsDetails: any[] = [];
    extraTallyMap.forEach((info, nameAndPrice) => {
      const name = nameAndPrice.split("-")[0];
      extraItemsDetails.push({
        name,
        quantity: info.quantity,
        rate: info.price,
        amount: info.quantity * info.price,
      });
    });

    // 7. Calculate previous balance from unpaid bills that haven't been carried forward
    const previousUnpaidBills = await Bill.find({
      customerId,
      paymentStatus: { $in: ["pending", "partially_paid"] },
      isCarriedForward: false,
    });
    const previousBalance = previousUnpaidBills.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);

    // 8. Calculate Totals
    const mealsSum = mealDetails.reduce((sum, m) => sum + m.amount, 0);
    const extrasSum = extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    
    // Apply customer fixed discount in addition to any explicit discount
    const customerFixedDiscount = customer.fixedDiscount || 0;
    const explicitDisc = parseFloat(discount || 0);
    const disc = explicitDisc + customerFixedDiscount;

    const subtotal = mealsSum + extrasSum + previousBalance;
    
    // Determine advance payment to apply from customer's advance balance
    let advToApply = parseFloat(advancePayment || 0);
    if (customer.advanceBalance && customer.advanceBalance > 0) {
      // If no explicit advance payment is passed, use up to what's available
      if (advToApply === 0) {
        advToApply = Math.min(customer.advanceBalance, subtotal - disc);
      }
    }

    const finalTotal = Math.max(0, subtotal - disc - advToApply);

    // 9. Generate invoice bill number
    const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const billsCount = await Bill.countDocuments();
    const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

    // 10. Save invoice
    const bill = await Bill.create({
      billNumber,
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      mealDetails,
      extraItemsDetails,
      discount: disc,
      advancePayment: advToApply,
      previousBalance,
      finalTotal,
      paymentStatus: finalTotal === 0 ? "paid" : "pending",
      amountPaid: 0,
      isCarriedForward: false,
      notes,
    });

    // 11. Mark old bills as carried forward and update customer advance balance
    if (previousUnpaidBills.length > 0) {
      await Bill.updateMany(
        { _id: { $in: previousUnpaidBills.map(b => b._id) } },
        { $set: { isCarriedForward: true } }
      );
    }

    if (advToApply > 0) {
      customer.advanceBalance = (customer.advanceBalance || 0) - advToApply;
      await customer.save();
    }

    const populated = await Bill.findById(bill._id).populate("customerId", "name mobile address");
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Generate Bill API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
