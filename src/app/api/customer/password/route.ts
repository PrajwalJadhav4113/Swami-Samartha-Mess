import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload && payload.role === "customer" ? payload : null;
}

export async function POST(request: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Missing password fields" }, { status: 400 });
    }

    const customer = await Customer.findById(session.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Validate old password
    const isMatch = await bcrypt.compare(oldPassword, customer.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
    }

    // Hash and save new password
    customer.passwordHash = await bcrypt.hash(newPassword, 10);
    await customer.save();

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Change Password API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
