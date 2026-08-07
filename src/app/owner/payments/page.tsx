"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { CircleDollarSign, PlusCircle, Search, Filter, Calendar, Loader2, Link as LinkIcon, DollarSign } from "lucide-react";

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
  paymentDate: string;
  paymentMode: "cash" | "upi" | "bank_transfer";
  transactionReference?: string;
  notes?: string;
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

  // Form states
  const [customerId, setCustomerId] = useState("");
  const [billId, setBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank_transfer">("upi");
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [customerIdFilter, setCustomerIdFilter] = useState("");

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

  // Load unpaid bills for the selected customer dynamically
  const fetchUnpaidBills = async (cId: string) => {
    if (!cId) {
      setUnpaidBills([]);
      return;
    }
    try {
      const res = await fetch(`/api/owner/billing?customerId=${cId}&status=pending`);
      if (res.ok) {
        const data1 = await res.json();
        // Also fetch partially paid bills
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

  // Pre-fill parameters if passed from customer profile tab
  useEffect(() => {
    const custParam = searchParams.get("customerId");
    if (custParam) {
      setCustomerId(custParam);
      setShowAddForm(true);
      fetchUnpaidBills(custParam);
    }
  }, [searchParams]);

  // Fetch unpaid bills when customer selection changes inside form
  useEffect(() => {
    fetchUnpaidBills(customerId);
    setBillId(""); // Reset bill selection
  }, [customerId]);

  // Pre-fill payment amount if a bill is selected
  const handleBillChange = (selectedBillId: string) => {
    setBillId(selectedBillId);
    if (selectedBillId) {
      const bill = unpaidBills.find((b) => b._id === selectedBillId);
      if (bill) {
        // Prefill remaining due amount
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
          billId: billId || null,
          amount: numAmount,
          paymentDate,
          paymentMode,
          transactionReference,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log payment");

      success(`Payment of ₹${numAmount} logged successfully!`, "Payment Recorded");
      
      // Reset
      setCustomerId("");
      setBillId("");
      setAmount("");
      setTransactionReference("");
      setNotes("");
      setShowAddForm(false);
      
      fetchPayments();
      
      // Clean query params
      if (searchParams.get("customerId")) {
        router.replace("/owner/payments");
      }
    } catch (err: any) {
      error(err.message || "Error logging payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter payments list locally
  const filteredPayments = payments.filter((p) => {
    const custName = p.customerId?.name || "";
    const matchesSearch =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(search.toLowerCase()));

    const matchesCustomer = customerIdFilter === "" || p.customerId?._id === customerIdFilter;

    return matchesSearch && matchesCustomer;
  });

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
          onClick={() => {
            setShowAddForm(true);
          }}
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

              {/* Dynamic Bills listing */}
              {customerId && (
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
            placeholder="Search transaction list by customer or reference code..."
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

      {/* Transactions list Table */}
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
            Log customer transaction balances. Log your first payment entry using the button above.
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
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Amount Recd.</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Linked Invoice / Ref</th>
                  <th className="px-6 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {filteredPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/10 transition">
                    <td className="px-6 py-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold">{p.customerId?.name || "Unknown"}</td>
                    <td className="px-6 py-4 text-emerald-600 font-extrabold">₹{p.amount}</td>
                    <td className="px-6 py-4 uppercase text-xs">
                      <span className="bg-muted px-2.5 py-1 rounded-md border border-border">
                        {p.paymentMode.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold">
                      {p.billId ? (
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
                  </tr>
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
                  <span className="text-emerald-600 font-extrabold text-sm">₹{p.amount}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="bg-muted px-2 py-0.5 rounded border border-border uppercase text-[10px] font-semibold">
                    {p.paymentMode.replace("_", " ")}
                  </span>
                  
                  {p.billId ? (
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

                {(p.transactionReference || p.notes) && (
                  <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/30">
                    {p.transactionReference && (
                      <span className="block font-mono select-all">Ref: {p.transactionReference}</span>
                    )}
                    {p.notes && <span className="block mt-0.5">{p.notes}</span>}
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
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading payments ledger...</p>
      </div>
    }>
      <PaymentsLedgerContent />
    </Suspense>
  );
}
