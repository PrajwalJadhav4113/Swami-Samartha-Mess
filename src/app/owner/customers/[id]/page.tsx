"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Receipt,
  FileText,
  Clock,
  Edit2,
  Trash2,
  CalendarDays,
  Utensils,
  PlusCircle,
  TrendingUp,
  Loader2,
  Save
} from "lucide-react";
import Link from "next/link";

interface CustomerDetail {
  _id: string;
  name: string;
  photo?: string;
  mobile: string;
  address: string;
  username: string;
  status: "pending" | "active" | "inactive" | "rejected";
  joiningDate: string;
  notes?: string;
  defaultRate?: number;
  fixedDiscount?: number;
}

interface MealRecord {
  _id: string;
  date: string;
  morningMeal: "none" | "half" | "full";
  nightMeal: "none" | "half" | "full";
  notes?: string;
}

interface ExtraMealItem {
  _id: string;
  date: string;
  name: string;
  price: number;
  quantity: number;
}

interface BillData {
  _id: string;
  billNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  finalTotal: number;
  amountPaid: number;
  paymentStatus: "pending" | "paid" | "partially_paid";
  createdAt: string;
}

interface PaymentData {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionReference?: string;
  billId?: { billNumber: string };
}

interface HolidayData {
  _id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export default function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<"info" | "meals" | "bills" | "payments" | "holidays">("info");
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  // Tab Data states
  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraMealItem[]>([]);
  const [bills, setBills] = useState<BillData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [holidays, setHolidays] = useState<HolidayData[]>([]);

