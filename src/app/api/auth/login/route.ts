import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import Customer from "@/models/Customer";
import { signToken } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { username, password, role } = await request.json();

    if (!username || !password || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (role !== "owner" && role !== "customer") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    let userDetails = null;

    if (role === "owner") {
      // Check if any owner exists. If not, auto-seed the default owner swami/SwamiS123
      const count = await User.countDocuments({ role: "owner" });
      if (count === 0) {
        const passwordHash = await bcrypt.hash("SwamiS123", 10);
        await User.create({
          name: "Owner Admin",
          username: "swami",
          passwordHash,
          role: "owner",
        });
      }

      // Find user
      const user = await User.findOne({ username });
      if (!user) {
        return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
      }

      userDetails = {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        role: "owner" as const,
      };
    } else {
      // Find customer
      const customer = await Customer.findOne({ username });
      if (!customer) {
        return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
      }
      if (customer.status !== "active") {
        return NextResponse.json({ error: "Your account is not active. Status: " + customer.status }, { status: 401 });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, customer.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
      }

      userDetails = {
        id: customer._id.toString(),
        name: customer.name,
        username: customer.username,
        role: "customer" as const,
      };
    }

    // Generate JWT token
    const token = await signToken(userDetails);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 3, // 3 days
    });

    return NextResponse.json({ success: true, user: userDetails });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
