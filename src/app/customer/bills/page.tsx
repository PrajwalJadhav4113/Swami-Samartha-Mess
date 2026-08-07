"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Receipt, FileText, ArrowRight, Loader2, IndianRupee } from "lucide-react";
import Link from "next/link";

interface BillItem {
  _id: string;
  billNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  finalTotal: number;
  amountPaid: number;
  paymentStatus: "pending" | "paid" | "partially_paid";
  createdAt: string;
}

export default function CustomerBillsList() {
  const { error } = useToast();

  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomerBills = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/bills");
      if (!res.ok) throw new Error("Could not retrieve invoices");
      const data = await res.json();
      setBills(data);
    } catch (err: any) {
      error(err.message || "Failed to load invoices list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerBills();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Invoices</h2>
        <p className="text-sm text-muted-foreground">
          Review monthly itemized bills, amounts outstanding, and scan UPI options.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Retrieving invoices...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <Receipt className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Invoices Found</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Excellent! You do not have any bills recorded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bills.map((bill) => {
            const outstanding = bill.finalTotal - bill.amountPaid;
            
            return (
              <div
                key={bill._id}
                className="bg-card border border-border rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:border-primary/20 hover-lift transition"
              >
                <div className="space-y-3 min-w-0 flex-grow">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-base md:text-lg block">{bill.billNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      bill.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                      bill.paymentStatus === "partially_paid" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                    }`}>
                      {bill.paymentStatus.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-semibold">
                    <span>
                      Period: {new Date(bill.billingPeriodStart).toLocaleDateString()} - {new Date(bill.billingPeriodEnd).toLocaleDateString()}
                    </span>
                    <span>
                      Generated: {new Date(bill.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-sm pt-1.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Total Bill</span>
                      <span className="text-sm font-extrabold block">₹{bill.finalTotal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Amount Paid</span>
                      <span className="text-sm font-extrabold text-emerald-600 block">₹{bill.amountPaid}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Due Balance</span>
                      <span className={`text-sm font-extrabold block ${outstanding > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                        ₹{outstanding}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 self-start md:self-auto">
                  <Link
                    href={`/customer/bills/${bill._id}`}
                    className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover-lift shadow transition cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Open Invoice</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
