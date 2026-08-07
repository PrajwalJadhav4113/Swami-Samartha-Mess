import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import MenuItem from "@/models/MenuItem";
import DailyMealRecord from "@/models/DailyMealRecord";
import DailyMealItem from "@/models/DailyMealItem";
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
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Fetch all active customers
    const customers = await Customer.find({ status: "active" }).sort({ name: 1 });

    // Fetch daily meal records for this date
    const mealRecords = await DailyMealRecord.find({ date: targetDate });
    const mealRecordsMap = new Map(
      mealRecords.map((r) => [r.customerId.toString(), r])
    );

    // Fetch extra meal items for this date
    const extraItems = await DailyMealItem.find({ date: targetDate });
    const extraItemsMap = new Map<string, any[]>();
    extraItems.forEach((item) => {
      const cId = item.customerId.toString();
      if (!extraItemsMap.has(cId)) {
        extraItemsMap.set(cId, []);
      }
      extraItemsMap.get(cId)!.push(item);
    });

    const responseData = customers.map((c) => {
      const cId = c._id.toString();
      const record = mealRecordsMap.get(cId);
      const extras = extraItemsMap.get(cId) || [];

      return {
        customerId: cId,
        customerName: c.name,
        morningMeal: record?.morningMeal || "none",
        nightMeal: record?.nightMeal || "none",
        notes: record?.notes || "",
        extras: extras.map((e) => ({
          menuItemId: e.menuItemId.toString(),
          name: e.name,
          price: e.price,
          quantity: e.quantity,
          notes: e.notes || "",
        })),
      };
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Get Meals API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { date: dateStr, records } = await request.json();

    if (!dateStr || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Fetch current prices of active menu items for snapshots
    const menuItems = await MenuItem.find({ isActive: true });
    const pricesMap = new Map(menuItems.map((m) => [m.name, m.price]));

    const morningFullPrice = pricesMap.get("Morning Full Tiffin") || 80;
    const morningHalfPrice = pricesMap.get("Morning Half Tiffin") || 50;
    const nightFullPrice = pricesMap.get("Night Full Tiffin") || 80;
    const nightHalfPrice = pricesMap.get("Night Half Tiffin") || 50;

    // Process each customer record
    for (const record of records) {
      const { customerId, morningMeal, nightMeal, notes, extras } = record;

      // 1. Determine price snapshot based on meal selection
      let morningPrice = 0;
      if (morningMeal === "full") morningPrice = morningFullPrice;
      else if (morningMeal === "half") morningPrice = morningHalfPrice;

      let nightPrice = 0;
      if (nightMeal === "full") nightPrice = nightFullPrice;
      else if (nightMeal === "half") nightPrice = nightHalfPrice;

      // 2. Upsert DailyMealRecord
      await DailyMealRecord.findOneAndUpdate(
        { customerId, date: targetDate },
        {
          morningMeal,
          morningPrice,
          nightMeal,
          nightPrice,
          notes,
        },
        { upsert: true, new: true }
      );

      // 3. Clear existing extra items for this customer on this day
      await DailyMealItem.deleteMany({ customerId, date: targetDate });

      // 4. Save new extra items
      if (extras && Array.isArray(extras) && extras.length > 0) {
        const itemsToSave = extras
          .filter((ext: any) => ext.menuItemId && ext.quantity > 0)
          .map((ext: any) => ({
            customerId,
            date: targetDate,
            menuItemId: ext.menuItemId,
            name: ext.name,
            price: ext.price,
            quantity: ext.quantity,
            notes: ext.notes || "",
          }));

        if (itemsToSave.length > 0) {
          await DailyMealItem.insertMany(itemsToSave);
        }
      }
    }

    return NextResponse.json({ success: true, message: "Meals saved successfully" });
  } catch (error: any) {
    console.error("Save Meals API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
