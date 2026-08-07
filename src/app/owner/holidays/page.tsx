"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { CalendarDays, PlusCircle, Trash2, Loader2, AlertCircle, Users } from "lucide-react";

interface CustomerSummary {
  _id: string;
  name: string;
}

interface HolidayItem {
  _id: string;
  customerId?: CustomerSummary;
  startDate: string;
  endDate: string;
  reason: string;
}

export default function HolidaysManager() {
  const { success, error } = useToast();

  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [customerId, setCustomerId] = useState(""); // empty means All Customers
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/holidays");
      if (!res.ok) throw new Error("Failed to fetch holidays");
      const data = await res.json();
      setHolidays(data);
    } catch (err: any) {
      error(err.message || "Failed to load holidays");
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
      console.error("Error loading customer directory:", err);
    }
  };

  useEffect(() => {
    fetchHolidays();
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      error("Please fill in start date, end date, and reason");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      error("Start date cannot be after End date");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          startDate,
          endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save holiday");

      success("Holiday registered successfully!");
      
      // Reset form
      setCustomerId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      
      fetchHolidays();
    } catch (err: any) {
      error(err.message || "Error logging holiday");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, reasonText: string) => {
    if (!confirm(`Remove holiday: "${reasonText}"?`)) return;
    try {
      const res = await fetch(`/api/owner/holidays/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove holiday");
      }
      success("Holiday deleted successfully");
      fetchHolidays();
    } catch (err: any) {
      error(err.message || "Error deleting holiday");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Holiday Management</h2>
        <p className="text-sm text-muted-foreground">
          Register mess closures or individual customer leaves. Sub-period dates are automatically bypassed from billing calculations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Register Holiday Form Card */}
        <div className="lg:col-span-5 bg-card border border-border p-6 rounded-2xl shadow-sm self-start">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <span>Mark Tiffin Holiday</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Target Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold cursor-pointer"
              >
                <option value="">All Customers (Shop Closed)</option>
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
                  End Date (Inclusive)
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

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Reason / Holiday Label
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Diwali Break, Sick Leave"
                className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-3.5 rounded-xl hover-lift shadow-md transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>Save Holiday</span>
            </button>
          </form>
        </div>

        {/* Registered Holidays List */}
        <div className="lg:col-span-7 bg-card border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-500" />
            <span>Marked Holidays List</span>
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading holiday logs...</p>
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No active holidays logged in the system.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {holidays.map((h) => (
                    <tr key={h._id} className="hover:bg-muted/30 transition">
                      <td className="py-3.5 text-xs">
                        {h.customerId ? (
                          <span className="font-bold flex items-center gap-1">
                            <Users className="h-3 w-3 text-zinc-500" />
                            {h.customerId.name}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-extrabold uppercase text-[10px]">
                            Shop Closed (Global)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-xs text-muted-foreground">
                        {new Date(h.startDate).toLocaleDateString()} - {new Date(h.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-xs max-w-xs truncate">{h.reason}</td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteHoliday(h._id, h.reason)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer"
                          title="Delete Holiday"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