  // Edit fields states
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<"pending" | "active" | "inactive" | "rejected">("active");
  const [editDefaultRate, setEditDefaultRate] = useState<number | "">("");
  const [editFixedDiscount, setEditFixedDiscount] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  // Add holiday fields
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

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
        // Refresh bills list
        const billsRes = await fetch(`/api/owner/billing?customerId=${id}`);
        if (billsRes.ok) {
          const billsData = await billsRes.json();
          setBills(billsData);
        }
        // Also refresh payments if any were recorded/deleted
        const paymentsRes = await fetch(`/api/owner/payments?customerId=${id}`);
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(paymentsData);
        }
      } else {
        throw new Error();
      }
    } catch (err) {
      error("Failed to update payment status");
    } finally {
      setUpdatingBillId(null);
    }
  };

  const fetchCustomerData = async () => {
    try {
      const res = await fetch(`/api/owner/customers/${id}`);
      if (!res.ok) throw new Error("Customer profile not found");
      const data = await res.json();
      setCustomer(data);
      
      // Initialize edit fields
      setEditName(data.name);
      setEditMobile(data.mobile);
      setEditAddress(data.address);
      setEditUsername(data.username);
      setEditNotes(data.notes || "");
      setEditStatus(data.status);
      setEditDefaultRate(data.defaultRate || "");
      setEditFixedDiscount(data.fixedDiscount || 0);
    } catch (err: any) {
      error(err.message || "Failed to load customer profile");
      router.push("/owner/customers");
    }
  };

  const fetchTabHistory = async () => {
    try {
      // 1. Fetch meals history
      const mealsRes = await fetch(`/api/owner/customers/${id}/meals`);
      if (mealsRes.ok) {
        const mealsData = await mealsRes.json();
        setMealRecords(mealsData.mealRecords);
        setExtraItems(mealsData.extraItems);
      }

      // 2. Fetch bills
      const billsRes = await fetch(`/api/owner/billing?customerId=${id}`);
      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData);
      }

      // 3. Fetch payments
      const paymentsRes = await fetch(`/api/owner/payments?customerId=${id}`);
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
      }

      // 4. Fetch holidays
      const holidaysRes = await fetch("/api/owner/holidays");
      if (holidaysRes.ok) {
        const holidaysData = await holidaysRes.json();
        // filter for this specific customer
        const filtered = holidaysData.filter((h: any) => h.customerId && h.customerId._id === id);
        setHolidays(filtered);
      }
    } catch (err) {
      console.error("Error loading history tabs:", err);
    }
  };

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await fetchCustomerData();
      await fetchTabHistory();
      setLoading(false);
    }
    loadAll();
  }, [id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const payload: any = {
        name: editName,
        mobile: editMobile,
        address: editAddress,
        username: editUsername,
        notes: editNotes,
        status: editStatus,
      };
      if (editPassword) payload.password = editPassword;

      const res = await fetch(`/api/owner/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Update Pricing
      await fetch(`/api/owner/customers/${id}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRate: editDefaultRate !== "" ? Number(editDefaultRate) : null,
          fixedDiscount: Number(editFixedDiscount),
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      success("Profile updated successfully!");
      setCustomer(data);
      setEditPassword("");
    } catch (err: any) {
      error(err.message || "Error updating profile");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!confirm("Are you sure you want to delete this customer? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/owner/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        success("Customer profile deleted successfully");
        router.push("/owner/customers");
      } else {
        throw new Error("Failed to delete customer");
      }
    } catch (err: any) {
      error(err.message || "Could not delete customer");
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayStart || !holidayEnd || !holidayReason) {
      error("Please fill in holiday dates and reason");
      return;
    }
    setAddingHoliday(true);
    try {
      const res = await fetch("/api/owner/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: id,
          startDate: holidayStart,
          endDate: holidayEnd,
          reason: holidayReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add holiday");
      }

      success("Holiday successfully logged!");
      setHolidayStart("");
      setHolidayEnd("");
      setHolidayReason("");
      
      // refresh holidays tab
      const holidaysRes = await fetch("/api/owner/holidays");
      if (holidaysRes.ok) {
        const holidaysData = await holidaysRes.json();
        const filtered = holidaysData.filter((h: any) => h.customerId && h.customerId._id === id);
        setHolidays(filtered);
      }
    } catch (err: any) {
      error(err.message || "Error recording holiday");
    } finally {
      setAddingHoliday(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Retrieving customer portfolio...</p>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Portfolio Info Header Card */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-2xl font-bold text-zinc-600 dark:text-zinc-300 flex-shrink-0 shadow-inner">
            {customer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">{customer.name}</h2>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  customer.status === "active"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
                }`}
              >
                {customer.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-semibold mt-1">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span>{customer.mobile}</span>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{customer.address}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Joined: {new Date(customer.joiningDate).toLocaleDateString()}</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDeleteCustomer}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-600 dark:border-rose-950/40 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold rounded-xl transition cursor-pointer self-start md:self-auto"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Profile</span>
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-px">
        {(["info", "meals", "bills", "payments", "holidays"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "info" && "Profile Details"}
            {tab === "meals" && "Meal History"}
            {tab === "bills" && "Invoices"}
            {tab === "payments" && "Payment History"}
            {tab === "holidays" && "Registered Leaves"}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {/* Profile details tab */}
        {activeTab === "info" && (
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm max-w-2xl">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>Edit Account Information</span>
            </h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Mobile
                  </label>
                  <input
                    type="text"
                    required
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Address
                </label>
                <textarea
                  required
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Reset Password
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep same"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-muted border border-transparent rounded-lg focus:outline-none focus:bg-card text-sm font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Custom Thali Rate (₹)
                  </label>
                  <input
                    type="number"
                    value={editDefaultRate}
                    onChange={(e) => setEditDefaultRate(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Leave blank for global default"
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Fixed Monthly Discount (₹)
                  </label>
                  <input
                    type="number"
                    value={editFixedDiscount}
                    onChange={(e) => setEditFixedDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updating}
                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-sm px-4 py-2 rounded-xl hover-lift shadow transition mt-2 cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Updates</span>
              </button>
            </form>
          </div>
        )}

        {/* Meal History Tab */}
        {activeTab === "meals" && (
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <Utensils className="h-5 w-5 text-violet-500" />
              <span>Meal Consumption Log (Last 60 records)</span>
            </h3>
            
            {mealRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No meal entries logged for this customer yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Morning Meal</th>
                      <th className="pb-3">Night Meal</th>
                      <th className="pb-3">Extra Items</th>
                      <th className="pb-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {mealRecords.map((m) => {
                      const dayExtras = extraItems.filter((e) => e.date.split("T")[0] === m.date.split("T")[0]);
                      return (
                        <tr key={m._id} className="hover:bg-muted/40 transition">
                          <td className="py-3.5">{new Date(m.date).toLocaleDateString()}</td>
                          <td className="py-3.5 capitalize">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              m.morningMeal === "full" ? "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400" :
                              m.morningMeal === "half" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" :
                              "text-muted-foreground"
                            }`}>
                              {m.morningMeal}
                            </span>
                          </td>
                          <td className="py-3.5 capitalize">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              m.nightMeal === "full" ? "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400" :
                              m.nightMeal === "half" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" :
                              "text-muted-foreground"
                            }`}>
                              {m.nightMeal}
                            </span>
                          </td>
                          <td className="py-3.5 text-xs">
                            {dayExtras.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              dayExtras.map((e) => (
                                <span key={e._id} className="inline-block bg-muted px-1.5 py-0.5 rounded border border-border mr-1 mb-1">
                                  {e.name} ({e.quantity})
                                </span>
                              ))
                            )}
                          </td>
                          <td className="py-3.5 text-xs text-muted-foreground">{m.notes || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bills/Invoices Tab */}
        {activeTab === "bills" && (
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-500" />
                <span>Generated Monthly Invoices</span>
              </h3>
              <Link
                href={`/owner/billing?customerId=${id}`}
                className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Generate Bill</span>
              </Link>
            </div>

            {bills.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No bills generated for this customer yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                      <th className="pb-3">Bill No.</th>
                      <th className="pb-3">Billing Period</th>
                      <th className="pb-3">Final Total</th>
                      <th className="pb-3">Outstanding</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {bills.map((b) => (
                      <tr key={b._id} className="hover:bg-muted/40 transition">
                        <td className="py-3.5 font-bold">{b.billNumber}</td>
                        <td className="py-3.5 text-xs text-muted-foreground">
                          {new Date(b.billingPeriodStart).toLocaleDateString()} - {new Date(b.billingPeriodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-3.5">₹{b.finalTotal}</td>
                        <td className="py-3.5 text-rose-600">₹{b.finalTotal - b.amountPaid}</td>
                        <td className="py-3.5 capitalize">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" :
                            b.paymentStatus === "partially_paid" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                            "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}>
                            {b.paymentStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 flex items-center gap-3">
                          <Link
                            href={`/owner/billing/${b._id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>View Bill</span>
                          </Link>
                          
                          {b.paymentStatus !== "paid" ? (
                            <button
                              disabled={updatingBillId === b._id}
                              onClick={() => handleUpdateBillStatus(b._id, "paid")}
                              className="text-[10px] bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1 rounded-lg border border-emerald-200/50 transition cursor-pointer"
                            >
                              {updatingBillId === b._id ? "..." : "Settle"}
                            </button>
                          ) : (
                            <button
                              disabled={updatingBillId === b._id}
                              onClick={() => handleUpdateBillStatus(b._id, "pending")}
                              className="text-[10px] bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold px-2 py-1 rounded-lg border border-amber-200/50 transition cursor-pointer"
                            >
                              {updatingBillId === b._id ? "..." : "Reset"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payments ledger Tab */}
        {activeTab === "payments" && (
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span>Recorded Payment History</span>
              </h3>
              <Link
                href={`/owner/payments?customerId=${id}`}
                className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Log Payment</span>
              </Link>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No payment entries found for this customer.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Mode</th>
                      <th className="pb-3">Reference / Bill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {payments.map((p) => (
                      <tr key={p._id} className="hover:bg-muted/40 transition">
                        <td className="py-3.5">{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td className="py-3.5 text-emerald-600 font-bold">₹{p.amount}</td>
                        <td className="py-3.5 uppercase text-xs">{p.paymentMode.replace("_", " ")}</td>
                        <td className="py-3.5 text-xs text-muted-foreground">
                          {p.billId ? (
                            <span className="font-semibold text-foreground">Linked: {p.billId.billNumber}</span>
                          ) : (
                            p.transactionReference || "General Credit"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Holidays/Leaves Tab */}
        {activeTab === "holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* List holidays */}
            <div className="lg:col-span-7 bg-card border border-border p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-amber-500" />
                <span>Marked Holidays / Leaves</span>
              </h3>
              
              {holidays.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No individual leaves registered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase">
                        <th className="pb-3">Start Date</th>
                        <th className="pb-3">End Date</th>
                        <th className="pb-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-medium">
                      {holidays.map((h) => (
                        <tr key={h._id} className="hover:bg-muted/40 transition">
                          <td className="py-3">{new Date(h.startDate).toLocaleDateString()}</td>
                          <td className="py-3">{new Date(h.endDate).toLocaleDateString()}</td>
                          <td className="py-3 text-xs text-muted-foreground">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Book Holiday Form */}
            <div className="lg:col-span-5 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm mb-1">Book Customer Leave</h4>
                <p className="text-[11px] text-muted-foreground leading-normal mb-4">
                  Register a leave period. Basic meals inside this date range will automatically be excluded from invoice calculations.
                </p>

                <form onSubmit={handleAddHoliday} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={holidayStart}
                      onChange={(e) => setHolidayStart(e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      End Date (Inclusive)
                    </label>
                    <input
                      type="date"
                      required
                      value={holidayEnd}
                      onChange={(e) => setHolidayEnd(e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                      Reason
                    </label>
                    <input
                      type="text"
                      required
                      value={holidayReason}
                      onChange={(e) => setHolidayReason(e.target.value)}
                      placeholder="e.g. Out of town"
                      className="w-full px-3 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-xs font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={addingHoliday}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-semibold text-xs py-2 rounded-lg hover-lift shadow transition flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                  >
                    {addingHoliday ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    <span>Book Leave</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
