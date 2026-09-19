import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Payment from "@/models/Payment";
import Bill from "@/models/Bill";
import Customer from "@/models/Customer";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

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
    const customerId = searchParams.get("customerId");

    const query: any = {};
    if (customerId) {
      query.customerId = customerId;
    }

    const payments = await Payment.find(query)
      .populate("customerId", "name mobile")
      .populate("billId", "billNumber finalTotal")
      .populate("allocations.billId", "billNumber finalTotal")
      .sort({ paymentDate: -1 });

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error("Get Payments API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await connectToDatabase();
    const { customerId, billId, amount, paymentDate, paymentMode, transactionReference, notes, paymentType } = await request.json();

    if (!customerId || amount === undefined || !paymentMode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    // 1. Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const payType = paymentType === "ADVANCE" ? "ADVANCE" : "BILL_PAYMENT";

    // 2. Create the payment record
    const payment = await Payment.create({
      customerId,
      billId: payType === "ADVANCE" ? null : (billId || null),
      amount: numericAmount,
      paymentType: payType,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      transactionReference,
      notes,
      remainingAmount: payType === "ADVANCE" ? numericAmount : 0,
    });

    // 3. Update the associated bill, if any
    if (payType === "BILL_PAYMENT" && billId) {
      const bill = await Bill.findById(billId);
      if (bill) {
        // Calculate total payments against this bill
        const allPayments = await Payment.find({ billId });
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        bill.amountPaid = totalPaid;
        if (totalPaid >= bill.finalTotal) {
          bill.paymentStatus = "paid";
        } else if (totalPaid > 0) {
          bill.paymentStatus = "partially_paid";
        } else {
          bill.paymentStatus = "pending";
        }

        await bill.save();
      }
    } else if (payType === "ADVANCE") {
      // General payment (Advance Payment)
      customer.advanceBalance = (customer.advanceBalance || 0) + numericAmount;
      await customer.save();
    }

    const populated = await Payment.findById(payment._id)
      .populate("customerId", "name mobile")
      .populate("billId", "billNumber finalTotal")
      .populate("allocations.billId", "billNumber finalTotal");

    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Create Payment API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
