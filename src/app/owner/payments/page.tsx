"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  CircleDollarSign,
  PlusCircle,
  Search,
  Filter,
  Loader2,
  Link as LinkIcon,
  Edit2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
} from "lucide-react";

interface CustomerSummary {
  _id: string;
  name: string;
}

interface BillSummary {
  _id: string;
  billNumber: string;
  finalTotal: number;
  amountPaid: number;
}

interface PaymentEditHistoryEntry {
  changedBy: string;
  changedAt: string;
  reason: string;
  oldAmount: number;
  newAmount: number;
  oldPaymentDate?: string;
  newPaymentDate?: string;
  oldPaymentMode?: string;
  newPaymentMode?: string;
  oldTransactionReference?: string;
  newTransactionReference?: string;
  oldNotes?: string;
  newNotes?: string;
}

interface PaymentItem {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    mobile: string;
  };
  billId?: {
    _id: string;
    billNumber: string;
    finalTotal: number;
  };
  amount: number;
  paymentType?: "BILL_PAYMENT" | "ADVANCE";
  paymentDate: string;
  paymentMode: "cash" | "upi" | "bank_transfer" | "other";
  transactionReference?: string;
  notes?: string;
  remainingAmount?: number;
  allocations?: {
    billId: {
      _id: string;
      billNumber: string;
      finalTotal: number;
    };
    amountApplied: number;
    appliedAt: string;
  }[];
  editHistory?: PaymentEditHistoryEntry[];
  createdAt: string;
}

function PaymentsLedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [unpaidBills, setUnpaidBills] = useState<BillSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Payment form states
  const [paymentType, setPaymentType] = useState<"BILL_PAYMENT" | "ADVANCE">("BILL_PAYMENT");
  const [customerId, setCustomerId] = useState("");
  const [billId, setBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank_transfer" | "other">("upi");
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [customerIdFilter, setCustomerIdFilter] = useState("");

  // Expanded history rows
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

  // Edit Payment modal state
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState<"cash" | "upi" | "bank_transfer" | "other">("upi");
  const [editTransactionReference, setEditTransactionReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/payments");
      if (!res.ok) throw new Error("Failed to fetch payments");
      const data = await res.json();
      setPayments(data);
    } catch (err: any) {
      error(err.message || "Failed to load payment logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/owner/customers?limit=100");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const fetchUnpaidBills = async (cId: string) => {
    if (!cId) {
      setUnpaidBills([]);
      return;
    }
    try {
      const res = await fetch(`/api/owner/billing?customerId=${cId}&status=pending`);
      if (res.ok) {
        const data1 = await res.json();
        const res2 = await fetch(`/api/owner/billing?customerId=${cId}&status=partially_paid`);
        const data2 = res2.ok ? await res2.json() : [];
        setUnpaidBills([...data1, ...data2]);
      }
    } catch (err) {
      console.error("Error loading unpaid bills:", err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
  }, []);

  useEffect(() => {
    const custParam = searchParams.get("customerId");
    if (custParam) {
      setCustomerId(custParam);
      setShowAddForm(true);
      fetchUnpaidBills(custParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchUnpaidBills(customerId);
    setBillId("");
  }, [customerId]);

  const handleBillChange = (selectedBillId: string) => {
    setBillId(selectedBillId);
    if (selectedBillId) {
      const bill = unpaidBills.find((b) => b._id === selectedBillId);
      if (bill) {
        const remaining = bill.finalTotal - (bill.amountPaid || 0);
        setAmount(remaining.toString());
      }
    } else {
      setAmount("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !amount || !paymentMode) {
      error("Customer, Mode, and Amount are required fields");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      error("Amount must be a positive number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          billId: paymentType === "ADVANCE" ? null : (billId || null),
          amount: numAmount,
          paymentDate,
          paymentMode,
          transactionReference,
          notes,
          paymentType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log payment");

      success(`Payment of ₹${numAmount} logged successfully!`, "Payment Recorded");
      setPaymentType("BILL_PAYMENT");
      setCustomerId("");
      setBillId("");
      setAmount("");
      setTransactionReference("");
      setNotes("");
      setShowAddForm(false);
      fetchPayments();
      if (searchParams.get("customerId")) router.replace("/owner/payments");
    } catch (err: any) {
      error(err.message || "Error logging payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Open the edit modal pre-filled with existing values
  const openEditModal = (p: PaymentItem) => {
    setEditingPayment(p);
    setEditAmount(p.amount.toString());
    setEditPaymentDate(new Date(p.paymentDate).toISOString().split("T")[0]);
    setEditPaymentMode(p.paymentMode);
    setEditTransactionReference(p.transactionReference || "");
    setEditNotes(p.notes || "");
    setEditReason("");
    setShowConfirm(false);
  };

  const closeEditModal = () => {
    setEditingPayment(null);
    setShowConfirm(false);
  };

  const handleEditConfirm = async () => {
    if (!editingPayment) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/owner/payments/${editingPayment._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          paymentDate: editPaymentDate,
          paymentMode: editPaymentMode,
          transactionReference: editTransactionReference,
          notes: editNotes,
          reason: editReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment");

      success("Advance payment updated successfully!", "Payment Updated");
      setShowConfirm(false);
      setEditingPayment(null);
      fetchPayments();
    } catch (err: any) {
      error(err.message || "Error updating payment");
      setShowConfirm(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleHistory = (id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter
  const filteredPayments = payments.filter((p) => {
    const custName = p.customerId?.name || "";
    const matchesSearch =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(search.toLowerCase()));
    const matchesCustomer = customerIdFilter === "" || p.customerId?._id === customerIdFilter;
    return matchesSearch && matchesCustomer;
  });

  // Compute total allocated for the editing payment
  const editTotalAllocated = editingPayment
    ? (editingPayment.allocations || []).reduce((s, a) => s + a.amountApplied, 0)
    : 0;
  const editAmountNum = parseFloat(editAmount) || 0;
  const editAmountInvalid = editAmountNum < editTotalAllocated;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Log manual transactions and keep a ledger of customer payments.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2.5 rounded-xl hover-lift shadow-md transition self-start cursor-pointer"
        >
          <PlusCircle className="h-4.5 w-4.5" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Record Payment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-base">Record Customer Payment</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  if (searchParams.get("customerId")) router.replace("/owner/payments");
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded-lg hover:bg-muted"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => {
                    const type = e.target.value as "BILL_PAYMENT" | "ADVANCE";
                    setPaymentType(type);
                    if (type === "ADVANCE") setBillId("");
                  }}
                  className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
                >
                  <option value="BILL_PAYMENT">Bill Payment (Link to Invoice)</option>
                  <option value="ADVANCE">Advance Payment / Customer Credit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Select Customer
                </label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {customerId && paymentType === "BILL_PAYMENT" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Link to Pending Bill (Optional)
                  </label>
                  <select
                    value={billId}
                    onChange={(e) => handleBillChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
                  >
                    <option value="">General Account Credit (Unlinked)</option>
                    {unpaidBills.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.billNumber} (Due: ₹{b.finalTotal - b.amountPaid})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Payment Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
                  >
                    <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Transaction Reference (UPI/UTR)
                  </label>
                  <input
                    type="text"
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    placeholder="e.g. TXN982746182"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Internal Remarks
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Handed over cash directly"
                  className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                />
              </div>

              <div className="border-t border-border pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    if (searchParams.get("customerId")) router.replace("/owner/payments");
                  }}
                  className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Advance Payment Modal ── */}
      {editingPayment && !showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Edit Advance Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingPayment.customerId?.name} — Original: ₹{editingPayment.amount}
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="text-muted-foreground hover:text-foreground text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Allocation warning */}
              {editTotalAllocated > 0 && (
                <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-800 dark:text-amber-300 font-semibold">
                    This payment has already been partially applied to bills (₹{editTotalAllocated} applied).
                    The amount cannot be reduced below <strong>₹{editTotalAllocated}</strong>.
                  </span>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  New Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={editTotalAllocated}
                  step="1"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className={`w-full px-3 py-2.5 bg-muted border rounded-xl focus:outline-none transition text-sm font-bold ${
                    editAmountInvalid
                      ? "border-rose-400 focus:border-rose-400"
                      : "border-transparent focus:border-primary/20 focus:bg-card"
                  }`}
                />
                {editAmountInvalid && (
                  <p className="text-rose-600 text-[10px] font-semibold mt-1">
                    Minimum allowed: ₹{editTotalAllocated} (already applied to bills)
                  </p>
                )}
              </div>

              {/* Date and Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={editPaymentMode}
                    onChange={(e) => setEditPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-xl focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
                  >
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Reference and Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={editTransactionReference}
                    onChange={(e) => setEditTransactionReference(e.target.value)}
                    placeholder="e.g. UPI123"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. Correction"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Reason (required) */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Reason for Edit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Customer paid additional amount, correction"
                  className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editAmountInvalid || !editReason.trim() || !editAmount}
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 disabled:opacity-40 text-white font-semibold text-sm rounded-xl hover-lift shadow transition cursor-pointer"
                >
                  Review & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Dialog ── */}
      {editingPayment && showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-7 space-y-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-extrabold text-foreground">Update Advance Payment?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Please review the changes before confirming.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground font-semibold">Customer</span>
                <span className="font-bold">{editingPayment.customerId?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground font-semibold">Old Amount</span>
                <span className="font-bold line-through text-rose-500">₹{editingPayment.amount}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground font-semibold">New Amount</span>
                <span className="font-bold text-emerald-600">₹{parseFloat(editAmount)}</span>
              </div>
              {parseFloat(editAmount) !== editingPayment.amount && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground font-semibold">Balance Change</span>
                  <span className={`font-bold ${parseFloat(editAmount) > editingPayment.amount ? "text-emerald-600" : "text-rose-600"}`}>
                    {parseFloat(editAmount) > editingPayment.amount ? "+" : ""}
                    ₹{parseFloat(editAmount) - editingPayment.amount}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground font-semibold">Reason</span>
                <span className="font-semibold text-right max-w-40 text-wrap">{editReason}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2">
              This will update the customer's available advance credit accordingly.
              The original payment record is preserved in the edit history.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={savingEdit}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Update Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer or reference code..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:border-primary/20 focus:outline-none transition text-sm font-medium"
          />
        </div>

        <div className="relative flex items-center w-full sm:w-48 flex-shrink-0">
          <span className="absolute left-3 text-muted-foreground pointer-events-none">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <select
            value={customerIdFilter}
            onChange={(e) => setCustomerIdFilter(e.target.value)}
            className="w-full pl-8.5 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold focus:outline-none focus:border-primary/20 appearance-none cursor-pointer"
          >
            <option value="">Filter by Customer</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Retrieving payment logs...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <CircleDollarSign className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Payments Recorded</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Log your first payment entry using the button above.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-bold uppercase">
                  <th className="px-6 py-4">Transaction Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Applied / Reference</th>
                  <th className="px-6 py-4">Remarks</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {filteredPayments.map((p) => (
                  <React.Fragment key={p._id}>
                    <tr className="hover:bg-muted/10 transition">
                      <td className="px-6 py-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold">{p.customerId?.name || "Unknown"}</td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-600 font-extrabold">₹{p.amount}</span>
                        {p.paymentType === "ADVANCE" && p.editHistory && p.editHistory.length > 0 && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                            EDITED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 uppercase text-xs">
                        <span className="bg-muted px-2.5 py-1 rounded-md border border-border">
                          {p.paymentMode.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        {p.paymentType === "ADVANCE" ? (
                          <div className="space-y-1">
                            <span className="text-indigo-600 font-bold block">💰 Advance Credit</span>
                            {p.allocations && p.allocations.length > 0 ? (
                              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                {p.allocations.map((alloc: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <span>Applied:</span>
                                    {alloc.billId ? (
                                      <Link
                                        href={`/owner/billing/${alloc.billId._id}`}
                                        className="text-primary hover:underline font-semibold"
                                      >
                                        {alloc.billId.billNumber}
                                      </Link>
                                    ) : (
                                      <span>Bill</span>
                                    )}
                                    <span>(₹{alloc.amountApplied})</span>
                                  </div>
                                ))}
                                {p.remainingAmount !== undefined && p.remainingAmount > 0 && (
                                  <span className="text-emerald-600 font-semibold block">₹{p.remainingAmount} remaining</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-emerald-600 text-[10px] font-semibold italic">
                                Unused (₹{p.remainingAmount} available)
                              </span>
                            )}
                          </div>
                        ) : p.billId ? (
                          <Link
                            href={`/owner/billing/${p.billId._id}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <LinkIcon className="h-3 w-3" />
                            <span>{p.billId.billNumber}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic">General Balance</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {p.transactionReference ? (
                          <span className="block font-mono select-all">Ref: {p.transactionReference}</span>
                        ) : null}
                        {p.notes ? <span className="block mt-0.5">{p.notes}</span> : null}
                        {!p.transactionReference && !p.notes ? <span>-</span> : null}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {/* Edit button — only for ADVANCE payments */}
                          {p.paymentType === "ADVANCE" && (
                            <button
                              onClick={() => openEditModal(p)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200/50 transition cursor-pointer"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                              Edit
                            </button>
                          )}
                          {/* View history button — only if edits exist */}
                          {p.paymentType === "ADVANCE" && p.editHistory && p.editHistory.length > 0 && (
                            <button
                              onClick={() => toggleHistory(p._id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground border border-border transition cursor-pointer"
                            >
                              <History className="h-2.5 w-2.5" />
                              History
                              {expandedHistoryIds.has(p._id) ? (
                                <ChevronUp className="h-2.5 w-2.5" />
                              ) : (
                                <ChevronDown className="h-2.5 w-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable edit history row */}
                    {expandedHistoryIds.has(p._id) && p.editHistory && p.editHistory.length > 0 && (
                      <tr className="bg-muted/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <History className="h-3 w-3" />
                              Payment Edit History ({p.editHistory.length} edit{p.editHistory.length > 1 ? "s" : ""})
                            </p>
                            <div className="space-y-2">
                              {p.editHistory.map((entry, idx) => (
                                <div
                                  key={idx}
                                  className="bg-card border border-border rounded-xl p-4 text-xs space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <span className="font-bold text-foreground">
                                      Edit #{p.editHistory!.length - idx}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {new Date(entry.changedAt).toLocaleString()} by {entry.changedBy}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground italic">"{entry.reason}"</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {entry.oldAmount !== entry.newAmount && (
                                      <div className="bg-muted/50 rounded-lg p-2">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Amount</span>
                                        <span className="line-through text-rose-500">₹{entry.oldAmount}</span>
                                        <span className="mx-1 text-muted-foreground">→</span>
                                        <span className="text-emerald-600 font-bold">₹{entry.newAmount}</span>
                                      </div>
                                    )}
                                    {entry.oldPaymentMode && entry.oldPaymentMode !== entry.newPaymentMode && (
                                      <div className="bg-muted/50 rounded-lg p-2">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Mode</span>
                                        <span className="line-through text-rose-500">{entry.oldPaymentMode}</span>
                                        <span className="mx-1">→</span>
                                        <span className="font-bold">{entry.newPaymentMode}</span>
                                      </div>
                                    )}
                                    {entry.oldTransactionReference !== entry.newTransactionReference && (
                                      <div className="bg-muted/50 rounded-lg p-2">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Reference</span>
                                        <span className="line-through text-rose-500">{entry.oldTransactionReference || "-"}</span>
                                        <span className="mx-1">→</span>
                                        <span className="font-bold">{entry.newTransactionReference || "-"}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="block md:hidden divide-y divide-border">
            {filteredPayments.map((p) => (
              <div key={p._id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-sm block">{p.customerId?.name || "Unknown"}</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-600 font-extrabold text-sm block">₹{p.amount}</span>
                    {p.paymentType === "ADVANCE" && p.editHistory && p.editHistory.length > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        EDITED
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="bg-muted px-2 py-0.5 rounded border border-border uppercase text-[10px] font-semibold">
                    {p.paymentMode.replace("_", " ")}
                  </span>

                  {p.paymentType === "ADVANCE" ? (
                    <div className="text-right">
                      <span className="text-indigo-600 font-bold block text-[11px]">💰 Advance Credit</span>
                      {p.remainingAmount !== undefined && p.remainingAmount > 0 && (
                        <span className="text-emerald-600 text-[10px] font-semibold">
                          ₹{p.remainingAmount} available
                        </span>
                      )}
                    </div>
                  ) : p.billId ? (
                    <Link
                      href={`/owner/billing/${p.billId._id}`}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <LinkIcon className="h-3 w-3" />
                      <span>{p.billId.billNumber}</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground italic text-[10px]">General Balance</span>
                  )}
                </div>

                {/* Mobile edit + history buttons */}
                {p.paymentType === "ADVANCE" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200/50 transition cursor-pointer"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                      Edit Payment
                    </button>
                    {p.editHistory && p.editHistory.length > 0 && (
                      <button
                        onClick={() => toggleHistory(p._id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border transition cursor-pointer"
                      >
                        <History className="h-2.5 w-2.5" />
                        History ({p.editHistory.length})
                      </button>
                    )}
                  </div>
                )}

                {(p.transactionReference || p.notes) && (
                  <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                    {p.transactionReference && (
                      <span className="block font-mono select-all">Ref: {p.transactionReference}</span>
                    )}
                    {p.notes && <span className="block mt-0.5">{p.notes}</span>}
                  </div>
                )}

                {/* Mobile expanded history */}
                {expandedHistoryIds.has(p._id) && p.editHistory && p.editHistory.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Edit History</p>
                    {p.editHistory.map((entry, idx) => (
                      <div key={idx} className="bg-muted/40 border border-border rounded-lg p-3 text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold">Edit #{p.editHistory!.length - idx}</span>
                          <span className="text-muted-foreground">{new Date(entry.changedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="italic text-muted-foreground">"{entry.reason}"</p>
                        {entry.oldAmount !== entry.newAmount && (
                          <p>
                            Amount: <span className="line-through text-rose-500">₹{entry.oldAmount}</span>
                            {" → "}
                            <span className="text-emerald-600 font-bold">₹{entry.newAmount}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsLedger() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading payments ledger...</p>
        </div>
      }
    >
      <PaymentsLedgerContent />
    </Suspense>
  );
}
