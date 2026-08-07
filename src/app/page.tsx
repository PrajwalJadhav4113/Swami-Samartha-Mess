"use client";

import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeProvider";
import { UtensilsCrossed, ShieldAlert, Award, Calendar, CreditCard, ChevronRight, Moon, Sun, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold glow-primary">
              SS
            </div>
            <div>
              <span className="font-bold text-lg leading-tight block">Swami Samartha</span>
              <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Tiffin & Mess</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex items-center justify-center py-12 px-6">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7 flex flex-col items-start text-left gap-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold">
              <Award className="h-3.5 w-3.5" />
              <span>The Smartest Mess Management System</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
              Manage your <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Mess Ledger</span> seamlessly.
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg font-normal leading-relaxed">
              No subscription templates here. Only pay for the meals actually consumed. Automate daily listings, holiday settings, dynamic invoice calculations, and payment tracking.
            </p>
            
            <div className="flex flex-wrap gap-4 mt-2">
              <Link
                href="/login?role=owner"
                className="group inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white font-semibold px-6 py-3.5 rounded-xl hover-lift shadow-md transition"
              >
                <span>Owner Portal</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login?role=customer"
                className="inline-flex items-center gap-2 border border-border bg-card hover:bg-muted font-semibold px-6 py-3.5 rounded-xl hover-lift transition"
              >
                <span>Customer Login</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="md:col-span-5 relative w-full aspect-square max-w-md mx-auto">
            {/* Visual mock card representing dashboard */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-violet-500 to-indigo-500 blur-2xl opacity-10 animate-pulse pointer-events-none" />
            <div className="relative h-full w-full bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between hover-lift">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-primary">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Swami Samartha Mess</h3>
                    <span className="text-xs text-muted-foreground">Pune, Maharashtra</span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  Active
                </span>
              </div>

              <div className="space-y-4 my-6">
                <div>
                  <span className="text-xs text-muted-foreground block">Customer Balance Ledger</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl font-extrabold">₹3,420</span>
                    <span className="text-xs text-muted-foreground">Pending</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <span className="text-[11px] text-muted-foreground block">Meals Consumed</span>
                    <span className="text-base font-bold mt-0.5 block">24 full / 8 half</span>
                  </div>
                  <div className="p-3 bg-muted rounded-xl">
                    <span className="text-[11px] text-muted-foreground block">Holidays Booked</span>
                    <span className="text-base font-bold mt-0.5 block">5 Days</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 flex justify-between items-center text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Cycle: Monthly</span>
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>UPI, Cash, Bank</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="bg-muted/40 border-t border-border py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Built to Automate Mess Workflows</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover-lift">
              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-primary flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">Fast Daily Recorder</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Log daily tiffin counts and additional item list (Chapati, Bhaji, Varan-Bhat, Curd) for all customers inside a fast, grid-based interface with auto-save.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover-lift">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">Dynamic Billing Engine</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Calculates charges automatically based on actual meals consumed. Automatically skips days marked as holidays from billing cycle balances.
              </p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover-lift">
              <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">Detailed Reports & Invoice PDFs</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Print or download detailed PDF invoices showing daily consumed logs. View monthly sales graphs and collections in clean dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Swami Samartha Tiffin & Mess Services. All rights reserved.</p>
      </footer>
    </div>
  );
}
