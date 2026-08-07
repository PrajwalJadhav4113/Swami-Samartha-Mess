import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import MenuItem from "@/models/MenuItem";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

const DEFAULT_MENU_ITEMS = [
  { name: "Morning Full Tiffin", category: "Tiffin", price: 80, isActive: true },
  { name: "Morning Half Tiffin", category: "Tiffin", price: 50, isActive: true },
  { name: "Night Full Tiffin", category: "Tiffin", price: 80, isActive: true },
  { name: "Night Half Tiffin", category: "Tiffin", price: 50, isActive: true },
  { name: "Chapati", category: "Extra", price: 10, isActive: true },
  { name: "Rice", category: "Extra", price: 30, isActive: true },
  { name: "Bhaji", category: "Extra", price: 40, isActive: true },
  { name: "Varan-Bhat", category: "Extra", price: 50, isActive: true },
  { name: "Curd", category: "Extra", price: 15, isActive: true },
  { name: "Sweet", category: "Extra", price: 30, isActive: true },
];

export async function GET() {
  try {
    await connectToDatabase();

    let items = await MenuItem.find().sort({ category: 1, name: 1 });
    if (items.length === 0) {
      await MenuItem.insertMany(DEFAULT_MENU_ITEMS);
      items = await MenuItem.find().sort({ category: 1, name: 1 });
    }

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Get Menu API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { name, category, price, isActive } = await request.json();

    if (!name || !category || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await MenuItem.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existing) {
      return NextResponse.json({ error: "Menu item with this name already exists" }, { status: 400 });
    }

    const newItem = await MenuItem.create({
      name,
      category,
      price,
      isActive: isActive !== false,
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (error: any) {
    console.error("Create Menu Item API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
