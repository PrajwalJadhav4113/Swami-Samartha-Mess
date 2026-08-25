import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Customer from "@/models/Customer";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import mongoose from "mongoose";

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

interface DateInterval {
  start: Date;
  end: Date;
}

function mergeIntervals(intervals: DateInterval[]): DateInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: DateInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    const lastEndPlusOne = new Date(last.end);
    lastEndPlusOne.setUTCDate(lastEndPlusOne.getUTCDate() + 1);
    if (current.start <= lastEndPlusOne) {
      if (current.end > last.end) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function subtractIntervals(selected: DateInterval, billed: DateInterval[]): DateInterval[] {
  const unbilled: DateInterval[] = [];
  let currentStart = new Date(selected.start);
  for (const interval of billed) {
    if (interval.end < currentStart) {
      continue;
    }
    if (interval.start > selected.end) {
      break;
    }
    if (interval.start > currentStart) {
      const gapEnd = new Date(interval.start);
      gapEnd.setUTCDate(gapEnd.getUTCDate() - 1);
      unbilled.push({ start: new Date(currentStart), end: gapEnd });
    }
    const nextStart = new Date(interval.end);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    currentStart = nextStart;
  }
  if (currentStart <= selected.end) {
    unbilled.push({ start: new Date(currentStart), end: new Date(selected.end) });
  }
  return unbilled;
}

function formatIntervals(intervals: DateInterval[]): string {
  if (intervals.length === 0) return "None";
  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  return intervals
    .map((val) => {
      if (val.start.getTime() === val.end.getTime()) {
        return formatDate(val.start);
      }
      return `${formatDate(val.start)} – ${formatDate(val.end)}`;
    })
    .join(", ");
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
  let session: mongoose.ClientSession | null = null;
  let transactionStarted = false;
  let bill: any = null;

  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const body = await request.json();
    const { customerId, startDate, endDate, discount, advancePayment, notes, preview } = body;

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

    // Calculate intersections of this range with existing bills
    const existingBills = await Bill.find({
      customerId,
      billingPeriodStart: { $lte: end },
      billingPeriodEnd: { $gte: start },
    }).sort({ billingPeriodStart: 1 });

    const intersections: DateInterval[] = [];
    existingBills.forEach((b) => {
      const bStart = new Date(b.billingPeriodStart);
      const bEnd = new Date(b.billingPeriodEnd);
      const overlapStart = bStart < start ? start : bStart;
      const overlapEnd = bEnd > end ? end : bEnd;
      if (overlapStart <= overlapEnd) {
        intersections.push({ start: overlapStart, end: overlapEnd });
      }
    });

    const mergedBilled = mergeIntervals(intersections);
    const unbilledIntervals = subtractIntervals({ start, end }, mergedBilled);

    const alreadyBilledDatesRange = formatIntervals(mergedBilled);
    const unbilledDatesRange = formatIntervals(unbilledIntervals);

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

    // 4. Fetch ALL daily meal records and extra items in this date range
    const allMealRecords = await DailyMealRecord.find({
      customerId,
      date: { $gte: start, $lte: end },
    });

    const allExtraItems = await DailyMealItem.find({
      customerId,
      date: { $gte: start, $lte: end },
    });

    // 5. Partition records into unbilled and already billed
    const unbilledMealRecords = allMealRecords.filter(
      (r) => r.billingStatus !== "BILLED" && r.billId == null
    );
    const billedMealRecords = allMealRecords.filter(
      (r) => r.billingStatus === "BILLED" || r.billId != null
    );

    const unbilledExtraItems = allExtraItems.filter(
      (item) => item.billingStatus !== "BILLED" && item.billId == null
    );
    const billedExtraItems = allExtraItems.filter(
      (item) => item.billingStatus === "BILLED" || item.billId != null
    );

    // Reusable function to aggregate meal records into details format
    const aggregateMeals = (records: typeof allMealRecords) => {
      const recordsMap = new Map(
        records.map((r) => {
          const d = new Date(r.date);
          d.setUTCHours(0, 0, 0, 0);
          return [d.getTime(), r];
        })
      );

      const mealTally = {
        morning_full: { quantity: 0, sumRates: 0 },
        morning_half: { quantity: 0, sumRates: 0 },
        night_full: { quantity: 0, sumRates: 0 },
        night_half: { quantity: 0, sumRates: 0 },
      };

      dates.forEach((date) => {
        if (isHoliday(date)) return;
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

      const details: any[] = [];
      Object.entries(mealTally).forEach(([type, info]) => {
        if (info.quantity > 0) {
          const rate = Math.round((info.sumRates / info.quantity) * 100) / 100; // avg rate
          details.push({
            type,
            quantity: info.quantity,
            rate,
            amount: info.quantity * rate,
          });
        }
      });
      return details;
    };

    // Reusable function to aggregate extra items into details format
    const aggregateExtras = (items: typeof allExtraItems) => {
      const extraTallyMap = new Map<string, { quantity: number; price: number }>();
      items.forEach((item) => {
        if (isHoliday(new Date(item.date))) return;

        const key = `${item.name}-${item.price}`;
        if (!extraTallyMap.has(key)) {
          extraTallyMap.set(key, { quantity: 0, price: item.price });
        }
        extraTallyMap.get(key)!.quantity += item.quantity;
      });

      const details: any[] = [];
      extraTallyMap.forEach((info, nameAndPrice) => {
        const name = nameAndPrice.split("-")[0];
        details.push({
          name,
          quantity: info.quantity,
          rate: info.price,
          amount: info.quantity * info.price,
        });
      });
      return details;
    };

    // Aggregate tallies
    const unbilledMealDetails = aggregateMeals(unbilledMealRecords);
    const unbilledExtraItemsDetails = aggregateExtras(unbilledExtraItems);
    const unbilledMealsSum = unbilledMealDetails.reduce((sum, m) => sum + m.amount, 0);
    const unbilledExtrasSum = unbilledExtraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    const unbilledConsumption = unbilledMealsSum + unbilledExtrasSum;

    const billedMealDetails = aggregateMeals(billedMealRecords);
    const billedExtraItemsDetails = aggregateExtras(billedExtraItems);
    const billedMealsSum = billedMealDetails.reduce((sum, m) => sum + m.amount, 0);
    const billedExtrasSum = billedExtraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    const alreadyBilled = billedMealsSum + billedExtrasSum;

    const totalMealDetails = aggregateMeals(allMealRecords);
    const totalExtraItemsDetails = aggregateExtras(allExtraItems);
    const totalMealsSum = totalMealDetails.reduce((sum, m) => sum + m.amount, 0);
    const totalExtrasSum = totalExtraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    const totalConsumption = totalMealsSum + totalExtrasSum;

    // 7. Calculate previous balance from unpaid bills that haven't been carried forward
    const previousUnpaidBills = await Bill.find({
      customerId,
      paymentStatus: { $in: ["pending", "partially_paid"] },
      isCarriedForward: false,
    });
    const previousBalance = previousUnpaidBills.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);

    // Calculate customer discounts and advance payment
    const customerFixedDiscount = customer.fixedDiscount || 0;
    const explicitDisc = parseFloat(discount || 0);
    const disc = explicitDisc + customerFixedDiscount;

    const subtotal = unbilledConsumption + previousBalance;

    // Determine advance payment to apply from customer's advance balance
    let advToApply = parseFloat(advancePayment || 0);
    if (customer.advanceBalance && customer.advanceBalance > 0) {
      if (advToApply === 0) {
        advToApply = Math.min(customer.advanceBalance, subtotal - disc);
      }
    }

    const finalTotal = Math.max(0, subtotal - disc - advToApply);

    // 8. If this is a PREVIEW request, return calculated values and stop here
    if (preview) {
      // Find overlapping bills for this range for visual representation
      const previewBills = await Bill.find({
        customerId,
        billingPeriodStart: { $lte: end },
        billingPeriodEnd: { $gte: start },
      })
        .select("billNumber billingPeriodStart billingPeriodEnd finalTotal paymentStatus")
        .sort({ createdAt: -1 });

      return NextResponse.json({
        preview: true,
        totalConsumption,
        alreadyBilled,
        unbilledConsumption,
        mealDetails: unbilledMealDetails,
        extraItemsDetails: unbilledExtraItemsDetails,
        previousBalance,
        discount: disc,
        advancePayment: advToApply,
        finalTotal,
        existingBills: previewBills,
        alreadyBilledDatesRange,
        unbilledDatesRange,
      });
    }

    // 9. Generation Mode validation: Do not create zero-value consumption bills
    if (unbilledMealDetails.length === 0 && unbilledExtraItemsDetails.length === 0) {
      return NextResponse.json(
        {
          error: "No unbilled consumption found. All consumption for this period has already been included in existing bills.",
        },
        { status: 400 }
      );
    }

    // 10. Generate invoice bill number
    const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const billsCount = await Bill.countDocuments();
    const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

    bill = new Bill({
      billNumber,
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      mealDetails: unbilledMealDetails,
      extraItemsDetails: unbilledExtraItemsDetails,
      discount: disc,
      advancePayment: advToApply,
      previousBalance,
      finalTotal,
      paymentStatus: finalTotal === 0 ? "paid" : "pending",
      amountPaid: 0,
      isCarriedForward: false,
      notes,
    });

    // 11. Transaction setup
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      transactionStarted = true;
    } catch (e) {
      // Standalone MongoDB fallback
    }

    // Lock consumed meals to this bill (optimistic concurrency update)
    const unbilledMealIds = unbilledMealRecords.map((r) => r._id);
    if (unbilledMealIds.length > 0) {
      const updateResult = await DailyMealRecord.updateMany(
        { _id: { $in: unbilledMealIds }, billingStatus: { $ne: "BILLED" } },
        { $set: { billingStatus: "BILLED", billId: bill._id } },
        transactionStarted && session ? { session } : undefined
      );
      if (updateResult.modifiedCount !== unbilledMealIds.length) {
        throw new Error("Concurrency Conflict: Some meal records in this period have already been billed by another transaction.");
      }
    }

    // Lock consumed extras to this bill (optimistic concurrency update)
    const unbilledExtraIds = unbilledExtraItems.map((item) => item._id);
    if (unbilledExtraIds.length > 0) {
      const updateResult = await DailyMealItem.updateMany(
        { _id: { $in: unbilledExtraIds }, billingStatus: { $ne: "BILLED" } },
        { $set: { billingStatus: "BILLED", billId: bill._id } },
        transactionStarted && session ? { session } : undefined
      );
      if (updateResult.modifiedCount !== unbilledExtraIds.length) {
        throw new Error("Concurrency Conflict: Some extra items in this period have already been billed by another transaction.");
      }
    }

    // Save the new bill
    await bill.save(transactionStarted && session ? { session } : undefined);

    // Mark old bills as carried forward
    if (previousUnpaidBills.length > 0) {
      await Bill.updateMany(
        { _id: { $in: previousUnpaidBills.map((b) => b._id) } },
        { $set: { isCarriedForward: true } },
        transactionStarted && session ? { session } : undefined
      );
    }

    // Update customer advance balance
    if (advToApply > 0) {
      customer.advanceBalance = (customer.advanceBalance || 0) - advToApply;
      await customer.save(transactionStarted && session ? { session } : undefined);
    }

    // Commit Transaction
    if (transactionStarted && session) {
      await session.commitTransaction();
    }

    const populated = await Bill.findById(bill._id).populate("customerId", "name mobile address");
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    if (transactionStarted && session) {
      await session.abortTransaction();
    } else {
      // Revert records if transaction wasn't active
      if (bill && bill._id) {
        try {
          await DailyMealRecord.updateMany(
            { billId: bill._id },
            { $set: { billingStatus: "UNBILLED", billId: null } }
          );
          await DailyMealItem.updateMany(
            { billId: bill._id },
            { $set: { billingStatus: "UNBILLED", billId: null } }
          );
        } catch (revertError) {
          console.error("Failed to revert meal/extra records status:", revertError);
        }
      }
    }
    console.error("Generate Bill API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

