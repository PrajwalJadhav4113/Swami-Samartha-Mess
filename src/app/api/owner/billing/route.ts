import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import Customer from "@/models/Customer";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";
import Notification from "@/models/Notification";
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
    const month = searchParams.get("month"); // e.g. "2026-08"
    const includeSuperseded = searchParams.get("includeSuperseded") === "true";

    const query: any = {};
    if (customerId) query.customerId = customerId;
    if (status) query.paymentStatus = status;

    if (!includeSuperseded) {
      query.status = { $nin: ["SUPERSEDED", "CANCELLED"] };
    }

    if (month && month !== "all" && /^\d{4}-\d{2}$/.test(month)) {
      const [yrStr, moStr] = month.split("-");
      const yr = parseInt(yrStr);
      const mo = parseInt(moStr) - 1; // 0-indexed month
      const mStart = new Date(Date.UTC(yr, mo, 1, 0, 0, 0, 0));
      const mEnd = new Date(Date.UTC(yr, mo + 1, 0, 23, 59, 59, 999));

      query.billingPeriodStart = { $lte: mEnd };
      query.billingPeriodEnd = { $gte: mStart };
    }

    const bills = await Bill.find(query)
      .populate("customerId", "name mobile address pricingType")
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

    // 2. Fetch existing ACTIVE bills overlapping with this period range
    const existingActiveBills = await Bill.find({
      customerId,
      billingPeriodStart: { $lte: end },
      billingPeriodEnd: { $gte: start },
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
    }).sort({ billingPeriodStart: 1 });

    // 3. Fetch all holidays in this period (global OR customer-specific)
    const holidays = await Holiday.find({
      $or: [
        { customerId: null },
        { customerId },
      ],
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

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
          const rate = Math.round((info.sumRates / info.quantity) * 100) / 100;
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

    const totalMealDetails = aggregateMeals(allMealRecords);
    const totalExtraItemsDetails = aggregateExtras(allExtraItems);
    const totalMealsSum = totalMealDetails.reduce((sum, m) => sum + m.amount, 0);
    const totalExtrasSum = totalExtraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    const totalConsumption = totalMealsSum + totalExtrasSum;

    // 5. Calculate previous balance from unpaid active bills from PRIOR billing cycles
    const previousUnpaidBills = await Bill.find({
      customerId,
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
      paymentStatus: { $in: ["pending", "partially_paid"] },
      isCarriedForward: false,
      billingPeriodEnd: { $lt: start },
    });
    const previousBalance = previousUnpaidBills.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);

    // Calculate customer discounts and advance payment
    const customerFixedDiscount = customer.fixedDiscount || 0;
    const explicitDisc = parseFloat(discount || 0);
    const disc = explicitDisc + customerFixedDiscount;

    const subtotal = totalConsumption + previousBalance;

    // Determine advance payment to apply from customer's advance balance
    let advToApply = parseFloat(advancePayment || 0);
    if (customer.advanceBalance && customer.advanceBalance > 0) {
      if (advToApply === 0) {
        advToApply = Math.min(customer.advanceBalance, subtotal - disc);
      }
    }

    const finalTotal = Math.max(0, subtotal - disc - advToApply);

    // Payments already made towards existing active bills being superseded
    const totalPaidOnSupersededBills = existingActiveBills.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
    const totalAmountPaid = totalPaidOnSupersededBills + advToApply;

    let computedPaymentStatus: "pending" | "paid" | "partially_paid" = "pending";
    if (totalAmountPaid >= finalTotal && finalTotal > 0) {
      computedPaymentStatus = "paid";
    } else if (totalAmountPaid > 0) {
      computedPaymentStatus = "partially_paid";
    } else if (finalTotal === 0) {
      computedPaymentStatus = "paid";
    }

    // 6. If this is a PREVIEW request, return calculated values and stop here
    if (preview) {
      return NextResponse.json({
        preview: true,
        totalConsumption,
        alreadyBilled: 0,
        unbilledConsumption: totalConsumption,
        mealDetails: totalMealDetails,
        extraItemsDetails: totalExtraItemsDetails,
        previousBalance,
        discount: disc,
        advancePayment: advToApply,
        finalTotal,
        existingBills: existingActiveBills,
        alreadyBilledDatesRange: "None",
        unbilledDatesRange: formatIntervals([{ start, end }]),
      });
    }

    // 7. Generation Mode validation: Do not create zero-value consumption bills if no meals/extras exist
    if (totalMealDetails.length === 0 && totalExtraItemsDetails.length === 0) {
      return NextResponse.json(
        {
          error: "No meal or extra item records found for this customer in the selected billing period.",
        },
        { status: 400 }
      );
    }

    // 8. Generate invoice bill number
    const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const billsCount = await Bill.countDocuments();
    const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

    bill = new Bill({
      billNumber,
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      mealDetails: totalMealDetails,
      extraItemsDetails: totalExtraItemsDetails,
      discount: disc,
      advancePayment: advToApply,
      previousBalance,
      finalTotal,
      originalTotal: finalTotal,
      adjustmentAmount: 0,
      paymentStatus: computedPaymentStatus,
      status: "ACTIVE",
      amountPaid: totalAmountPaid,
      isCarriedForward: false,
      notes,
    });

    // 9. Transaction setup
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      transactionStarted = true;
    } catch (e) {
      // Standalone MongoDB fallback
    }

    // Save the new bill first
    await bill.save(transactionStarted && session ? { session } : undefined);

    // Mark ALL older active bills for this customer in this period range as SUPERSEDED by the new bill
    const olderBillIds = existingActiveBills.map((b) => b._id);
    if (olderBillIds.length > 0) {
      await Bill.updateMany(
        { _id: { $in: olderBillIds } },
        {
          $set: {
            status: "SUPERSEDED",
            supersededBy: bill._id,
            supersededAt: new Date(),
          },
        },
        transactionStarted && session ? { session } : undefined
      );

      // Transfer any payments attached to superseded bills to the new consolidated bill
      await Payment.updateMany(
        { billId: { $in: olderBillIds } },
        { $set: { billId: bill._id } },
        transactionStarted && session ? { session } : undefined
      );

      await Payment.updateMany(
        { "allocations.billId": { $in: olderBillIds } },
        { $set: { "allocations.$[elem].billId": bill._id } },
        {
          arrayFilters: [{ "elem.billId": { $in: olderBillIds } }],
          ...(transactionStarted && session ? { session } : {}),
        }
      );
    }

    // Associate ALL consumed meals in this period to the new consolidated bill
    const allMealIds = allMealRecords.map((r) => r._id);
    if (allMealIds.length > 0) {
      await DailyMealRecord.updateMany(
        { _id: { $in: allMealIds } },
        { $set: { billingStatus: "BILLED", billId: bill._id } },
        transactionStarted && session ? { session } : undefined
      );
    }

    // Associate ALL consumed extras in this period to the new consolidated bill
    const allExtraIds = allExtraItems.map((item) => item._id);
    if (allExtraIds.length > 0) {
      await DailyMealItem.updateMany(
        { _id: { $in: allExtraIds } },
        { $set: { billingStatus: "BILLED", billId: bill._id } },
        transactionStarted && session ? { session } : undefined
      );
    }

    // Mark prior cycle unpaid bills as carried forward
    if (previousUnpaidBills.length > 0) {
      await Bill.updateMany(
        { _id: { $in: previousUnpaidBills.map((b) => b._id) } },
        { $set: { isCarriedForward: true } },
        transactionStarted && session ? { session } : undefined
      );
    }

    // Update customer advance balance and perform FIFO credit allocation
    if (advToApply > 0) {
      customer.advanceBalance = (customer.advanceBalance || 0) - advToApply;
      await customer.save(transactionStarted && session ? { session } : undefined);

      let creditNeeded = advToApply;
      const activeAdvances = await Payment.find({
        customerId,
        paymentType: "ADVANCE",
        remainingAmount: { $gt: 0 },
      }).sort({ paymentDate: 1 });

      for (const adv of activeAdvances) {
        if (creditNeeded <= 0) break;
        const toAllocate = Math.min(adv.remainingAmount, creditNeeded);
        adv.remainingAmount -= toAllocate;
        adv.allocations.push({
          billId: bill._id,
          amountApplied: toAllocate,
          appliedAt: new Date(),
        });
        await adv.save(transactionStarted && session ? { session } : undefined);
        creditNeeded -= toAllocate;
      }
    }

    // Commit Transaction
    if (transactionStarted && session) {
      await session.commitTransaction();
    }

    // Deliver in-app notification to customer
    try {
      await Notification.create({
        customerId,
        title: `New Bill Generated`,
        message: `Invoice #${bill.billNumber} has been generated. Total amount payable: ₹${finalTotal}.`,
        type: "bill_generated",
        link: `/customer/bills/${bill._id}`,
      });
    } catch (notifErr) {
      console.error("Failed to create customer notification:", notifErr);
    }

    const populated = await Bill.findById(bill._id).populate("customerId", "name mobile address");
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    if (transactionStarted && session) {
      await session.abortTransaction();
    }
    console.error("Generate Bill API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

