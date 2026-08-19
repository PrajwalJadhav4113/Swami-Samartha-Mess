"use client";

import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeProvider";
import { UtensilsCrossed, ShieldAlert, Award, Calendar, CreditCard, ChevronRight, Moon, Sun, ArrowRight, Star } from "lucide-react";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col justify-between bg-background text-foreground transition-colors duration-300">
      {/* Background soft lighting blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 w-full bg-background/70 backdrop-blur-md border-b border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center text-white font-extrabold shadow-lg shadow-primary/20 text-lg">
              SS
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight leading-tight block">Swami Samartha</span>
              <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-widest mt-0.5">Tiffin & Mess Services</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition duration-200 cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex items-center justify-center py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center w-full">
          {/* Hero Left Content */}
          <div className="lg:col-span-6 flex flex-col items-start gap-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 animate-fade-in">
              <Award className="h-4 w-4" />
              <span>Smartest Mess Management System</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-balance">
                Manage your <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">Mess Ledger</span> seamlessly.
              </h1>
              <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-xl">
                No subscription templates here. Only pay for the meals actually consumed. Automate daily listings, holiday settings, dynamic invoice calculations, and payment tracking.
              </p>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link
                href="/login?role=owner"
                className="group inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-bold px-8 py-4 rounded-2xl hover-lift shadow-lg shadow-primary/20 transition-all duration-200"
              >
                <span>Owner Portal</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login?role=customer"
                className="inline-flex items-center justify-center gap-2 border border-border bg-card hover:bg-muted font-bold px-8 py-4 rounded-2xl hover-lift transition-all duration-200"
              >
                <span>Customer Login</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center gap-6 border-t border-border/60 pt-8 w-full">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    U{i}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4.5 w-4.5 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-bold text-muted-foreground block mt-1">Trusted by 100+ local Pune mess users</span>
              </div>
            </div>
          </div>

          {/* Hero Right Visual Column */}
          <div className="lg:col-span-6 relative w-full flex items-center justify-center">
            {/* Background glowing decorations */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-amber-500 blur-3xl opacity-15 rounded-full pointer-events-none" />
            
            {/* Visual Container */}
            <div className="relative w-full max-w-lg aspect-square bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl p-4 flex flex-col justify-between hover-lift group transition-all duration-300">
              
              {/* Premium Image Header */}
              <div className="relative flex-grow rounded-2xl overflow-hidden mb-4 border border-border/40 shadow-inner">
                <img 
                  src="/hero_thali.jpg" 
                  alt="Delicious Indian Home Cooked Meal Thali" 
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                />
                
                {/* Floating Badges */}
                <span className="absolute top-4 left-4 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-background/90 backdrop-blur-md border border-border text-foreground shadow flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                  <span>Fresh Home Food</span>
                </span>
                
                <span className="absolute top-4 right-4 text-xs font-extrabold px-3 py-1.5 rounded-xl bg-emerald-500 text-white shadow flex items-center gap-1">
                  <span>● Active</span>
                </span>
              </div>

              {/* Summary Card Info */}
              <div className="space-y-4 px-2">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-extrabold text-lg text-foreground">Swami Samartha Mess</h3>
                    <span className="text-xs text-muted-foreground font-semibold">Gourmand Dining, Pune</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Starting from</span>
                    <span className="text-xl font-black text-primary">₹70 / meal</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-border pt-4 text-xs text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Cycle: Flexible / Daily</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span>UPI, Cash, Bank</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid Section */}
      <section className="bg-muted/30 border-t border-border/80 py-24 px-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Built to Automate Mess Workflows</h2>
            <p className="text-muted-foreground font-semibold text-sm">Everything you need to run your local mess and tiffin services efficiently.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm hover-lift hover:border-primary/20 transition-all duration-300">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-inner">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="font-extrabold text-xl mb-3">Fast Daily Recorder</h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Log daily tiffin counts and additional item list (Chapati, Bhaji, Varan-Bhat, Curd) for all customers inside a fast, grid-based interface with auto-save.
              </p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm hover-lift hover:border-primary/20 transition-all duration-300">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 shadow-inner">
                <CreditCard className="h-7 w-7" />
              </div>
              <h3 className="font-extrabold text-xl mb-3">Dynamic Billing Engine</h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Calculates charges automatically based on actual meals consumed. Automatically skips days marked as holidays from billing cycle balances.
              </p>
            </div>
            
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm hover-lift hover:border-primary/20 transition-all duration-300">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 shadow-inner">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h3 className="font-extrabold text-xl mb-3">Detailed Reports & Invoice PDFs</h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                Print or download detailed PDF invoices showing daily consumed logs. View monthly sales graphs and collections in clean dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground bg-background transition-colors duration-300">
        <p className="font-medium">&copy; {new Date().getFullYear()} Swami Samartha Tiffin & Mess Services. All rights reserved.</p>
      </footer>
    </div>
  );
}
