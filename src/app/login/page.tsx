"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/ui/ThemeProvider";
import { Lock, User, UtensilsCrossed, Moon, Sun, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  
  // Read initial role from search query
  const initialRole = searchParams.get("role") === "customer" ? "customer" : "owner";
  
  const [role, setRole] = useState<"owner" | "customer">(initialRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync role state with search parameter changes
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "customer") setRole("customer");
    else if (roleParam === "owner") setRole("owner");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      error("Please enter both username and password");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      success(`Welcome back, ${data.user.name}!`, "Login Successful");
      
      // Determine redirection URL
      const redirectPath = searchParams.get("redirect");
      if (redirectPath) {
        router.push(redirectPath);
      } else {
        router.push(role === "owner" ? "/owner/dashboard" : "/customer/dashboard");
      }
    } catch (err: any) {
      error(err.message || "Something went wrong during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden glass hover-lift">
      <div className="p-8">
        {/* Brand */}
        <div className="flex flex-col items-center text-center gap-2 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold glow-primary text-xl">
            SS
          </div>
          <div>
            <h2 className="font-extrabold text-2xl">Swami Samartha Mess</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
              Portal Access Management
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-muted rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setRole("owner")}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              role === "owner"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Owner
          </button>
          <button
            type="button"
            onClick={() => setRole("customer")}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              role === "customer"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Customer
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={role === "owner" ? "swami" : "customer_username"}
                className="w-full pl-10 pr-4 py-3 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
              />
            </div>
            {role === "owner" && username === "" && (
              <span className="text-[10px] text-muted-foreground block mt-1">
                * Note: If running first time, use `swami` / `SwamiS123` to seed the database.
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/95 disabled:bg-primary/50 text-white font-semibold py-3.5 rounded-xl hover-lift shadow-md transition flex items-center justify-center gap-2 mt-6 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>

      <div className="bg-muted/50 border-t border-border px-8 py-4 text-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Landing Page</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Floating Theme Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition"
        aria-label="Toggle Theme"
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Login form...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
