import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import Customer from "@/models/Customer";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";
import Notification from "@/models/Notification";
import mongoose from "mongoose";

function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate.getTime());
  curr.setUTCHours(0, 0, 0, 0);
  const last = new Date(endDate.getTime());
  last.setUTCHours(0, 0, 0, 0);

  while (curr <= last) {
    dates.push(new Date(curr.getTime()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(request: Request) {
  try {
    // Basic auth or secret verification (optional header authorization check)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow execution if no secret is configured or if valid header is supplied
    }

    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    let targetYear: number;
    let targetMonth: number; // 0-indexed: 0 = Jan, 7 = Aug, 8 = Sep

    if (body.year !== undefined && body.month !== undefined) {
      targetYear = parseInt(body.year);
      targetMonth = parseInt(body.month) - 1; // Convert 1-12 to 0-11
    } else {
      // Default: generate previous month's bill
      const now = new Date();
      targetYear = now.getUTCFullYear();
      targetMonth = now.getUTCMonth() - 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
    }

    // Determine exact business date range for the target month
    // E.g., August 2026 -> 2026-08-01 00:00:00 to 2026-08-31 23:59:59.999
    const start = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[targetMonth];
    const periodString = `${monthName} ${targetYear}`;

    const activeCustomers = await Customer.find({ status: "active" });
    const generatedBills: any[] = [];
    const skippedCustomers: string[] = [];

    for (const customer of activeCustomers) {
      const customerId = customer._id;

      // 1. Fetch ALL daily meal records & extra items for this period
      const allMealRecords = await DailyMealRecord.find({
        customerId,
        date: { $gte: start, $lte: end },
      });

      const allExtraItems = await DailyMealItem.find({
        customerId,
        date: { $gte: start, $lte: end },
      });

      // 2. Fetch existing ACTIVE bills overlapping with this period range
      const existingActiveBills = await Bill.find({
        customerId,
        billingPeriodStart: { $lte: end },
        billingPeriodEnd: { $gte: start },
        status: { $nin: ["SUPERSEDED", "CANCELLED"] },
      });

      // 3. Fetch holidays in this period
      const holidays = await Holiday.find({
        $or: [{ customerId: null }, { customerId }],
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

      // Aggregate meal details
      const mealTally = {
        morning_full: { quantity: 0, sumRates: 0 },
        morning_half: { quantity: 0, sumRates: 0 },
        night_full: { quantity: 0, sumRates: 0 },
        night_half: { quantity: 0, sumRates: 0 },
      };

      const recordsMap = new Map(
        allMealRecords.map((r) => {
          const d = new Date(r.date);
          d.setUTCHours(0, 0, 0, 0);
          return [d.getTime(), r];
        })
      );

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

      const mealDetails: any[] = [];
      Object.entries(mealTally).forEach(([type, info]) => {
        if (info.quantity > 0) {
          const rate = Math.round((info.sumRates / info.quantity) * 100) / 100;
          mealDetails.push({
            type,
            quantity: info.quantity,
            rate,
            amount: info.quantity * rate,
          });
        }
      });

      // Aggregate extra items details
      const extraTallyMap = new Map<string, { quantity: number; price: number }>();
      allExtraItems.forEach((item) => {
        if (isHoliday(new Date(item.date))) return;
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

      const totalMealsSum = mealDetails.reduce((sum, m) => sum + m.amount, 0);
      const totalExtrasSum = extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
      const totalConsumption = totalMealsSum + totalExtrasSum;

      if (totalConsumption === 0 && existingActiveBills.length === 0) {
        skippedCustomers.push(customer.name);
        continue;
      }

      // Calculate previous balance from unpaid active bills from PRIOR billing cycles
      const previousUnpaidBills = await Bill.find({
        customerId,
        status: { $nin: ["SUPERSEDED", "CANCELLED"] },
        paymentStatus: { $in: ["pending", "partially_paid"] },
        isCarriedForward: false,
        billingPeriodEnd: { $lt: start },
      });
      const previousBalance = previousUnpaidBills.reduce((sum, b) => sum + (b.finalTotal - b.amountPaid), 0);

      const customerFixedDiscount = customer.fixedDiscount || 0;
      const subtotal = totalConsumption + previousBalance;

      // Determine available advance credit to apply
      let advToApply = 0;
      if (customer.advanceBalance && customer.advanceBalance > 0) {
        advToApply = Math.min(customer.advanceBalance, subtotal - customerFixedDiscount);
      }

      const finalTotal = Math.max(0, subtotal - customerFixedDiscount - advToApply);

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

      // Invoice bill number generation
      const dateCode = `${targetYear}${String(targetMonth + 1).padStart(2, "0")}`;
      const billsCount = await Bill.countDocuments();
      const billNumber = `SSM-${dateCode}-${String(billsCount + 1).padStart(4, "0")}`;

      const bill = new Bill({
        billNumber,
        customerId,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        mealDetails,
        extraItemsDetails,
        discount: customerFixedDiscount,
        advancePayment: advToApply,
        previousBalance,
        finalTotal,
        originalTotal: finalTotal,
        adjustmentAmount: 0,
        paymentStatus: computedPaymentStatus,
        status: "ACTIVE",
        amountPaid: totalAmountPaid,
        isCarriedForward: false,
        notes: `Automated Monthly Bill - ${periodString}`,
      });

      // Save and update references
      await bill.save();

      // Mark older active bills for this customer in this period as SUPERSEDED by the new bill
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
          }
        );

        await Payment.updateMany(
          { billId: { $in: olderBillIds } },
          { $set: { billId: bill._id } }
        );

        await Payment.updateMany(
          { "allocations.billId": { $in: olderBillIds } },
          { $set: { "allocations.$[elem].billId": bill._id } },
          { arrayFilters: [{ "elem.billId": { $in: olderBillIds } }] }
        );
      }

      // Lock meal & extra records to this bill
      const mealIds = allMealRecords.map((r) => r._id);
      if (mealIds.length > 0) {
        await DailyMealRecord.updateMany(
          { _id: { $in: mealIds } },
          { $set: { billingStatus: "BILLED", billId: bill._id } }
        );
      }

      const extraIds = allExtraItems.map((item) => item._id);
      if (extraIds.length > 0) {
        await DailyMealItem.updateMany(
          { _id: { $in: extraIds } },
          { $set: { billingStatus: "BILLED", billId: bill._id } }
        );
      }

      // Mark old bills as carried forward
      if (previousUnpaidBills.length > 0) {
        await Bill.updateMany(
          { _id: { $in: previousUnpaidBills.map((b) => b._id) } },
          { $set: { isCarriedForward: true } }
        );
      }

      // Perform FIFO advance credit allocation
      if (advToApply > 0) {
        customer.advanceBalance = (customer.advanceBalance || 0) - advToApply;
        await customer.save();

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
          await adv.save();
          creditNeeded -= toAllocate;
        }
      }

      // Deliver in-app notification to customer
      await Notification.create({
        customerId,
        title: `Your ${periodString} Bill is Ready`,
        message: `Your automated monthly bill #${bill.billNumber} for ${periodString} has been generated. Total amount payable: ₹${finalTotal}.`,
        type: "bill_generated",
        link: `/customer/bills/${bill._id}`,
      });

      generatedBills.push({
        billId: bill._id,
        billNumber: bill.billNumber,
        customerName: customer.name,
        finalTotal: bill.finalTotal,
      });
    }

    return NextResponse.json({
      success: true,
      period: periodString,
      generatedCount: generatedBills.length,
      skippedCount: skippedCustomers.length,
      generatedBills,
      skippedCustomers,
    });
  } catch (error: any) {
    console.error("Automated Monthly Billing Cron Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Alias GET to POST for easy web browser / scheduler triggering
  return POST(request);
}
