import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Customer from "@/models/Customer";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await connectToDatabase();

    // Fetch fresh user data from DB to verify they still exist and are active
    if (payload.role === "owner") {
      const user = await User.findById(payload.id).select("-passwordHash");
      if (!user) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      return NextResponse.json({ authenticated: true, user });
    } else {
      const customer = await Customer.findById(payload.id).select("-passwordHash");
      if (!customer || customer.status !== "active") {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
      return NextResponse.json({ authenticated: true, user: customer });
    }
  } catch (error: any) {
    console.error("Auth Me API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
