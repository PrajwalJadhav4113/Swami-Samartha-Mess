"use client";

import React, { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useToast } from "@/components/ui/Toast";
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  CircleDollarSign,
  UserCheck,
  LogOut,
  Moon,
  Sun,
  Menu as HamburgerMenu,
  X,
  User,
  Loader2
} from "lucide-react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const CUSTOMER_SIDEBAR_ITEMS: SidebarItem[] = [
  { name: "Portal Home", href: "/customer/dashboard", icon: LayoutDashboard },
  { name: "Meals Calendar", href: "/customer/meals", icon: CalendarDays },
  { name: "My Invoices", href: "/customer/bills", icon: Receipt },
  { name: "Payment History", href: "/customer/payments", icon: CircleDollarSign },
  { name: "My Settings", href: "/customer/profile", icon: UserCheck },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { success, error } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<{ name: string; username: string } | null>(null);
  const [messName, setMessName] = useState("Swami Samartha Mess");

  useEffect(() => {
    async function checkAuthAndLoadSettings() {
      try {
        // 1. Verify customer session
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();
        
        if (!authRes.ok || !authData.authenticated || authData.user.role !== "customer") {
          router.push("/login?role=customer");
          return;
        }

        setCustomerInfo(authData.user);

        // 2. Fetch business settings
        const settingsRes = await fetch("/api/owner/settings"); // public setting readable
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData && settingsData.messName) {
            setMessName(settingsData.messName);
          }
        }
      } catch (err) {
        console.error("Customer Portal Init error:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadSettings();
  }, [router]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        success("Logged out successfully");
        router.push("/login?role=customer");
      } else {
        throw new Error("Logout failed");
      }
    } catch (err: any) {
      error(err.message || "Failed to log out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Verifying secure customer session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-zinc-950/40 dark:bg-zinc-950/60 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 md:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* logo */}
          <div className="h-16 px-6 border-b border-border flex items-center justify-between">
            <Link href="/customer/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">
                SS
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-sm block leading-tight truncate">{messName}</span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Customer Portal
                </span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* navigation */}
          <nav className="p-4 space-y-1">
            {CUSTOMER_SIDEBAR_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? "bg-primary text-white shadow-sm glow-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer credentials and logout */}
        <div className="p-4 border-t border-border space-y-2">
          {customerInfo && (
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-muted/40">
              <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                <User className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-xs block truncate">{customerInfo.name}</span>
                <span className="text-[10px] text-muted-foreground block truncate">@{customerInfo.username}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Content panel */}
      <div className="flex-grow flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/65 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
              aria-label="Open Sidebar"
            >
              <HamburgerMenu className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-base md:text-lg tracking-tight">
              {CUSTOMER_SIDEBAR_ITEMS.find((item) => pathname.startsWith(item.href))?.name || "Customer Portal"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </button>
          </div>
        </header>

        <main className="flex-grow p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
