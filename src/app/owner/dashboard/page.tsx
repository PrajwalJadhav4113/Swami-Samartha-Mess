"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Utensils,
  Calendar,
  AlertCircle,
  TrendingUp,
  CircleDollarSign,
  CalendarDays,
  PlusCircle,
  Receipt,
  PiggyBank,
  ChevronRight,
  Loader2,
  Sun,
  Moon
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useToast } from "@/components/ui/Toast";

interface Stats {
  totalCustomers: number;
  activeCustomers: number;
  todayMeals: number;
  todayHolidays: number;
  outstandingAmount: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  pendingPaymentsCount: number;
  remainingMorning: number;
  remainingNight: number;
  remainingMorningCustomers?: { _id: string; name: string; mobile: string }[];
  remainingNightCustomers?: { _id: string; name: string; mobile: string }[];
}

interface ChartsData {
  revenueTrend: { month: string; revenue: number }[];
  mealsServedTrend: { day: string; meals: number }[];
  customerGrowth: { month: string; customers: number }[];
  paymentStatus: { name: string; value: number }[];
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444"]; // Paid, Partial, Pending

export default function OwnerDashboard() {
  const { error } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showRemainingLunchList, setShowRemainingLunchList] = useState(false);
  const [showRemainingDinnerList, setShowRemainingDinnerList] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function loadDashboardData() {
      try {
        const res = await fetch("/api/owner/dashboard");
        if (!res.ok) {
          throw new Error("Failed to load dashboard metrics");
        }
        const data = await res.json();
        setStats(data.stats);
        setCharts(data.charts);
      } catch (err: any) {
        error(err.message || "Could not retrieve dashboard statistics");
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [error]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Aggregating visual stats...</p>
      </div>
    );
  }

  // Format currency
  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Title Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Welcome Back, Mess Admin</h2>
        <p className="text-sm text-muted-foreground">
          Here is a detailed breakdown of your Swami Samartha Mess performance today.
        </p>
      </div>

      {/* Grid Statistics Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-primary flex-shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Total Customers</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold">{stats?.totalCustomers}</span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">
                {stats?.activeCustomers} Active
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Today's Meal entries</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold">{stats?.todayMeals}</span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                {stats?.todayHolidays} Holidays
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Sun className="h-5 w-5" />
            </div>
            <div className="flex-grow">
              <span className="text-xs text-muted-foreground font-semibold block">Remaining Lunch</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-amber-600">{stats?.remainingMorning}</span>
                {stats?.remainingMorningCustomers && stats.remainingMorningCustomers.length > 0 && (
                  <button
                    onClick={() => setShowRemainingLunchList(!showRemainingLunchList)}
                    className="text-[10px] text-primary hover:underline font-bold uppercase cursor-pointer ml-2"
                  >
                    {showRemainingLunchList ? "Hide" : "View"}
                  </button>
                )}
              </div>
            </div>
          </div>
          {showRemainingLunchList && stats?.remainingMorningCustomers && stats.remainingMorningCustomers.length > 0 && (
            <div className="mt-3 border-t border-border pt-2 max-h-32 overflow-y-auto space-y-1">
              {stats.remainingMorningCustomers.map((c: any) => (
                <div key={c._id} className="text-[10px] flex justify-between items-center bg-muted/30 px-2 py-1 rounded">
                  <span className="font-semibold truncate max-w-[80px]">{c.name}</span>
                  <span className="text-muted-foreground scale-90">{c.mobile}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <Moon className="h-5 w-5" />
            </div>
            <div className="flex-grow">
              <span className="text-xs text-muted-foreground font-semibold block">Remaining Dinner</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-indigo-600">{stats?.remainingNight}</span>
                {stats?.remainingNightCustomers && stats.remainingNightCustomers.length > 0 && (
                  <button
                    onClick={() => setShowRemainingDinnerList(!showRemainingDinnerList)}
                    className="text-[10px] text-primary hover:underline font-bold uppercase cursor-pointer ml-2"
                  >
                    {showRemainingDinnerList ? "Hide" : "View"}
                  </button>
                )}
              </div>
            </div>
          </div>
          {showRemainingDinnerList && stats?.remainingNightCustomers && stats.remainingNightCustomers.length > 0 && (
            <div className="mt-3 border-t border-border pt-2 max-h-32 overflow-y-auto space-y-1">
              {stats.remainingNightCustomers.map((c: any) => (
                <div key={c._id} className="text-[10px] flex justify-between items-center bg-muted/30 px-2 py-1 rounded">
                  <span className="font-semibold truncate max-w-[80px]">{c.name}</span>
                  <span className="text-muted-foreground scale-90">{c.mobile}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 flex-shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Outstanding Amount</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-rose-600">{formatINR(stats?.outstandingAmount || 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm hover-lift flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 flex-shrink-0">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-semibold block">Monthly Revenue</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-emerald-600">{formatINR(stats?.monthlyRevenue || 0)}</span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                {formatINR(stats?.weeklyRevenue || 0)} wk
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Quick Tasks</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/owner/customers?action=add"
            className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 hover-lift text-center flex flex-col items-center gap-2 group"
          >
            <PlusCircle className="h-5 w-5 text-primary" />
            <span className="font-semibold text-xs">Add Customer</span>
          </Link>
          <Link
            href="/owner/meals"
            className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 hover-lift text-center flex flex-col items-center gap-2 group"
          >
            <Utensils className="h-5 w-5 text-violet-500" />
            <span className="font-semibold text-xs">Record Meals</span>
          </Link>
          <Link
            href="/owner/billing"
            className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 hover-lift text-center flex flex-col items-center gap-2 group"
          >
            <Receipt className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold text-xs">Generate Invoices</span>
          </Link>
          <Link
            href="/owner/payments"
            className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/40 hover-lift text-center flex flex-col items-center gap-2 group"
          >
            <PiggyBank className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-xs">Record Payment</span>
          </Link>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      {mounted && charts && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Revenue Trend Area Chart */}
          <div className="lg:col-span-8 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <div>
              <h4 className="font-bold text-sm">Monthly Revenue Trend</h4>
              <span className="text-xs text-muted-foreground">Generated invoices totals over the last 6 months</span>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.revenueTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Status Pie Chart */}
          <div className="lg:col-span-4 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm">Invoice Payment Status</h4>
              <span className="text-xs text-muted-foreground">Distribution of billing payments</span>
            </div>
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.paymentStatus.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {charts.paymentStatus.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {charts.paymentStatus.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span>{entry.value} bills</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meals Served Bar Chart */}
          <div className="lg:col-span-6 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <div>
              <h4 className="font-bold text-sm">Meals Served (Last 7 Days)</h4>
              <span className="text-xs text-muted-foreground">Tiffins consumed daily</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.mealsServedTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="meals" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Customer growth Line Chart */}
          <div className="lg:col-span-6 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col gap-4">
            <div>
              <h4 className="font-bold text-sm">Customer Growth Trend</h4>
              <span className="text-xs text-muted-foreground">Cumulative client directory size</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="customers" stroke="#10b981" strokeWidth={2} dot={{ strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
