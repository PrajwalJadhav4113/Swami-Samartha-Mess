import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Customer from "@/models/Customer";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

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
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const totalCustomers = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .select("-passwordHash")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCustomers / limit);

    return NextResponse.json({
      customers,
      totalPages,
      currentPage: page,
      totalCustomers,
    });
  } catch (error: any) {
    console.error("Get Customers API Error:", error);
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
    const { name, photo, mobile, address, username, password, notes, joiningDate } = data;

    if (!name || !mobile || !address || !username || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await Customer.findOne({ username: { $regex: new RegExp(`^${username}$`, "i") } });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const customer = await Customer.create({
      name,
      photo,
      mobile,
      address,
      username,
      passwordHash,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: "active",
      notes,
    });

    const customerObject = customer.toObject();
    delete (customerObject as any).passwordHash;

    return NextResponse.json(customerObject, { status: 201 });
  } catch (error: any) {
    console.error("Create Customer API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
