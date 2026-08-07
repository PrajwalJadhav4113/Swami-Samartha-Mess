import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Setting from "@/models/Setting";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

async function isOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload && payload.role === "owner";
}

export async function GET() {
  try {
    await connectToDatabase();

    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        messName: "Swami Samartha Mess",
        address: "123, Main Street, Pune, Maharashtra",
        contactNumber: "+91 9876543210",
        theme: "light",
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Get Settings API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const data = await request.json();

    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting(data);
    } else {
      settings.messName = data.messName ?? settings.messName;
      settings.address = data.address ?? settings.address;
      settings.contactNumber = data.contactNumber ?? settings.contactNumber;
      settings.logo = data.logo ?? settings.logo;
      settings.upiId = data.upiId ?? settings.upiId;
      settings.upiQrCode = data.upiQrCode ?? settings.upiQrCode;
      settings.theme = data.theme ?? settings.theme;
    }

    await settings.save();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Save Settings API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
