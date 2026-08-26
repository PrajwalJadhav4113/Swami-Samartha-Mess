"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Printer, Download, Trash2, Loader2, CreditCard, QrCode, CheckCircle, AlertCircle, Edit2, PlusCircle } from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MealDetail {
  type: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface ExtraItemDetail {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface DailyRecord {
  date: string;
  dayOfWeek: string;
  morningMeal: "none" | "half" | "full";
  morningPrice: number;
  nightMeal: "none" | "half" | "full";
  nightPrice: number;
  isHoliday: boolean;
  holidayReason?: string;
  extras: {
    name: string;
    quantity: number;
    price: number;
    amount: number;
  }[];
  totalPrice: number;
}

interface BillAdjustmentChange {
  itemName: string;
  oldQty: number;
  newQty: number;
  oldRate: number;
  newRate: number;
  oldAmount: number;
  newAmount: number;
}

interface BillAdjustmentHistory {
  changedBy: string;
  changedAt: string;
  reason: string;
  originalAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  changes: BillAdjustmentChange[];
}

interface MenuItem {
  _id: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface BillData {
  _id: string;
  billNumber: string;
  customerId: {
    _id: string;
    name: string;
    mobile: string;
    address: string;
    pricingType?: "standard" | "special";
  };
  billingPeriodStart: string;
  billingPeriodEnd: string;
  mealDetails: MealDetail[];
  extraItemsDetails: ExtraItemDetail[];
  discount: number;
  advancePayment: number;
  previousBalance: number;
  finalTotal: number;
  originalTotal?: number;
  adjustmentAmount?: number;
  isAdjusted?: boolean;
  adjustmentReason?: string;
  adjustmentHistory?: BillAdjustmentHistory[];
  paymentStatus: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  dailyRecords?: DailyRecord[];
}

interface BusinessSettings {
  messName: string;
  address: string;
  contactNumber: string;
  upiId?: string;
  upiQrCode?: string;
}

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { success, error } = useToast();

  const [bill, setBill] = useState<BillData | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settling, setSettling] = useState(false);

  // Edit fields states
  const [isEditing, setIsEditing] = useState(false);
  const [editMealDetails, setEditMealDetails] = useState<MealDetail[]>([]);
  const [editExtraItemsDetails, setEditExtraItemsDetails] = useState<ExtraItemDetail[]>([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAdvancePayment, setEditAdvancePayment] = useState(0);
  const [editPreviousBalance, setEditPreviousBalance] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const handleUpdateStatus = async (status: "paid" | "pending") => {
    setSettling(true);
    try {
      const res = await fetch(`/api/owner/billing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: status }),
      });

      if (res.ok) {
        success(
          status === "paid"
            ? "Invoice marked as fully paid"
            : "Invoice marked as pending",
          "Invoice Updated"
        );
        // Refresh bill data
        const billRes = await fetch(`/api/owner/billing/${id}`);
        if (billRes.ok) {
          const billData = await billRes.json();
          setBill(billData);
        }
      } else {
        throw new Error();
      }
    } catch (err) {
      error("Failed to update payment status");
    } finally {
      setSettling(false);
    }
  };

  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentReason.trim()) {
      error("Please provide an adjustment reason");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/owner/billing/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealDetails: editMealDetails,
          extraItemsDetails: editExtraItemsDetails,
          discount: editDiscount,
          advancePayment: editAdvancePayment,
          previousBalance: editPreviousBalance,
          adjustmentReason: adjustmentReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save edits");

      success("Invoice adjusted successfully!");
      setBill(data.bill);
      setIsEditing(false);
    } catch (err: any) {
      error(err.message || "Error saving adjustments");
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    async function loadBillAndSettings() {
      setLoading(true);
      try {
        // Fetch bill
        const billRes = await fetch(`/api/owner/billing/${id}`);
        if (!billRes.ok) throw new Error("Invoice not found");
        const billData = await billRes.json();
        setBill(billData);

        // Fetch business settings
        const settingsRes = await fetch("/api/owner/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }

        // Fetch active menu items
        const menuRes = await fetch("/api/owner/menu");
        if (menuRes.ok) {
          const menuData = await menuRes.json();
          setMenuItems(menuData.filter((m: MenuItem) => m.isActive));
        }
      } catch (err: any) {
        error(err.message || "Failed to load invoice details");
        router.push("/owner/billing");
      } finally {
        setLoading(false);
      }
    }
    loadBillAndSettings();
  }, [id, error, router]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this bill? This action is permanent.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/owner/billing/${id}`, { method: "DELETE" });
      if (res.ok) {
        success("Invoice deleted successfully");
        router.push("/owner/billing");
      } else {
        throw new Error();
      }
    } catch (err) {
      error("Failed to delete invoice");
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!bill) return;

    const doc = new jsPDF();
    const messTitle = settings?.messName || "Swami Samartha Mess";
    const messAddr = settings?.address || "123, Main Street, Pune, Maharashtra";
    const messPhone = settings?.contactNumber || "+91 9876543210";

    // 1. Header Mess Branding
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(messTitle, 14, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(messAddr, 14, 26);
    doc.text(`Contact: ${messPhone}`, 14, 31);

    // Divider Line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 36, 196, 36);

    // 2. Invoice Meta Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`INVOICE STATEMENT: ${bill.billNumber}`, 14, 45);

    doc.setFont("helvetica", "normal");
    doc.text(`Bill Date: ${new Date(bill.createdAt).toLocaleDateString()}`, 14, 51);
    doc.text(
      `Billing Cycle: ${new Date(bill.billingPeriodStart).toLocaleDateString()} - ${new Date(
        bill.billingPeriodEnd
      ).toLocaleDateString()}`,
      14,
      57
    );

    // Customer Side info
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO:", 120, 45);
    doc.setFont("helvetica", "normal");
    doc.text(bill.customerId?.name || "Customer", 120, 51);
    doc.text(`Mobile: ${bill.customerId?.mobile || "-"}`, 120, 57);
    doc.text(`Address: ${bill.customerId?.address || "-"}`, 120, 63);

    // 3. Daily Ledger Table Columns
    const tableBody: any[] = [];

    bill.dailyRecords?.forEach((record) => {
      const dateObj = new Date(record.date);
      const formattedDate = `${dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })} (${record.dayOfWeek.substring(0, 3)})`;

      let mealsText = "";
      if (record.isHoliday) {
        mealsText = `Holiday: ${record.holidayReason || "Closed"}`;
      } else {
        const mealParts: string[] = [];
        if (record.morningMeal !== "none") {
          mealParts.push(`Morning: ${record.morningMeal === "full" ? "Full" : "Half"} (Rs. ${record.morningPrice})`);
        }
        if (record.nightMeal !== "none") {
          mealParts.push(`Night: ${record.nightMeal === "full" ? "Full" : "Half"} (Rs. ${record.nightPrice})`);
        }
        mealsText = mealParts.join("\n") || "No meals";
      }

      const extrasText = record.extras
        .map((e) => `${e.name} x${e.quantity} (Rs. ${e.amount})`)
        .join("\n") || "-";

      tableBody.push([formattedDate, mealsText, extrasText, `Rs. ${record.totalPrice}`]);
    });

    // Auto Table Generation
    autoTable(doc, {
      startY: 72,
      head: [["Date & Day", "Tiffin Meals", "Extras", "Cost"]],
      body: tableBody,
      headStyles: { fillColor: [99, 102, 241], fontSize: 9, font: "helvetica", fontStyle: "bold" },
      bodyStyles: { fontSize: 8, font: "helvetica" },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 68 },
        2: { cellWidth: 62 },
        3: { cellWidth: 28, halign: "right" },
      },
    });

    // 4. Financial Calculations block
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    let currentY = finalY;

    // Previous Balance
    doc.text("Previous Balance Due:", 120, currentY);
    doc.text(`Rs. ${bill.previousBalance}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Subtotal (Meals + Extras)
    const mealSub = bill.mealDetails.reduce((sum, m) => sum + m.amount, 0);
    const extSub = bill.extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    doc.text("Current Cycle Charges:", 120, currentY);
    doc.text(`Rs. ${mealSub + extSub}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Discount
    if (bill.discount > 0) {
      doc.text("Discount:", 120, currentY);
      doc.text(`- Rs. ${bill.discount}`, 196, currentY, { align: "right" });
      currentY += 6;
    }

    // Advance
    if (bill.advancePayment > 0) {
      doc.text("Advance Payment:", 120, currentY);
      doc.text(`- Rs. ${bill.advancePayment}`, 196, currentY, { align: "right" });
      currentY += 6;
    }

    // Final Total Divider
    doc.setDrawColor(220, 220, 220);
    doc.line(120, currentY, 196, currentY);
    currentY += 6;

    // Final Total
    doc.setFont("helvetica", "bold");
    doc.text("Final Total Amount:", 120, currentY);
    doc.text(`Rs. ${bill.finalTotal}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Amount Paid
    doc.setFont("helvetica", "normal");
    doc.text("Amount Paid:", 120, currentY);
    doc.text(`Rs. ${bill.amountPaid}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Net Outstanding
    doc.setFont("helvetica", "bold");
    doc.text("Net Balance Due:", 120, currentY);
    doc.text(`Rs. ${bill.finalTotal - bill.amountPaid}`, 196, currentY, { align: "right" });
    currentY += 10;

    // Payment notice & UPI ID
    if (settings?.upiId) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Please pay via UPI to: ${settings.upiId}`, 14, currentY);
      doc.text("Thank you for your business!", 14, currentY + 6);
    } else {
      doc.setFontSize(8);
      doc.text("Thank you for your business!", 14, currentY);
    }

    // Save document
    doc.save(`Invoice-${bill.billNumber}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading invoice view...</p>
      </div>
    );
  }

  if (!bill) return null;

  const mealSubtotal = bill.mealDetails.reduce((sum, m) => sum + m.amount, 0);
  const extrasSubtotal = bill.extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
  
  // Calculate credit/overpayment and remaining outstanding
  const creditOverpayment = bill.amountPaid > bill.finalTotal ? bill.amountPaid - bill.finalTotal : 0;
  const outstanding = bill.amountPaid > bill.finalTotal ? 0 : bill.finalTotal - bill.amountPaid;

  // Edit live calculations
  const newMealSum = editMealDetails.reduce((sum, m) => sum + (m.quantity * m.rate), 0);
  const newExtraSum = editExtraItemsDetails.reduce((sum, e) => sum + (e.quantity * e.rate), 0);
  const newSubtotal = newMealSum + newExtraSum + editPreviousBalance;
  const newFinalTotal = Math.max(0, newSubtotal - editDiscount - editAdvancePayment);
  const editAdjustmentAmount = newFinalTotal - (bill.originalTotal || bill.finalTotal);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Action Controls Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <Link
          href="/owner/billing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex flex-wrap gap-2">
          {bill.paymentStatus !== "paid" ? (
            <button
              onClick={() => handleUpdateStatus("paid")}
              disabled={settling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg hover-lift transition cursor-pointer shadow-sm"
            >
              {settling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              <span>Mark as Paid</span>
            </button>
          ) : (
            <button
              onClick={() => handleUpdateStatus("pending")}
              disabled={settling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg hover-lift transition cursor-pointer shadow-sm"
            >
              {settling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>Mark as Pending</span>
            </button>
          )}
          <button
            onClick={() => {
              setEditMealDetails(bill.mealDetails);
              setEditExtraItemsDetails(bill.extraItemsDetails);
              setEditDiscount(bill.discount);
              setEditAdvancePayment(bill.advancePayment);
              setEditPreviousBalance(bill.previousBalance);
              setAdjustmentReason("");
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition cursor-pointer shadow-sm"
          >
            <Edit2 className="h-3.5 w-3.5 text-primary" />
            <span>Edit Bill</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-lg hover-lift transition cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 dark:border-rose-950/40 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span>Delete Bill</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleConfirmEdit} className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-md space-y-6 no-print">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Edit Finalized Bill {bill.billNumber}</h3>
              <p className="text-xs text-muted-foreground">Adjust quantities, rates, extras, discounts, and save.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg cursor-pointer"
            >
              Cancel Edit
            </button>
          </div>

          {/* Standard Meals Edit Grid */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Standard Tiffin Meals</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["morning_full", "morning_half", "night_full", "night_half"] as const).map((type) => {
                const existing = editMealDetails.find((m) => m.type === type) || { type, quantity: 0, rate: 80, amount: 0 };
                return (
                  <div key={type} className="p-4 bg-muted/40 border border-border rounded-2xl flex items-center justify-between gap-4">
                    <span className="capitalize text-xs font-bold text-foreground">{type.replace("_", " ")}</span>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-[9px] text-muted-foreground block mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="0"
                          value={existing.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...editMealDetails];
                            const idx = updated.findIndex((m) => m.type === type);
                            if (idx > -1) {
                              updated[idx].quantity = val;
                              updated[idx].amount = val * updated[idx].rate;
                            } else {
                              updated.push({ type, quantity: val, rate: 80, amount: val * 80 });
                            }
                            setEditMealDetails(updated);
                          }}
                          className="w-16 px-2 py-1 bg-card border border-border rounded text-xs font-bold text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground block mb-0.5">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={existing.rate}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...editMealDetails];
                            const idx = updated.findIndex((m) => m.type === type);
                            if (idx > -1) {
                              updated[idx].rate = val;
                              updated[idx].amount = existing.quantity * val;
                            } else {
                              updated.push({ type, quantity: 0, rate: val, amount: 0 });
                            }
                            setEditMealDetails(updated);
                          }}
                          className="w-16 px-2 py-1 bg-card border border-border rounded text-xs font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Extra Items Edit Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-border/50 pb-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Extra / Custom Items</span>
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    const item = menuItems.find((m) => m._id === e.target.value);
                    if (item) {
                      const existing = editExtraItemsDetails.find((ext) => ext.name === item.name);
                      if (existing) {
                        existing.quantity += 1;
                        existing.amount = existing.quantity * existing.rate;
                        setEditExtraItemsDetails([...editExtraItemsDetails]);
                      } else {
                        setEditExtraItemsDetails([
                          ...editExtraItemsDetails,
                          { name: item.name, quantity: 1, rate: item.price, amount: item.price }
                        ]);
                      }
                    }
                  }}
                  className="px-2 py-1 text-xs border border-border bg-card rounded font-bold cursor-pointer"
                >
                  <option value="">+ Add Extra Item</option>
                  {menuItems.map((m) => (
                    <option key={m._id} value={m._id}>{m.name} (₹{m.price})</option>
                  ))}
                </select>
              </div>
            </div>

            {editExtraItemsDetails.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic py-2">No extra items added to this bill yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/70 text-[9px] uppercase font-bold text-muted-foreground border-b border-border">
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-center">Rate</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-semibold text-foreground">
                    {editExtraItemsDetails.map((ext, extIdx) => (
                      <tr key={extIdx} className="hover:bg-muted/5">
                        <td className="px-3 py-2">{ext.name}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={ext.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const updated = [...editExtraItemsDetails];
                              updated[extIdx].quantity = val;
                              updated[extIdx].amount = val * ext.rate;
                              setEditExtraItemsDetails(updated);
                            }}
                            className="w-12 px-1 py-0.5 bg-muted border border-border rounded text-center font-bold"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={ext.rate}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const updated = [...editExtraItemsDetails];
                              updated[extIdx].rate = val;
                              updated[extIdx].amount = ext.quantity * val;
                              setEditExtraItemsDetails(updated);
                            }}
                            className="w-16 px-1 py-0.5 bg-muted border border-border rounded text-center font-bold"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">₹{ext.amount}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editExtraItemsDetails];
                              updated.splice(extIdx, 1);
                              setEditExtraItemsDetails(updated);
                            }}
                            className="text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Adjustments: Discount, Advance, Previous balance */}
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={editDiscount}
                onChange={(e) => setEditDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Advance Applied (₹)</label>
              <input
                type="number"
                min="0"
                value={editAdvancePayment}
                onChange={(e) => setEditAdvancePayment(Number(e.target.value))}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Previous Balance (₹)</label>
              <input
                type="number"
                min="0"
                value={editPreviousBalance}
                onChange={(e) => setEditPreviousBalance(Number(e.target.value))}
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>
          </div>

          {/* Live Totals Math */}
          <div className="border-t border-border pt-4 p-4 bg-muted/40 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs font-bold">
            <div>
              <span className="text-muted-foreground">Original Total:</span>
              <span className="font-extrabold text-foreground ml-1.5">₹{bill.originalTotal || bill.finalTotal}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Adjustment Difference:</span>
              <span className={`font-extrabold ml-1.5 ${editAdjustmentAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {editAdjustmentAmount >= 0 ? '+' : ''}₹{editAdjustmentAmount}
              </span>
            </div>
            <div className="text-base font-black">
              <span className="text-foreground">New Final Total:</span>
              <span className="text-primary ml-1.5">₹{newFinalTotal}</span>
            </div>
          </div>

          {/* Reason for Edit */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
              Reason for Adjustment / Correction <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="e.g. Extra tiffins recorded by mistake"
              className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
            />
          </div>

          {/* Save Button */}
          <div className="border-t border-border pt-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Save & Apply Adjustment</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="print-card bg-card border border-border rounded-3xl p-8 md:p-12 shadow-md space-y-8 relative overflow-hidden">
        {/* Decorative corner seal */}
        <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none no-print">
          <div className={`absolute top-4 right-[-30px] rotate-45 text-center text-[10px] font-extrabold uppercase py-1 w-32 shadow-sm ${
            bill.paymentStatus === "paid" ? "bg-emerald-500 text-white" :
            bill.paymentStatus === "partially_paid" ? "bg-amber-500 text-white" :
            "bg-rose-500 text-white"
          }`}>
            {bill.paymentStatus.replace("_", " ")}
          </div>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
              {settings?.messName || "Swami Samartha Mess"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {settings?.address || "123, Main Street, Pune, Maharashtra"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contact: {settings?.contactNumber || "+91 9876543210"}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {bill.customerId?.pricingType === "special" && (
                <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full inline-block shadow-sm">
                  ⭐ Special Customer Pricing
                </span>
              )}
              {bill.isAdjusted && (
                <span className="text-[9px] bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full inline-block shadow-sm">
                  ✏️ Adjusted Bill
                </span>
              )}
            </div>
          </div>

          <div className="text-left md:text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Invoice Statement
            </span>
            <span className="text-lg md:text-xl font-black block mt-0.5">{bill.billNumber}</span>
            <span className="text-xs text-muted-foreground block mt-1">
              Date: {new Date(bill.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Customer & Period Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/40 border border-border p-5 rounded-2xl">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Billed To:
            </span>
            <span className="font-extrabold text-sm block mt-1">{bill.customerId?.name}</span>
            <span className="text-xs text-muted-foreground block mt-0.5">Mobile: {bill.customerId?.mobile}</span>
            <span className="text-xs text-muted-foreground block mt-0.5">Address: {bill.customerId?.address}</span>
          </div>
          <div className="md:text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Billing Period:
            </span>
            <span className="font-extrabold text-sm block mt-1">
              {new Date(bill.billingPeriodStart).toLocaleDateString()} - {new Date(bill.billingPeriodEnd).toLocaleDateString()}
            </span>
            <span className="text-xs text-muted-foreground block mt-1.5">
              Cycle: Item-based ledger
            </span>
          </div>
        </div>

        {/* Daily Ledger Breakdown */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily Ledger (Day-by-Day)</h3>
          <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm font-medium min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase">
                  <th className="px-5 py-3">Date & Day</th>
                  <th className="px-5 py-3">Tiffin Meals</th>
                  <th className="px-5 py-3">Extra Items</th>
                  <th className="px-5 py-3 text-right">Daily Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bill.dailyRecords?.map((record, idx) => {
                  const hasMeals = record.morningMeal !== "none" || record.nightMeal !== "none";
                  const hasExtras = record.extras.length > 0;
                  
                  const dateObj = new Date(record.date);
                  const formattedDate = dateObj.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  });
                  const shortDay = record.dayOfWeek.substring(0, 3);

                  return (
                    <tr 
                      key={`day-${idx}`} 
                      className={`hover:bg-muted/10 transition ${record.isHoliday ? "bg-zinc-50/50 dark:bg-zinc-900/30 text-muted-foreground" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-bold whitespace-nowrap">
                        {formattedDate} ({shortDay})
                      </td>
                      <td className="px-5 py-3.5">
                        {record.isHoliday ? (
                          <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                            Holiday: {record.holidayReason || "Mess Closed"}
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {record.morningMeal !== "none" && (
                              <div className="text-xs">
                                <span className="font-bold">Morning:</span> {record.morningMeal === "full" ? "Full" : "Half"} (₹{record.morningPrice})
                              </div>
                            )}
                            {record.nightMeal !== "none" && (
                              <div className="text-xs">
                                <span className="font-bold">Night:</span> {record.nightMeal === "full" ? "Full" : "Half"} (₹{record.nightPrice})
                              </div>
                            )}
                            {!hasMeals && <span className="text-xs text-muted-foreground/60 italic">No meals</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasExtras ? (
                          <div className="space-y-0.5">
                            {record.extras.map((extra, eIdx) => (
                              <div key={eIdx} className="text-xs">
                                {extra.name} x {extra.quantity} (₹{extra.amount})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-extrabold whitespace-nowrap">
                        ₹{record.totalPrice}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculations Block & QR payment */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start border-t border-border pt-6">
          {/* UPI details & scan QR code */}
          <div className="md:col-span-6 space-y-4">
            {settings?.upiId ? (
              <div className="p-4 bg-muted rounded-2xl border border-border space-y-3 max-w-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  <span>Scan to pay via UPI</span>
                </h4>
                
                <div className="flex items-center gap-4">
                  {settings.upiQrCode ? (
                    <div className="h-20 w-20 bg-white border border-border p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <img src={settings.upiQrCode} alt="UPI QR" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-20 w-20 bg-white border border-border p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center text-muted-foreground">
                      <QrCode className="h-full w-full" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">{settings.messName}</span>
                    <span className="text-[10px] text-muted-foreground block font-medium select-all truncate mt-0.5">
                      UPI ID: {settings.upiId}
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block">
                      Secure Payment
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                * Note: Register your UPI details in Settings to automatically generate a scan QR Code here.
              </p>
            )}
            
            {bill.notes && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs font-semibold text-muted-foreground border border-border">
                Notes: {bill.notes}
              </div>
            )}
          </div>

          {/* Financial Totals */}
          <div className="md:col-span-6 flex flex-col gap-2.5 text-xs md:text-sm font-semibold ml-auto w-full max-w-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Previous Balance Due:</span>
              <span>₹{bill.previousBalance}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tiffin Meals Subtotal:</span>
              <span>₹{bill.mealDetails.reduce((sum, m) => sum + m.amount, 0)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Extra Items Subtotal:</span>
              <span>₹{extrasSubtotal}</span>
            </div>

            {bill.discount > 0 && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Discount Applied:</span>
                <span>- ₹{bill.discount}</span>
              </div>
            )}

            {bill.advancePayment > 0 && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Advance Applied:</span>
                <span>- ₹{bill.advancePayment}</span>
              </div>
            )}

            <div className="border-t border-border my-1.5" />

            {bill.isAdjusted && (
              <>
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Original Total:</span>
                  <span>₹{bill.originalTotal}</span>
                </div>
                <div className={`flex items-center justify-between text-xs font-bold ${bill.adjustmentAmount !== undefined && bill.adjustmentAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  <span>Adjustment:</span>
                  <span>{bill.adjustmentAmount !== undefined && bill.adjustmentAmount >= 0 ? '+' : ''}₹{bill.adjustmentAmount}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between text-base font-black">
              <span>Final Bill Total:</span>
              <span>₹{bill.finalTotal}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Amount Paid:</span>
              <span>₹{bill.amountPaid}</span>
            </div>

            {creditOverpayment > 0 && (
              <div className="flex items-center justify-between text-emerald-600 text-xs font-bold">
                <span>Credit / Overpayment:</span>
                <span>₹{creditOverpayment}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-base font-black text-rose-600 border-t border-dashed border-border pt-1.5">
              <span>Net Balance Due:</span>
              <span>₹{outstanding}</span>
            </div>
          </div>
        </div>
        {bill.adjustmentHistory && bill.adjustmentHistory.length > 0 && (
          <div className="border-t border-border pt-6 mt-6 space-y-4 no-print">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span>Adjustment Audit History Log</span>
            </h3>
            <div className="space-y-4">
              {bill.adjustmentHistory.map((history, historyIdx) => (
                <div key={historyIdx} className="p-4 bg-muted/40 border border-border rounded-xl text-xs space-y-2.5">
                  <div className="flex justify-between items-start flex-wrap gap-2 border-b border-border/50 pb-2">
                    <div>
                      <span className="font-extrabold text-foreground">Adjusted by: {history.changedBy}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {new Date(history.changedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-right font-semibold">
                      <span className="text-foreground">Original: ₹{history.originalAmount}</span>
                      <span className={`block text-[10px] ${history.adjustmentAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Adjustment: {history.adjustmentAmount >= 0 ? '+' : ''}₹{history.adjustmentAmount}
                      </span>
                      <span className="font-black text-foreground block">Final: ₹{history.finalAmount}</span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Reason for adjustment:</span>
                    <span className="font-semibold text-foreground text-xs">{history.reason}</span>
                  </div>

                  {history.changes && history.changes.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Change Details:</span>
                      <div className="divide-y divide-border/40 border border-border/40 rounded-lg overflow-hidden bg-card">
                        {history.changes.map((change, changeIdx) => (
                          <div key={changeIdx} className="p-2.5 flex justify-between items-center text-[11px] hover:bg-muted/10 font-medium">
                            <span className="capitalize text-foreground font-bold">{change.itemName}</span>
                            <div className="flex gap-x-4 text-muted-foreground">
                              <span>Qty: {change.oldQty} → {change.newQty} (Diff: {change.newQty - change.oldQty})</span>
                              <span>Rate: ₹{change.oldRate} → ₹{change.newRate}</span>
                              <span className="font-bold text-foreground">Amount: ₹{change.oldAmount} → ₹{change.newAmount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
