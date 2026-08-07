"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { Calendar, TrendingUp, CircleDollarSign, AlertCircle, FileSpreadsheet, Loader2, Award } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SummaryMetrics {
  totalRevenue: number;
  totalCollected: number;
  netOutstanding: number;
}

interface RevenueLog {
  billNumber: string;
  customerName: string;
  amount: number;
  date: string;
  status: string;
}

interface CollectionLog {
  customerName: string;
  amount: number;
  date: string;
  mode: string;
  reference: string;
}

interface OutstandingClient {
  customerName: string;
  mobile: string;
  outstanding: number;
}

interface PopularItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface ReportData {
  summary: SummaryMetrics;
  revenueList: RevenueLog[];
  collectionList: CollectionLog[];
  outstandingPayments: OutstandingClient[];
  popularItems: PopularItem[];
}

export default function ReportsAnalytics() {
  const { error, success } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"revenue" | "collections" | "outstanding" | "popular">("revenue");

  // Default dates to current month range
  useEffect(() => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    setStartDate(first);
    setEndDate(last);
  }, []);

  const fetchReports = async (start: string, end: string) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/reports?startDate=${start}&endDate=${end}`);
      if (!res.ok) throw new Error("Could not compile reports logs");
      const reportData = await res.json();
      setData(reportData);
    } catch (err: any) {
      error(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(startDate, endDate);
  }, [startDate, endDate]);

  // Convert array of objects to CSV download
  const handleExportCSV = (type: "revenue" | "collections" | "outstanding" | "menu") => {
    if (!data) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = "";

    if (type === "revenue") {
      csvContent += "Bill Number,Customer Name,Date,Amount (INR),Payment Status\r\n";
      data.revenueList.forEach((r) => {
        csvContent += `"${r.billNumber}","${r.customerName}","${new Date(r.date).toLocaleDateString()}","${r.amount}","${r.status.toUpperCase()}"\r\n`;
      });
      filename = `revenue-report-${startDate}-to-${endDate}.csv`;
    } else if (type === "collections") {
      csvContent += "Customer Name,Payment Date,Payment Mode,Reference ID,Amount (INR)\r\n";
      data.collectionList.forEach((c) => {
        csvContent += `"${c.customerName}","${new Date(c.date).toLocaleDateString()}","${c.mode.toUpperCase()}","${c.reference}","${c.amount}"\r\n`;
      });
      filename = `collections-report-${startDate}-to-${endDate}.csv`;
    } else if (type === "outstanding") {
      csvContent += "Customer Name,Contact Mobile,Outstanding Balance Due (INR)\r\n";
      data.outstandingPayments.forEach((o) => {
        csvContent += `"${o.customerName}","${o.mobile}","${o.outstanding}"\r\n`;
      });
      filename = `outstanding-balances-${new Date().toISOString().split("T")[0]}.csv`;
    } else if (type === "menu") {
      csvContent += "Menu Item Name,Quantity Consumed,Total Revenue (INR)\r\n";
      data.popularItems.forEach((p) => {
        csvContent += `"${p.name}","${p.quantity}","${p.revenue}"\r\n`;
      });
      filename = `popular-items-${startDate}-to-${endDate}.csv`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    success(`Successfully exported "${filename}"`, "CSV Spreadsheet Exported");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title & Date pickers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Monitor financials, collect payment summaries, and track popular menu configurations.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-card border border-border p-1.5 rounded-xl shadow-inner">
          <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
          />
          <span className="text-xs text-muted-foreground font-extrabold px-1">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Aggregate metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-primary flex-shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Total Sales Revenue</span>
            <span className="text-2xl font-bold block mt-0.5">₹{data?.summary.totalRevenue || 0}</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Payments Collected</span>
            <span className="text-2xl font-bold text-emerald-600 block mt-0.5">₹{data?.summary.totalCollected || 0}</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 flex-shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Net Outstanding Debt</span>
            <span className="text-2xl font-bold text-rose-600 block mt-0.5">₹{data?.summary.netOutstanding || 0}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Compiling reports metrics...</p>
        </div>
      ) : !data ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sub Navigation Left side */}
          <div className="lg:col-span-3 space-y-1">
            {(["revenue", "collections", "outstanding", "popular"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center justify-between cursor-pointer ${
                  activeSubTab === tab
                    ? "bg-primary text-white shadow-sm glow-primary"
                    : "bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>
                  {tab === "revenue" && "Revenue Logs"}
                  {tab === "collections" && "Collections Ledger"}
                  {tab === "outstanding" && "Outstanding Debts"}
                  {tab === "popular" && "Popular Menu Items"}
                </span>
              </button>
            ))}
          </div>

          {/* Detailed Lists Right Side */}
          <div className="lg:col-span-9 bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            {/* Tab header action */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h4 className="font-bold text-base capitalize">
                  {activeSubTab === "popular" ? "Menu Popularity Index" : `${activeSubTab} Report`}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {activeSubTab === "outstanding" ? "Current all-time balances outstanding" : `Showing records from ${startDate} to ${endDate}`}
                </span>
              </div>
              <button
                onClick={() => handleExportCSV(activeSubTab === "popular" ? "menu" : activeSubTab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Export Excel/CSV</span>
              </button>
            </div>

            {/* Content Switcher */}
            <div>
              {/* Revenue logs list */}
              {activeSubTab === "revenue" && (
                data.revenueList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">No invoices generated within selected range.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm font-medium">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                          <th className="pb-3">Bill Number</th>
                          <th className="pb-3">Customer Name</th>
                          <th className="pb-3">Generated Date</th>
                          <th className="pb-3">Amount</th>
                          <th className="pb-3">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.revenueList.map((r, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-3 font-bold">{r.billNumber}</td>
                            <td className="py-3">{r.customerName}</td>
                            <td className="py-3 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                            <td className="py-3">₹{r.amount}</td>
                            <td className="py-3">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                r.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                                r.status === "partially_paid" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                                "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Collections ledger list */}
              {activeSubTab === "collections" && (
                data.collectionList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">No transaction entries found within selected range.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm font-medium">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                          <th className="pb-3">Customer Name</th>
                          <th className="pb-3">Payment Date</th>
                          <th className="pb-3">Mode</th>
                          <th className="pb-3">Reference Code</th>
                          <th className="pb-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.collectionList.map((c, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-3 font-bold">{c.customerName}</td>
                            <td className="py-3 text-muted-foreground">{new Date(c.date).toLocaleDateString()}</td>
                            <td className="py-3 uppercase text-xs">
                              <span className="bg-muted px-2 py-0.5 rounded border border-border">
                                {c.mode.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 text-xs font-mono">{c.reference || "-"}</td>
                            <td className="py-3 text-emerald-600 font-extrabold">₹{c.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Outstanding debts list */}
              {activeSubTab === "outstanding" && (
                data.outstandingPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">Excellent! Zero outstanding client balances.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm font-medium">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                          <th className="pb-3">Customer Name</th>
                          <th className="pb-3">Contact Mobile</th>
                          <th className="pb-3 text-right">Balance Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.outstandingPayments.map((o, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-3 font-bold">{o.customerName}</td>
                            <td className="py-3 text-muted-foreground">{o.mobile}</td>
                            <td className="py-3 text-right text-rose-600 font-extrabold">₹{o.outstanding}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Popular items charts */}
              {activeSubTab === "popular" && (
                data.popularItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-10 text-center">No meals recorded within dates to calculate popularity.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Visual Bar chart */}
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.popularItems}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                          <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              fontSize: 11,
                            }}
                          />
                          <Bar dataKey="quantity" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Breakdown table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs md:text-sm font-medium">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-bold uppercase text-[10px]">
                            <th className="pb-3">Menu Item</th>
                            <th className="pb-3">Total Quantity Consumed</th>
                            <th className="pb-3 text-right">Tally Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {data.popularItems.map((p, idx) => (
                            <tr key={idx} className="hover:bg-muted/10">
                              <td className="py-3 font-bold flex items-center gap-1.5">
                                {idx === 0 ? <Award className="h-4 w-4 text-amber-500 flex-shrink-0" /> : null}
                                <span>{p.name}</span>
                              </td>
                              <td className="py-3">{p.quantity}</td>
                              <td className="py-3 text-right text-emerald-600 font-extrabold">₹{p.revenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
