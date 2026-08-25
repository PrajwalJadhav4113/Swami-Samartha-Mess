"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/ui/ThemeProvider";
import { Lock, User, Phone, MapPin, Mail, Moon, Sun, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dietPreference, setDietPreference] = useState<"veg" | "both">("both");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile || !address || !password) {
      error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, address, email, password, dietPreference }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      success("Account registered! Please wait for admin approval.", "Registration Successful");
      router.push("/login?role=customer");
    } catch (err: any) {
      error(err.message || "Something went wrong during registration");
    } finally {
      setLoading(false);
    }
  };

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

      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl overflow-hidden glass hover-lift">
        <div className="p-8">
          {/* Brand */}
          <div className="flex flex-col items-center text-center gap-2 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold glow-primary text-xl">
              SS
            </div>
            <div>
              <h2 className="font-extrabold text-2xl">Create Account</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">
                Join Swami Samartha Mess
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Mobile Number * (Used for Sign In)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Email ID (Optional)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  name="reg_email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Location / Address *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 pt-3 flex items-start text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                </span>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, Landmark, Pune..."
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium resize-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Dietary Preference *
              </label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setDietPreference("veg")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    dietPreference === "veg"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Vegetarian
                </button>
                <button
                  type="button"
                  onClick={() => setDietPreference("both")}
                  className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    dietPreference === "both"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Eat Both (Veg/Non-Veg)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Password *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  name="reg_password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-xl focus:border-primary/30 focus:bg-card focus:outline-none transition text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/95 disabled:bg-primary/50 text-white font-semibold py-3 rounded-xl hover-lift shadow-md transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        </div>

        <div className="bg-muted/50 border-t border-border px-8 py-4 text-center flex flex-col gap-2">
          <Link href="/login?role=customer" className="text-xs text-primary hover:underline font-semibold transition">
            Already have an account? Sign In
          </Link>
          <Link href="/" className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Landing Page</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
