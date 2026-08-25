import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { name, mobile, address, email, password, dietPreference } = await request.json();

    if (!name || !mobile || !address || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if customer already exists by mobile (which we'll use as username for registration)
    const existing = await Customer.findOne({ username: mobile });
    if (existing) {
      return NextResponse.json({ error: "Mobile number already registered" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await Customer.create({
      name,
      mobile,
      address,
      username: mobile, // username defaults to mobile number for now
      passwordHash,
      notes: email ? `Email: ${email}` : "",
      dietPreference: dietPreference || "both",
      status: "pending",
    });

    return NextResponse.json({ success: true, message: "Registration successful. Pending admin approval." }, { status: 201 });
  } catch (error: any) {
    console.error("Register API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
