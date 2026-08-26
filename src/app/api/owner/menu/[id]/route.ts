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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();
    const data = await request.json();

    const item = await MenuItem.findById(id);
    if (!item) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    item.name = data.name ?? item.name;
    item.category = data.category ?? item.category;
    item.price = data.price !== undefined ? data.price : item.price;
    item.specialPrice = data.specialPrice !== undefined ? data.specialPrice : item.specialPrice;
    item.isActive = data.isActive !== undefined ? data.isActive : item.isActive;

    await item.save();
    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Update Menu Item API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const result = await MenuItem.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Menu item deleted successfully" });
  } catch (error: any) {
    console.error("Delete Menu Item API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
