"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { UserCheck, Lock, Save, Loader2, Phone, MapPin, User } from "lucide-react";

interface CustomerDetails {
  name: string;
  mobile: string;
  address: string;
  username: string;
  dietPreference?: "veg" | "both";
}

export default function CustomerProfileSettings() {
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerDetails | null>(null);

  // Form states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Could not load account session");
      const authData = await res.json();
      
      // Load detailed info from customer dashboard or API
      const profileRes = await fetch("/api/customer/dashboard");
      if (profileRes.ok) {
        // Fetch detailed profile info if needed, but dashboard has menu/recent.
        // Actually, we can fetch customer info using auth details.
        // Let's get customer details from the database (via a customer specific detail endpoint if needed,
        // but wait! We can fetch from `/api/owner/customers/[id]`? No, customers cannot access owner routes.
        // Let's write a simple customer profile details endpoint, or we can look inside `authData.user`).
        // Wait, does authData.user have customer details? Yes, let's see. It contains id, name, username.
        // What about mobile and address? We can query a quick public customer profile endpoint, 
        // or add it to `/api/auth/me` or `/api/customer/dashboard`!
        // Ah, let's see: in our `api/auth/me` we queried `Customer.findById()` but only selected `name, username`.
        // Let's check `/api/auth/me/route.ts` - wait, in `/api/auth/me/route.ts` we wrote:
        // `const customer = await Customer.findById(payload.id).select("-passwordHash");`
        // Oh! That selects ALL fields except passwordHash! Including mobile and address!
        // That is perfect! So `/api/auth/me` returns `user` which is the complete Customer document (except passwordHash) if the user is a customer!
        // Let's verify. In `api/auth/me/route.ts`:
        // `return NextResponse.json({ authenticated: true, user: payload });`
        // Wait, it returned `user: payload`, where `payload` was just the decrypted JWT token payload.
        // Ah! It did not return the fetched customer document, it returned `payload` which only has id, name, username, role.
        // Let's modify `/api/auth/me/route.ts` so it returns the full customer document (mobile, address, etc.) under `user`! That is an extremely helpful improvement and avoids writing another endpoint!
      }
      
      // Let's fetch full data by calling a custom client GET to `me` which we will update, 
      // or we can fetch settings. Let's inspect `authData.user`. Let's update `api/auth/me/route.ts` to return the full document.
      // Wait, let's look at `authData`. We will fetch and update it.
      const res2 = await fetch("/api/auth/me");
      const data2 = await res2.json();
      if (data2.authenticated) {
        // Let's write the fetch logic.
        // Wait, to get full mobile and address, let's update `api/auth/me/route.ts` in our thought, 
        // and we can fetch it here.
        // Wait! Let's check if we can query `/api/auth/me` and get the full fields. We will make sure `/api/auth/me` returns them!
        setProfile(data2.user);
      }
    } catch (err: any) {
      error(err.message || "Failed to load profile details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      error("New password and confirm password do not match");
      return;
    }

    if (newPassword.length < 6) {
      error("Password must be at least 6 characters long");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/customer/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password update failed");

      success("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      error(err.message || "Error changing password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Retrieving profile settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-300">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
        <p className="text-sm text-muted-foreground">
          View your registered contact details and update your portal password.
        </p>
      </div>

      {/* Profile summary */}
      {profile && (
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span>Profile Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block font-bold uppercase">Name</span>
              <span className="text-sm font-bold block mt-0.5">{profile.name}</span>
            </div>
            <div className="p-3 bg-muted/50 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground block font-bold uppercase">Username</span>
              <span className="text-sm font-bold block mt-0.5">@{profile.username}</span>
            </div>
            {/* Note: Mobile and Address fields will render if returned by auth me */}
            {(profile as any).mobile && (
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase">Mobile Number</span>
                <span className="text-sm font-bold block mt-0.5">{(profile as any).mobile}</span>
              </div>
            )}
            {(profile as any).address && (
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase">Billed Address</span>
                <span className="text-sm font-bold block mt-0.5">{(profile as any).address}</span>
              </div>
            )}
            {profile.dietPreference && (
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase">Dietary Preference</span>
                <span className="text-xs font-bold block mt-1">
                  {profile.dietPreference === "veg" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                      Vegetarian
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                      Eat Both (Veg/Non-Veg)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change password card */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <span>Change Password</span>
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-sm font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover-lift shadow transition mt-2 cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save Password</span>
          </button>
        </form>
      </div>
    </div>
  );
}
