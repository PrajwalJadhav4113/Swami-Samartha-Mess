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
import { syncCustomerAdvanceBalance, releaseBillAdvanceAllocations } from "@/lib/billing-helper";

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
    return d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
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

      // Validate month is between 0 and 11 (inclusive)
      if (mo < 0 || mo > 11) {
        return NextResponse.json({ error: "Invalid month" }, { status: 400 });
      }

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
    const end = new Date(`${endDate}T23:59:59.999Z`);

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

    console.log(`[BILLING API] Generating bill for customer=${customer.name} (${customerId}), range=${startDate} to ${endDate}. Found ${existingActiveBills.length} existing active bill(s):`, existingActiveBills.map(b => ({ id: b._id.toString(), num: b.billNumber, status: b.status })));


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

    const olderBillIds = existingActiveBills.map((b) => b._id);

    // Calculate advance credit currently locked in older active bills that will be superseded
    let creditLockedInOlderBills = 0;
    if (olderBillIds.length > 0) {
      const paymentsWithOlderAllocations = await Payment.find({
        "allocations.billId": { $in: olderBillIds },
      });
      for (const p of paymentsWithOlderAllocations) {
        for (const alloc of p.allocations) {
          if (olderBillIds.some((id) => id.toString() === alloc.billId.toString())) {
            creditLockedInOlderBills += alloc.amountApplied;
          }
        }
      }
    }

    // Authoritative sync of customer's available unapplied advance credit
    await syncCustomerAdvanceBalance(customerId);

    // Read current unapplied available advance credit directly from customer record
    const updatedCustomer = await Customer.findById(customerId);
    const unallocatedAdvance = Math.max(0, updatedCustomer?.advanceBalance || 0);
    // Total effective available advance includes unallocated credit + credit from older bills being superseded
    const availableAdvance = unallocatedAdvance + creditLockedInOlderBills;

    // Determine advance payment to apply from customer's available advance credit
    let advToApply = parseFloat(advancePayment || 0);
    const maxAllowedPreviewAdv = Math.min(availableAdvance, Math.max(0, subtotal - disc));
    if (parseFloat(advancePayment || 0) === 0) {
      advToApply = maxAllowedPreviewAdv;
    } else {
      advToApply = Math.min(advToApply, maxAllowedPreviewAdv);
    }
    if (advToApply < 0) advToApply = 0;

    const finalTotal = Math.max(0, subtotal - disc - advToApply);

    // Direct BILL_PAYMENT transactions already made towards existing active bills being superseded
    let totalPaidOnSupersededBills = 0;
    if (olderBillIds.length > 0) {
      const directPaymentsOnSuperseded = await Payment.find({
        billId: { $in: olderBillIds },
        paymentType: "BILL_PAYMENT",
      });
      totalPaidOnSupersededBills = directPaymentsOnSuperseded.reduce((sum, p) => sum + p.amount, 0);
    }
    const totalAmountPaid = totalPaidOnSupersededBills; // ONLY direct bill payments, NOT advance credit!

    let computedPaymentStatus: "pending" | "paid" | "partially_paid" = "pending";
    if (finalTotal === 0 || totalAmountPaid >= finalTotal) {
      computedPaymentStatus = "paid";
    } else if (totalAmountPaid > 0) {
      computedPaymentStatus = "partially_paid";
    } else {
      computedPaymentStatus = "pending";
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
        availableAdvanceCredit: availableAdvance,
        advancePayment: advToApply,
        amountPayable: finalTotal,
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

    // 8. Transaction setup BEFORE generating and saving bill
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      transactionStarted = true;
    } catch (e) {
      // Standalone MongoDB fallback
    }

    // Release advance credit allocations from older active bills about to be superseded
    for (const oldId of olderBillIds) {
      await releaseBillAdvanceAllocations(oldId, transactionStarted && session ? session : undefined);
    }
    await syncCustomerAdvanceBalance(customerId, transactionStarted && session ? session : undefined);

    // Fetch fresh customer record after releasing older bills to get actual available credit
    const freshCustomer = await Customer.findById(customerId, null, transactionStarted && session ? { session } : undefined);
    const actualAvailableAdvance = Math.max(0, freshCustomer?.advanceBalance || 0);

    const reqAdv = parseFloat(advancePayment || 0);
    // Explicit backend validation: Reject if user explicitly requested more advance than available
    if (reqAdv > 0 && reqAdv > actualAvailableAdvance) {
      if (transactionStarted && session) await session.abortTransaction();
      return NextResponse.json(
        { error: `Requested advance credit (₹${reqAdv}) exceeds available credit (₹${actualAvailableAdvance}).` },
        { status: 400 }
      );
    }

    // Determine final advance to apply
    const maxAllowedAdv = Math.min(actualAvailableAdvance, Math.max(0, subtotal - disc));
    if (reqAdv > 0) {
      advToApply = Math.min(reqAdv, maxAllowedAdv);
    } else {
      advToApply = maxAllowedAdv;
    }
    if (advToApply < 0) advToApply = 0;

    const genFinalTotal = Math.max(0, subtotal - disc - advToApply);
    let genComputedPaymentStatus: "pending" | "paid" | "partially_paid" = "pending";
    if (genFinalTotal === 0 || totalAmountPaid >= genFinalTotal) {
      genComputedPaymentStatus = "paid";
    } else if (totalAmountPaid > 0) {
      genComputedPaymentStatus = "partially_paid";
    } else {
      genComputedPaymentStatus = "pending";
    }

    // Generate invoice bill number with retry logic
    const dateCode = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    let billNumber = null;
    let billSaved = false;
    let billsCount = await Bill.countDocuments();
    let attempt = 0;
    const maxAttempts = 5;

    while (!billSaved && attempt < maxAttempts) {
      if (attempt > 0) {
        billsCount = await Bill.countDocuments();
      }

      const proposedBillNumber = `SSM-${dateCode}-${String(billsCount + 1 + attempt).padStart(4, "0")}`;

      bill = new Bill({
        billNumber: proposedBillNumber,
        customerId,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        mealDetails: totalMealDetails,
        extraItemsDetails: totalExtraItemsDetails,
        discount: disc,
        advancePayment: advToApply,
        previousBalance,
        finalTotal: genFinalTotal,
        originalTotal: genFinalTotal,
        adjustmentAmount: 0,
        paymentStatus: genComputedPaymentStatus,
        status: "ACTIVE",
        amountPaid: totalAmountPaid,
        isCarriedForward: false,
        notes,
      });

      try {
        await bill.save(transactionStarted && session ? { session } : undefined);
        billNumber = proposedBillNumber;
        billSaved = true;
      } catch (saveError: any) {
        if (saveError.code === 11000 && attempt < maxAttempts - 1) {
          attempt++;
          continue;
        } else {
          throw saveError;
        }
      }
    }

    if (!billSaved) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      billNumber = `SSM-${dateCode}-${timestamp}-${random}`;

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
        finalTotal: genFinalTotal,
        originalTotal: genFinalTotal,
        adjustmentAmount: 0,
        paymentStatus: genComputedPaymentStatus,
        status: "ACTIVE",
        amountPaid: totalAmountPaid,
        isCarriedForward: false,
        notes,
      });

      await bill.save(transactionStarted && session ? { session } : undefined);
    }

    // Mark ALL older active bills for this customer in this period range as SUPERSEDED by the new bill
    const supersededResult = await Bill.updateMany(
      {
        customerId,
        _id: { $ne: bill._id },
        billingPeriodStart: { $lte: end },
        billingPeriodEnd: { $gte: start },
        status: { $nin: ["SUPERSEDED", "CANCELLED"] },
      },
      {
        $set: {
          status: "SUPERSEDED",
          supersededBy: bill._id,
          supersededAt: new Date(),
        },
      },
      transactionStarted && session ? { session } : undefined
    );

    console.log(`[BILLING API] Marked older bills SUPERSEDED. Matched=${supersededResult.matchedCount}, Modified=${supersededResult.modifiedCount}`);

    if (olderBillIds.length > 0) {
      // Transfer any direct BILL_PAYMENT payments attached to superseded bills to the new consolidated bill
      await Payment.updateMany(
        { billId: { $in: olderBillIds }, paymentType: "BILL_PAYMENT" },
        { $set: { billId: bill._id } },
        transactionStarted && session ? { session } : undefined
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

    // Perform FIFO credit allocation from active advance payments and sync customer advance balance
    if (advToApply > 0) {
      let creditNeeded = advToApply;
      const activeAdvances = await Payment.find(
        {
          customerId,
          paymentType: "ADVANCE",
          remainingAmount: { $gt: 0 },
        },
        null,
        transactionStarted && session ? { session } : undefined
      ).sort({ paymentDate: 1 });

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

    // Authoritative sync of customer's available advance credit
    await syncCustomerAdvanceBalance(customerId, transactionStarted && session ? session : undefined);

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

    const activeBillsCount = await Bill.countDocuments({
      customerId,
      billingPeriodStart: { $lte: end },
      billingPeriodEnd: { $gte: start },
      status: { $nin: ["SUPERSEDED", "CANCELLED"] },
    });
    console.log(`[BILLING API VERIFICATION] New Bill ${bill.billNumber} saved. Customer ${customerId} now has ${activeBillsCount} active bill(s) for period.`);

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

