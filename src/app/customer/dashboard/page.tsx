"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Utensils, AlertCircle, CircleDollarSign, CalendarDays, QrCode, CreditCard, Clock, IndianRupee, Loader2 } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  todayMeal: {
    morningMeal: "none" | "half" | "full";
    nightMeal: "none" | "half" | "full";
    notes: string;
  };
  todayHoliday: { reason: string } | null;
  outstandingAmount: number;
  recentPayments: any[];
  menuItems: any[];
}

interface BusinessSettings {
  messName: string;
  address: string;
  contactNumber: string;
  upiId?: string;
  upiQrCode?: string;
}

export default function CustomerDashboard() {
  const { error } = useToast();
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardAndSettings() {
      try {
        const res = await fetch("/api/customer/dashboard");
        if (!res.ok) throw new Error("Failed to load customer metrics");
        const dashboardData = await res.json();
        setData(dashboardData);

        const settingsRes = await fetch("/api/owner/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setSettings(settingsData);
        }
      } catch (err: any) {
        error(err.message || "Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardAndSettings();
  }, [error]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Preparing your dashboard panel...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Portal Homepage</h2>
        <p className="text-sm text-muted-foreground">
          View your daily meal records, outstanding invoice balances, and scan to pay.
        </p>
      </div>

      {/* Grid Status Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Today's meals */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-primary flex-shrink-0">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Today's Meals Status</span>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span className="text-muted-foreground text-xs font-semibold">Lunch:</span>
                <span className={`capitalize text-xs ${
                  data.todayMeal.morningMeal === "none" ? "text-muted-foreground" : "text-primary"
                }`}>
                  {data.todayMeal.morningMeal}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span className="text-muted-foreground text-xs font-semibold">Dinner:</span>
                <span className={`capitalize text-xs ${
                  data.todayMeal.nightMeal === "none" ? "text-muted-foreground" : "text-primary"
                }`}>
                  {data.todayMeal.nightMeal}
                </span>
              </div>
            </div>
            {data.todayMeal.notes && (
              <span className="text-[10px] text-muted-foreground font-semibold block mt-1.5">
                Note: {data.todayMeal.notes}
              </span>
            )}
          </div>
        </div>

        {/* Holiday alert or Leaf */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 flex-shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-grow">
            <span className="text-xs text-muted-foreground font-semibold block">Today's Holiday Status</span>
            {data.todayHoliday ? (
              <div className="mt-1">
                <span className="text-sm font-extrabold text-amber-600 block leading-tight">
                  Mess Closed / On Leave
                </span>
                <span className="text-xs text-muted-foreground block truncate mt-0.5">
                  Reason: {data.todayHoliday.reason}
                </span>
              </div>
            ) : (
              <span className="text-sm font-extrabold text-muted-foreground block mt-1">
                No holidays. Mess open!
              </span>
            )}
          </div>
        </div>

        {/* Outstanding bill */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 flex-shrink-0">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Outstanding Balance Due</span>
            <span className="text-2xl font-bold block text-rose-600 mt-1">₹{data.outstandingAmount}</span>
            <Link href="/customer/bills" className="text-[10px] text-primary hover:underline font-semibold uppercase mt-1 block">
              View Itemized Bills &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Main layouts: left = menu & payments, right = upi qr */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active menu & recent payments */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active menu items */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              <span>Swami Samartha Menu & Pricing</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.menuItems.map((item) => (
                <div key={item._id} className="p-3.5 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm block">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-emerald-600 font-extrabold text-sm">₹{item.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent payments */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-zinc-500" />
              <span>Recent Payments Ledger</span>
            </h3>

            {data.recentPayments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No payment entries found in ledger history.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm font-medium">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Amount Recd.</th>
                      <th className="pb-2">Method</th>
                      <th className="pb-2">Linked Invoice / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentPayments.map((p) => (
                      <tr key={p._id} className="hover:bg-muted/10 transition">
                        <td className="py-3 text-xs">{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td className="py-3 text-xs text-emerald-600 font-bold">₹{p.amount}</td>
                        <td className="py-3 text-xs uppercase">{p.paymentMode}</td>
                        <td className="py-3 text-[11px] text-muted-foreground">
                          {p.billId ? `Linked: ${p.billId.billNumber}` : p.transactionReference || "General Account Credit"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Scan to Pay QR Block */}
        <div className="lg:col-span-4 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between self-start gap-4">
          <div className="space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              <span>UPI Instant Payment</span>
            </h3>
            
            {settings?.upiId ? (
              <div className="space-y-4 text-center">
                <div className="h-48 w-48 bg-white border border-border p-3.5 rounded-2xl mx-auto flex items-center justify-center">
                  {settings.upiQrCode ? (
                    <img src={settings.upiQrCode} alt="UPI QR Scanner" className="h-full w-full object-contain" />
                  ) : (
                    <QrCode className="h-full w-full text-muted-foreground" />
                  )}
                </div>

                <div className="bg-muted p-3.5 rounded-xl border border-border text-left space-y-1">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                    Billed payee:
                  </span>
                  <span className="text-xs font-bold block">{settings.messName}</span>
                  <span className="text-[10px] text-muted-foreground block font-semibold select-all truncate mt-0.5">
                    UPI ID: {settings.upiId}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                Owner has not registered active UPI parameters yet. Payments can be settled in cash directly.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
