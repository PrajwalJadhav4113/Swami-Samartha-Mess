import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Payment from "@/models/Payment";
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

/**
 * GET /api/owner/payments/[id]
 * Fetch a single payment record (owner only).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const payment = await Payment.findById(id)
      .populate("customerId", "name mobile advanceBalance")
      .populate("billId", "billNumber finalTotal")
      .populate("allocations.billId", "billNumber finalTotal");

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error("Get Payment Detail API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PUT /api/owner/payments/[id]
 * Edit an existing advance payment.
 *
 * Allowed fields: amount, paymentDate, paymentMode, transactionReference, notes, reason
 *
 * Safety rules enforced:
 * - Only ADVANCE payments can be edited through this endpoint
 * - newAmount must be >= total already allocated to bills (cannot reduce below applied amount)
 * - customer.advanceBalance is recalculated correctly using the delta
 * - payment.remainingAmount is updated by delta (allocated amounts are preserved)
 * - An editHistory audit record is always created
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isOwner())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const payment = await Payment.findById(id);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only ADVANCE payments can be edited through this endpoint
    if (payment.paymentType !== "ADVANCE") {
      return NextResponse.json(
        { error: "Only advance payments can be edited through this endpoint. Bill payments are edited via the bill edit endpoint." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, paymentDate, paymentMode, transactionReference, notes, reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "A reason for the edit is required" }, { status: 400 });
    }

    // --- Amount validation ---
    const newAmount = amount !== undefined ? parseFloat(amount) : payment.amount;
    if (isNaN(newAmount) || newAmount < 0) {
      return NextResponse.json({ error: "Amount must be zero or a positive number" }, { status: 400 });
    }

    // Calculate total already allocated to bills (cannot reduce below this)
    const totalAllocated = payment.allocations.reduce(
      (sum: number, alloc: any) => sum + alloc.amountApplied,
      0
    );

    if (newAmount < totalAllocated) {
      return NextResponse.json(
        {
          error: `This payment has already been partially applied to bills (₹${totalAllocated} applied). The amount cannot be reduced below ₹${totalAllocated}.`,
          totalAllocated,
        },
        { status: 400 }
      );
    }

    // --- Build audit record ---
    const auditRecord: any = {
      changedBy: "Owner",
      changedAt: new Date(),
      reason: reason.trim(),
      oldAmount: payment.amount,
      newAmount,
    };

    if (paymentDate && new Date(paymentDate).toISOString() !== payment.paymentDate.toISOString()) {
      auditRecord.oldPaymentDate = payment.paymentDate;
      auditRecord.newPaymentDate = new Date(paymentDate);
    }
    if (paymentMode && paymentMode !== payment.paymentMode) {
      auditRecord.oldPaymentMode = payment.paymentMode;
      auditRecord.newPaymentMode = paymentMode;
    }
    if (transactionReference !== undefined && transactionReference !== payment.transactionReference) {
      auditRecord.oldTransactionReference = payment.transactionReference;
      auditRecord.newTransactionReference = transactionReference;
    }
    if (notes !== undefined && notes !== payment.notes) {
      auditRecord.oldNotes = payment.notes;
      auditRecord.newNotes = notes;
    }

    // --- Compute delta and update customer balance ---
    const delta = newAmount - payment.amount;

    if (delta !== 0) {
      // Recalculate customer.advanceBalance by the delta
      const customer = await Customer.findById(payment.customerId);
      if (!customer) {
        return NextResponse.json({ error: "Associated customer not found" }, { status: 404 });
      }
      customer.advanceBalance = Math.max(0, (customer.advanceBalance || 0) + delta);
      await customer.save();
    }

    // --- Update payment fields ---
    payment.amount = newAmount;
    // remainingAmount shifts by the same delta (allocated amounts are preserved as-is)
    payment.remainingAmount = Math.max(0, (payment.remainingAmount || 0) + delta);

    if (paymentDate) payment.paymentDate = new Date(paymentDate);
    if (paymentMode) payment.paymentMode = paymentMode;
    if (transactionReference !== undefined) payment.transactionReference = transactionReference;
    if (notes !== undefined) payment.notes = notes;

    // Guard for pre-existing documents that don't have editHistory yet
    if (!payment.editHistory) payment.editHistory = [];
    payment.editHistory.push(auditRecord);


    await payment.save();

    // Re-populate for response
    const populated = await Payment.findById(payment._id)
      .populate("customerId", "name mobile advanceBalance")
      .populate("billId", "billNumber finalTotal")
      .populate("allocations.billId", "billNumber finalTotal");

    return NextResponse.json({ success: true, payment: populated });
  } catch (error: any) {
    console.error("Edit Payment API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
