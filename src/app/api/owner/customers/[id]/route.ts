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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const customer = await Customer.findById(id).select("-passwordHash");
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error("Get Customer Detail API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();
    const data = await request.json();

    const customer = await Customer.findById(id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    customer.name = data.name ?? customer.name;
    customer.mobile = data.mobile ?? customer.mobile;
    customer.address = data.address ?? customer.address;
    customer.notes = data.notes ?? customer.notes;
    customer.status = data.status ?? customer.status;
    customer.photo = data.photo !== undefined ? data.photo : customer.photo;
    customer.joiningDate = data.joiningDate ? new Date(data.joiningDate) : customer.joiningDate;
    customer.dietPreference = data.dietPreference ?? customer.dietPreference;
    customer.pricingType = data.pricingType ?? customer.pricingType;
    if (data.specialPrices !== undefined) {
      customer.specialPrices = data.specialPrices;
    }

    if (data.username) {
      // Check if username unique
      const existing = await Customer.findOne({
        username: { $regex: new RegExp(`^${data.username}$`, "i") },
        _id: { $ne: customer._id },
      });
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 });
      }
      customer.username = data.username;
    }

    if (data.password) {
      customer.passwordHash = await bcrypt.hash(data.password, 10);
    }

    await customer.save();

    const customerObject = customer.toObject();
    delete (customerObject as any).passwordHash;

    return NextResponse.json(customerObject);
  } catch (error: any) {
    console.error("Update Customer API Error:", error);
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

    const result = await Customer.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Note: We could clean up associated bills, payments, meals, etc.
    // but in a production business context, deleting a customer shouldn't crash historical ledger reports.
    // Keeping historical entries is fine.

    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    console.error("Delete Customer API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
