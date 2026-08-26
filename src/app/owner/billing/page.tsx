"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Receipt, PlusCircle, Search, Filter, Calendar, FileText, Loader2, IndianRupee } from "lucide-react";
import Link from "next/link";

interface CustomerSummary {
  _id: string;
  name: string;
}

interface BillItem {
  _id: string;
  billNumber: string;
  customerId: {
    _id: string;
    name: string;
    mobile: string;
  };
  billingPeriodStart: string;
  billingPeriodEnd: string;
  finalTotal: number;
  amountPaid: number;
  paymentStatus: "pending" | "paid" | "partially_paid";
  createdAt: string;
}

function BillingEngineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();

  const [bills, setBills] = useState<BillItem[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [advancePayment, setAdvancePayment] = useState("0");
  const [notes, setNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Search & Filter list states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingBillId, setUpdatingBillId] = useState<string | null>(null);

  const handleUpdateBillStatus = async (billId: string, status: "paid" | "pending") => {
    setUpdatingBillId(billId);
    try {
      const res = await fetch(`/api/owner/billing/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: status }),
      });

      if (res.ok) {
        success(
          status === "paid" ? "Invoice marked as paid" : "Invoice marked as pending",
          "Invoice Updated"
        );
        fetchBills();
      } else {
        throw new Error();
      }
    } catch (err) {
      error("Failed to update payment status");
    } finally {
      setUpdatingBillId(null);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/billing");
      if (!res.ok) throw new Error("Failed to load invoice list");
      const data = await res.json();
      setBills(data);
    } catch (err: any) {
      error(err.message || "Failed to load generated bills");
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
      console.error("Error fetching customer list:", err);
    }
  };

  useEffect(() => {
    fetchBills();
    fetchCustomers();
  }, []);

  // Pre-fill customer ID if passed in URL
  useEffect(() => {
    const custParam = searchParams.get("customerId");
    if (custParam) {
      setCustomerId(custParam);
      setShowAddForm(true);
      
      // Auto fill start and end of previous month as sensible defaults
      const d = new Date();
      // Set to first day of last month
      const firstDayPrevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      // Set to last day of last month
      const lastDayPrevMonth = new Date(d.getFullYear(), d.getMonth(), 0);

      setStartDate(firstDayPrevMonth.toISOString().split("T")[0]);
      setEndDate(lastDayPrevMonth.toISOString().split("T")[0]);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !startDate || !endDate) {
      error("Customer and Period dates are required");
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/owner/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          startDate,
          endDate,
          discount: parseFloat(discount) || 0,
          advancePayment: parseFloat(advancePayment) || 0,
          notes,
          preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch bill preview");

      setPreviewData(data);
      setShowPreview(true);
    } catch (err: any) {
      error(err.message || "Error fetching bill preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/owner/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          startDate,
          endDate,
          discount: parseFloat(discount) || 0,
          advancePayment: parseFloat(advancePayment) || 0,
          notes,
          preview: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate bill");

      success(`Invoice ${data.billNumber} created successfully!`, "Bill Calculated");
      
      // Reset
      setCustomerId("");
      setStartDate("");
      setEndDate("");
      setDiscount("0");
      setAdvancePayment("0");
      setNotes("");
      setShowAddForm(false);
      setShowPreview(false);
      setPreviewData(null);
      
      fetchBills();
      
      // Clean query params
      if (searchParams.get("customerId")) {
        router.replace("/owner/billing");
      }
    } catch (err: any) {
      error(err.message || "Error generating bill");
    } finally {
      setGenerating(false);
    }
  };

  // Filter bills list locally
  const filteredBills = bills.filter((b) => {
    const custName = b.customerId?.name || "";
    const billNum = b.billNumber || "";
    const matchesSearch =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      billNum.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "" || b.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing Engine</h2>
          <p className="text-sm text-muted-foreground">
            Aggregate meal records, apply discounts, advances, outstanding balances, and generate invoice bills.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            const d = new Date();
            const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            const last = new Date(d.getFullYear(), d.getMonth(), 0);
            setStartDate(first.toISOString().split("T")[0]);
            setEndDate(last.toISOString().split("T")[0]);
          }}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2.5 rounded-xl hover-lift shadow-md transition self-start cursor-pointer"
        >
          <PlusCircle className="h-4.5 w-4.5" />
          <span>Generate Invoice</span>
        </button>
      </div>

      {/* Bill generation Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-base">
                {showPreview ? "Billing Summary Preview" : "Generate Monthly Bill"}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setShowPreview(false);
                  setPreviewData(null);
                  if (searchParams.get("customerId")) router.replace("/owner/billing");
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2 py-1 rounded-lg hover:bg-muted"
              >
                Close
              </button>
            </div>

            {showPreview && previewData ? (
              <div className="p-6 space-y-4">
                {/* Summary Row */}
                <div className="grid grid-cols-3 gap-3 bg-muted/50 p-4 rounded-xl text-center border border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Consumed</span>
                    <span className="text-sm font-extrabold text-foreground">₹{previewData.totalConsumption}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Already Billed</span>
                    <span className="text-sm font-extrabold text-rose-600">₹{previewData.alreadyBilled}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Unbilled Now</span>
                    <span className="text-sm font-extrabold text-emerald-600">₹{previewData.unbilledConsumption}</span>
                  </div>
                </div>

                {/* Date Ranges Detail Row */}
                <div className="space-y-1.5 p-3.5 bg-card border border-border rounded-xl text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Selected Period:</span>
                    <span className="font-bold">
                      {new Date(startDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} – {new Date(endDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {previewData.alreadyBilledDatesRange && previewData.alreadyBilledDatesRange !== "None" && (
                    <div className="flex justify-between text-rose-600">
                      <span className="font-semibold">Already Billed:</span>
                      <span className="font-bold">{previewData.alreadyBilledDatesRange}</span>
                    </div>
                  )}
                  {previewData.unbilledDatesRange && previewData.unbilledDatesRange !== "None" && (
                    <div className="flex justify-between text-emerald-600">
                      <span className="font-semibold">Unbilled Period:</span>
                      <span className="font-bold">{previewData.unbilledDatesRange}</span>
                    </div>
                  )}
                </div>

                {previewData.unbilledConsumption === 0 ? (
                  <div className="space-y-4 py-2">
                    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-455 p-4 rounded-xl text-xs space-y-1">
                      <span className="font-bold block text-sm">No unbilled consumption found!</span>
                      <span>All food consumption for this period has already been included in existing bills.</span>
                    </div>

                    {previewData.existingBills && previewData.existingBills.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Existing Bills for this range:</span>
                        <div className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
                          {previewData.existingBills.map((b: any) => (
                            <div key={b._id} className="p-3 flex items-center justify-between hover:bg-muted/10 text-xs">
                              <div>
                                <span className="font-bold text-foreground block">{b.billNumber}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(b.billingPeriodStart).toLocaleDateString()} - {new Date(b.billingPeriodEnd).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-foreground">₹{b.finalTotal}</span>
                                <Link
                                  href={`/owner/billing/${b._id}`}
                                  className="px-2.5 py-1.5 border border-border bg-card hover:bg-muted font-bold rounded-lg text-[10px] transition"
                                >
                                  View Bill
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Itemized Table */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase block">Unbilled Breakdown</span>
                      <div className="border border-border rounded-xl overflow-hidden bg-card text-xs max-h-48 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-muted/70 text-[10px] uppercase font-bold text-muted-foreground border-b border-border">
                              <th className="px-3 py-2">Item Description</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                              <th className="px-3 py-2 text-right">Rate</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 font-semibold text-foreground">
                            {previewData.mealDetails.map((m: any) => (
                              <tr key={m.type} className="hover:bg-muted/5">
                                <td className="px-3 py-2 capitalize">{m.type.replace("_", " ")}</td>
                                <td className="px-3 py-2 text-center">{m.quantity}</td>
                                <td className="px-3 py-2 text-right">₹{m.rate}</td>
                                <td className="px-3 py-2 text-right">₹{m.amount}</td>
                              </tr>
                            ))}
                            {previewData.extraItemsDetails.map((e: any, idx: number) => (
                              <tr key={idx} className="hover:bg-muted/5">
                                <td className="px-3 py-2">{e.name}</td>
                                <td className="px-3 py-2 text-center">{e.quantity}</td>
                                <td className="px-3 py-2 text-right">₹{e.rate}</td>
                                <td className="px-3 py-2 text-right">₹{e.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Summary Math */}
                    <div className="border-t border-border pt-3 space-y-2 text-xs font-bold">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-semibold">Unbilled Subtotal:</span>
                        <span>₹{previewData.unbilledConsumption}</span>
                      </div>
                      {previewData.previousBalance > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-semibold">Previous Outstanding:</span>
                          <span className="text-rose-600">+ ₹{previewData.previousBalance}</span>
                        </div>
                      )}
                      {previewData.discount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount Applied:</span>
                          <span>- ₹{previewData.discount}</span>
                        </div>
                      )}
                      {previewData.advancePayment > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Advance Applied:</span>
                          <span>- ₹{previewData.advancePayment}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold border-t border-border pt-2 text-foreground">
                        <span>Final Total Amount:</span>
                        <span className="text-primary text-base">₹{previewData.finalTotal}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="border-t border-border pt-4 flex gap-3 justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                  >
                    Back to Edit
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setShowPreview(false);
                        setPreviewData(null);
                        if (searchParams.get("customerId")) router.replace("/owner/billing");
                      }}
                      className="px-4 py-2 hover:bg-muted text-sm text-muted-foreground font-semibold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    {previewData.unbilledConsumption > 0 && (
                      <button
                        type="button"
                        onClick={handleConfirmGenerate}
                        disabled={generating}
                        className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        <span>
                          {previewData.alreadyBilled > 0 ? "Generate Unbilled Amount" : "Confirm & Generate Bill"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                      Advance Paid (₹)
                    </label>
                    <input
                      type="number"
                      value={advancePayment}
                      onChange={(e) => setAdvancePayment(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Adjusted from credit note"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>

                <div className="border-t border-border pt-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setShowPreview(false);
                      setPreviewData(null);
                      if (searchParams.get("customerId")) router.replace("/owner/billing");
                    }}
                    className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={previewLoading}
                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>Calculate & Preview</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Filters Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bills by Customer Name or Bill No..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:border-primary/20 focus:outline-none transition text-sm font-medium"
          />
        </div>

        <div className="relative flex items-center w-full sm:w-44 flex-shrink-0">
          <span className="absolute left-3 text-muted-foreground pointer-events-none">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-8.5 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold focus:outline-none focus:border-primary/20 appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Invoice Ledger Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Retrieving invoices...</p>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <Receipt className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Bills Found</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Try adjusting your search query, status filters, or compute a new monthly bill.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-bold uppercase">
                  <th className="px-6 py-4">Bill Number</th>
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Billing Period</th>
                  <th className="px-6 py-4">Final Total</th>
                  <th className="px-6 py-4">Outstanding</th>
                  <th className="px-6 py-4">Payment Status</th>
                  <th className="px-6 py-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {filteredBills.map((b) => (
                  <tr key={b._id} className="hover:bg-muted/10 transition">
                    <td className="px-6 py-4 font-bold">{b.billNumber}</td>
                    <td className="px-6 py-4 flex items-center gap-1.5">
                      {b.customerId?.pricingType === "special" && (
                        <span className="text-amber-500 font-extrabold" title="Special Customer">⭐</span>
                      )}
                      <span>{b.customerId?.name || "Unknown"}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(b.billingPeriodStart).toLocaleDateString()} - {new Date(b.billingPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">₹{b.finalTotal}</td>
                    <td className="px-6 py-4 text-rose-600">₹{b.finalTotal - b.amountPaid}</td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        b.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                        b.paymentStatus === "partially_paid" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                        "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                      }`}>
                        {b.paymentStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {b.paymentStatus !== "paid" ? (
                        <button
                          disabled={updatingBillId === b._id}
                          onClick={() => handleUpdateBillStatus(b._id, "paid")}
                          className="text-[10px] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200/50 transition cursor-pointer"
                        >
                          {updatingBillId === b._id ? "..." : "Settle"}
                        </button>
                      ) : (
                        <button
                          disabled={updatingBillId === b._id}
                          onClick={() => handleUpdateBillStatus(b._id, "pending")}
                          className="text-[10px] bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-1.5 rounded-lg border border-amber-200/50 transition cursor-pointer"
                        >
                          {updatingBillId === b._id ? "..." : "Reset"}
                        </button>
                      )}
                      <Link
                        href={`/owner/billing/${b._id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition"
                      >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        <span>Open Bill</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="block md:hidden divide-y divide-border">
            {filteredBills.map((b) => (
              <div key={b._id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-sm block">{b.billNumber}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      {b.customerId?.pricingType === "special" && (
                        <span className="text-amber-500 font-extrabold" title="Special Customer">⭐</span>
                      )}
                      <span>{b.customerId?.name || "Unknown"}</span>
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    b.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                    b.paymentStatus === "partially_paid" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                    "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                  }`}>
                    {b.paymentStatus.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Period</span>
                    <span className="font-semibold block truncate">
                      {new Date(b.billingPeriodStart).toLocaleDateString("en-IN", {month: "short", day: "numeric"})} - {new Date(b.billingPeriodEnd).toLocaleDateString("en-IN", {month: "short", day: "numeric"})}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total</span>
                    <span className="font-bold block text-foreground">₹{b.finalTotal}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Outstanding</span>
                    <span className="font-bold block text-rose-600">₹{b.finalTotal - b.amountPaid}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  {b.paymentStatus !== "paid" ? (
                    <button
                      disabled={updatingBillId === b._id}
                      onClick={() => handleUpdateBillStatus(b._id, "paid")}
                      className="text-[10px] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200/50 transition cursor-pointer"
                    >
                      {updatingBillId === b._id ? "..." : "Settle"}
                    </button>
                  ) : (
                    <button
                      disabled={updatingBillId === b._id}
                      onClick={() => handleUpdateBillStatus(b._id, "pending")}
                      className="text-[10px] bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-1.5 rounded-lg border border-amber-200/50 transition cursor-pointer"
                    >
                      {updatingBillId === b._id ? "..." : "Reset"}
                    </button>
                  )}
                  <Link
                    href={`/owner/billing/${b._id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>Open Bill</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingEngine() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading bills workspace...</p>
      </div>
    }>
      <BillingEngineContent />
    </Suspense>
  );
}
