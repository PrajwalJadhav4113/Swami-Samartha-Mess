import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Holiday from "@/models/Holiday";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import Setting from "@/models/Setting";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { startDate, endDate, notes } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "Invalid closure dates" }, { status: 400 });
    }

    // Save as a global holiday (null customerId)
    const holiday = await Holiday.create({
      customerId: null,
      startDate: start,
      endDate: end,
      reason: notes || "Mess Closure",
    });

    // Generate WhatsApp Draft message
    const settings = await Setting.findOne();
    const messName = settings?.messName || "The Mess";
    
    // Format dates cleanly (e.g., "20 Aug 2026")
    const startStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const endStr = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
    const draftMessage = `*Important Announcement from ${messName}*\n\nThe mess will remain closed from *${startStr}* to *${endStr}*.\n\nThank you.`;
    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(draftMessage)}`;

    return NextResponse.json({ 
      success: true, 
      holiday,
      whatsappLink,
      draftMessage
    }, { status: 201 });
  } catch (error: any) {
    console.error("Mess Closure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
