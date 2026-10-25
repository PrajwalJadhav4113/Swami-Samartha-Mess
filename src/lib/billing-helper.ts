import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
import Holiday from "@/models/Holiday";

export interface IDailyRecord {
  date: string;
  dayOfWeek: string;
  morningMeal: "none" | "half" | "full";
  morningPrice: number;
  nightMeal: "none" | "half" | "full";
  nightPrice: number;
  isHoliday: boolean;
  holidayReason?: string;
  extras: {
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }[];
  totalPrice: number;
}

export async function getBillDetailedLogs(
  customerId: string,
  startDate: Date,
  endDate: Date,
  billId?: string
): Promise<IDailyRecord[]> {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  // 1. Fetch holidays in the range
  const holidays = await Holiday.find({
    $or: [{ customerId: null }, { customerId }],
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  const checkHoliday = (date: Date) => {
    const dTime = date.getTime();
    const found = holidays.find((h) => {
      const hStart = new Date(h.startDate);
      hStart.setUTCHours(0, 0, 0, 0);
      const hEnd = new Date(h.endDate);
      hEnd.setUTCHours(23, 59, 59, 999);
      return dTime >= hStart.getTime() && dTime <= hEnd.getTime();
    });
    return found ? found.reason : null;
  };

  // 2. Fetch daily meal records and extra items
  const mealQuery: any = {
    customerId,
    date: { $gte: start, $lte: end },
  };
  if (billId) {
    mealQuery.billId = billId;
  }
  const mealRecords = await DailyMealRecord.find(mealQuery);

  const extraQuery: any = {
    customerId,
    date: { $gte: start, $lte: end },
  };
  if (billId) {
    extraQuery.billId = billId;
  }
  const extraItems = await DailyMealItem.find(extraQuery);

  // Map meal records by date timestamp
  const recordsMap = new Map(
    mealRecords.map((r) => {
      const d = new Date(r.date);
      d.setUTCHours(0, 0, 0, 0);
      return [d.getTime(), r];
    })
  );

  // Group extra items by date timestamp
  const extrasMap = new Map<number, typeof extraItems>();
  extraItems.forEach((item) => {
    const d = new Date(item.date);
    d.setUTCHours(0, 0, 0, 0);
    const time = d.getTime();
    if (!extrasMap.has(time)) {
      extrasMap.set(time, []);
    }
    extrasMap.get(time)!.push(item);
  });

  // 3. Generate list of dates
  const dailyRecords: IDailyRecord[] = [];
  const curr = new Date(start.getTime());
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  while (curr <= end) {
    const time = curr.getTime();
    const dateStr = curr.toISOString().split("T")[0];
    const dayName = daysOfWeek[curr.getUTCDay()];

    const holidayReason = checkHoliday(curr);
    const isHoliday = holidayReason !== null;

    const rec = recordsMap.get(time);
    const dayExtras = extrasMap.get(time) || [];

    const morningMeal = rec ? rec.morningMeal : "none";
    const morningPrice = rec ? rec.morningPrice : 0;
    const nightMeal = rec ? rec.nightMeal : "none";
    const nightPrice = rec ? rec.nightPrice : 0;

    const extrasList = dayExtras.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      amount: item.quantity * item.price,
    }));

    // Calculate daily total cost
    let dailyTotal = 0;
    if (!isHoliday) {
      if (morningMeal !== "none") dailyTotal += morningPrice;
      if (nightMeal !== "none") dailyTotal += nightPrice;
    }
    extrasList.forEach((e) => {
      dailyTotal += e.amount;
    });

    dailyRecords.push({
      date: dateStr,
      dayOfWeek: dayName,
      morningMeal,
      morningPrice,
      nightMeal,
      nightPrice,
      isHoliday,
      holidayReason: holidayReason || undefined,
      extras: extrasList,
      totalPrice: dailyTotal,
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dailyRecords;
}

/**
 * Synchronizes a customer's available advance credit (customer.advanceBalance)
 * with the sum of remaining unallocated amounts on all their active ADVANCE payments.
 * Ensures an authoritative, single source of truth for available credit.
 */
export async function syncCustomerAdvanceBalance(customerId: string, session?: any): Promise<number> {
  const Customer = (await import("@/models/Customer")).default;
  const Payment = (await import("@/models/Payment")).default;

  const activeAdvances = await Payment.find(
    { customerId, paymentType: "ADVANCE" },
    null,
    session ? { session } : undefined
  );

  const totalAvailable = activeAdvances.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
  const sanitizedAvailable = Math.max(0, totalAvailable);

  await Customer.findByIdAndUpdate(
    customerId,
    { $set: { advanceBalance: sanitizedAvailable } },
    session ? { session } : undefined
  );

  return sanitizedAvailable;
}

/**
 * Releases any advance credit allocations associated with a specific bill,
 * restoring the remainingAmount on the advance payment records.
 */
export async function releaseBillAdvanceAllocations(
  billId: string | any,
  session?: any
): Promise<number> {
  const Payment = (await import("@/models/Payment")).default;

  const appliedAdvances = await Payment.find(
    { "allocations.billId": billId },
    null,
    session ? { session } : undefined
  );

  let totalCreditRestored = 0;
  for (const adv of appliedAdvances) {
    const alloc = adv.allocations.find((a: any) => a.billId.toString() === billId.toString());
    if (alloc) {
      totalCreditRestored += alloc.amountApplied;
      adv.remainingAmount = (adv.remainingAmount || 0) + alloc.amountApplied;
      adv.allocations = adv.allocations.filter((a: any) => a.billId.toString() !== billId.toString());
      await adv.save(session ? { session } : undefined);
    }
  }

  return totalCreditRestored;
}


