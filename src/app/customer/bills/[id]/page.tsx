"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Printer, Download, Loader2, CreditCard, QrCode } from "lucide-react";
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

interface BillData {
  _id: string;
  billNumber: string;
  customerId: {
    _id: string;
    name: string;
    mobile: string;
    address: string;
  };
  billingPeriodStart: string;
  billingPeriodEnd: string;
  mealDetails: MealDetail[];
  extraItemsDetails: ExtraItemDetail[];
  discount: number;
  advancePayment: number;
  previousBalance: number;
  finalTotal: number;
  paymentStatus: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
}

interface BusinessSettings {
  messName: string;
  address: string;
  contactNumber: string;
  upiId?: string;
  upiQrCode?: string;
}

export default function CustomerBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { error } = useToast();

  const [bill, setBill] = useState<BillData | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBillAndSettings() {
      setLoading(true);
      try {
        const billRes = await fetch(`/api/customer/bills`); // Fetching customer bills list checks security
        if (!billRes.ok) throw new Error("Invoice list not loadable");
        const list: BillData[] = await billRes.json();
        const found = list.find((b) => b._id === id);
        
        if (!found) {
          throw new Error("Invoice not found or unauthorized access");
        }
        setBill(found);

        const settingsRes = await fetch("/api/owner/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }
      } catch (err: any) {
        error(err.message || "Failed to load invoice details");
        router.push("/customer/bills");
      } finally {
        setLoading(false);
      }
    }
    loadBillAndSettings();
  }, [id, error, router]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!bill) return;

    const doc = new jsPDF();
    const messTitle = settings?.messName || "Swami Samartha Mess";
    const messAddr = settings?.address || "123, Main Street, Pune, Maharashtra";
    const messPhone = settings?.contactNumber || "+91 9876543210";

    // Header Mess branding
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

    // Invoice Meta details
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

    // Customer info
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO:", 120, 45);
    doc.setFont("helvetica", "normal");
    doc.text(bill.customerId?.name || "Customer", 120, 51);
    doc.text(`Mobile: ${bill.customerId?.mobile || "-"}`, 120, 57);
    doc.text(`Address: ${bill.customerId?.address || "-"}`, 120, 63);

    // Itemized Table Columns
    const tableBody: any[] = [];

    // Add meals
    bill.mealDetails.forEach((m) => {
      let label = m.type;
      if (m.type === "morning_full") label = "Morning Full Tiffin";
      else if (m.type === "morning_half") label = "Morning Half Tiffin";
      else if (m.type === "night_full") label = "Night Full Tiffin";
      else if (m.type === "night_half") label = "Night Half Tiffin";

      tableBody.push([label, m.quantity, `Rs. ${m.rate}`, `Rs. ${m.amount}`]);
    });

    // Add extras
    bill.extraItemsDetails.forEach((e) => {
      tableBody.push([e.name, e.quantity, `Rs. ${e.rate}`, `Rs. ${e.amount}`]);
    });

    autoTable(doc, {
      startY: 72,
      head: [["Item Name / Service", "Qty", "Rate", "Total"]],
      body: tableBody,
      headStyles: { fillColor: [99, 102, 241], fontSize: 9, font: "helvetica", fontStyle: "bold" },
      bodyStyles: { fontSize: 9, font: "helvetica" },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 40, halign: "right" },
        3: { cellWidth: 42, halign: "right" },
      },
    });

    // Financial Calculations
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let currentY = finalY;

    // Previous Balance
    doc.text("Previous Balance Due:", 120, currentY);
    doc.text(`Rs. ${bill.previousBalance}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Subtotal
    const mealSub = bill.mealDetails.reduce((sum, m) => sum + m.amount, 0);
    const extSub = bill.extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
    doc.text("Current Cycle Charges:", 120, currentY);
    doc.text(`Rs. ${mealSub + extSub}`, 196, currentY, { align: "right" });
    currentY += 6;

    if (bill.discount > 0) {
      doc.text("Discount:", 120, currentY);
      doc.text(`- Rs. ${bill.discount}`, 196, currentY, { align: "right" });
      currentY += 6;
    }

    if (bill.advancePayment > 0) {
      doc.text("Advance Payment:", 120, currentY);
      doc.text(`- Rs. ${bill.advancePayment}`, 196, currentY, { align: "right" });
      currentY += 6;
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(120, currentY, 196, currentY);
    currentY += 6;

    // Final Total
    doc.setFont("helvetica", "bold");
    doc.text("Final Total Amount:", 120, currentY);
    doc.text(`Rs. ${bill.finalTotal}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Paid
    doc.setFont("helvetica", "normal");
    doc.text("Amount Paid:", 120, currentY);
    doc.text(`Rs. ${bill.amountPaid}`, 196, currentY, { align: "right" });
    currentY += 6;

    // Net Outstanding
    doc.setFont("helvetica", "bold");
    doc.text("Net Balance Due:", 120, currentY);
    doc.text(`Rs. ${bill.finalTotal - bill.amountPaid}`, 196, currentY, { align: "right" });

    // Payment notice
    if (settings?.upiId) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Please pay via UPI to: ${settings.upiId}`, 14, finalY + 5);
      doc.text("Thank you for your business!", 14, finalY + 11);
    } else {
      doc.setFontSize(8);
      doc.text("Thank you for your business!", 14, finalY + 5);
    }

    doc.save(`Invoice-${bill.billNumber}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading invoice details...</p>
      </div>
    );
  }

  if (!bill) return null;

  const mealSubtotal = bill.mealDetails.reduce((sum, m) => sum + m.amount, 0);
  const extrasSubtotal = bill.extraItemsDetails.reduce((sum, e) => sum + e.amount, 0);
  const outstanding = bill.finalTotal - bill.amountPaid;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Controls */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <Link
          href="/customer/bills"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {/* Printable Invoice Card */}
      <div className="print-card bg-card border border-border rounded-3xl p-8 md:p-12 shadow-md space-y-8 relative overflow-hidden">
        {/* Ribbon banner */}
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

        {/* Itemized Table Breakdown */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itemized Breakdown</h3>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs md:text-sm font-medium">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-center">Quantity</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Meals */}
                {bill.mealDetails.map((m, idx) => {
                  let label = m.type;
                  if (m.type === "morning_full") label = "Morning Full Tiffin";
                  else if (m.type === "morning_half") label = "Morning Half Tiffin";
                  else if (m.type === "night_full") label = "Night Full Tiffin";
                  else if (m.type === "night_half") label = "Night Half Tiffin";

                  return (
                    <tr key={`meal-${idx}`} className="hover:bg-muted/10">
                      <td className="px-5 py-3.5 font-bold">{label}</td>
                      <td className="px-5 py-3.5 text-center">{m.quantity}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">₹{m.rate}</td>
                      <td className="px-5 py-3.5 text-right font-bold">₹{m.amount}</td>
                    </tr>
                  );
                })}

                {/* Extras */}
                {bill.extraItemsDetails.map((e, idx) => (
                  <tr key={`extra-${idx}`} className="hover:bg-muted/10">
                    <td className="px-5 py-3.5 font-semibold text-foreground">{e.name}</td>
                    <td className="px-5 py-3.5 text-center">{e.quantity}</td>
                    <td className="px-5 py-3.5 text-right text-muted-foreground">₹{e.rate}</td>
                    <td className="px-5 py-3.5 text-right font-bold">₹{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculations & Scan UPI QR */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start border-t border-border pt-6">
          {/* UPI details QR */}
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
                    <span className="text-[10px] text-muted-foreground block font-semibold select-all truncate mt-0.5">
                      UPI ID: {settings.upiId}
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block">
                      Secure Payment
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            
            {bill.notes && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs font-semibold text-muted-foreground border border-border">
                Notes: {bill.notes}
              </div>
            )}
          </div>

          {/* Calculations */}
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

            <div className="flex items-center justify-between text-base font-black">
              <span>Final Bill Total:</span>
              <span>₹{bill.finalTotal}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Amount Paid:</span>
              <span>₹{bill.amountPaid}</span>
            </div>

            <div className="flex items-center justify-between text-base font-black text-rose-600 border-t border-dashed border-border pt-1.5">
              <span>Net Balance Due:</span>
              <span>₹{outstanding}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
