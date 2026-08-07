"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { CircleDollarSign, Loader2, Link as LinkIcon, DollarSign } from "lucide-react";
import Link from "next/link";

interface PaymentItem {
  _id: string;
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

export default function CustomerPaymentsHistory() {
  const { error } = useToast();

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customer/payments");
      if (!res.ok) throw new Error("Could not retrieve payments ledger");
      const data = await res.json();
      setPayments(data);
    } catch (err: any) {
      error(err.message || "Failed to load payments history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payment History</h2>
        <p className="text-sm text-muted-foreground">
          Audit trail of payments credited to your account balances.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading payment logs...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <CircleDollarSign className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Payments Recorded</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            No payments have been registered in the database for your account yet.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-bold uppercase">
                  <th className="px-6 py-4">Receipt Date</th>
                  <th className="px-6 py-4">Amount Paid</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Linked Invoice / Ref</th>
                  <th className="px-6 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/10 transition">
                    <td className="px-6 py-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-emerald-600 font-extrabold">₹{p.amount}</td>
                    <td className="px-6 py-4 uppercase text-xs">
                      <span className="bg-muted px-2.5 py-1 rounded-md border border-border">
                        {p.paymentMode.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold">
                      {p.billId ? (
                        <Link
                          href={`/customer/bills/${p.billId._id}`}
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
        </div>
      )}
    </div>
  );
}
