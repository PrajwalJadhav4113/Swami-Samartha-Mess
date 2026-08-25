"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Search, UserPlus, Filter, Phone, MapPin, Eye, Edit2, Loader2, ArrowLeft, ArrowRight, User } from "lucide-react";
import Link from "next/link";

interface CustomerData {
  _id: string;
  name: string;
  photo?: string;
  mobile: string;
  address: string;
  username: string;
  status: "pending" | "active" | "inactive" | "rejected";
  joiningDate: string;
  notes?: string;
  dietPreference?: "veg" | "both";
}

function CustomersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();

  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals state
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add form fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split("T")[0]);
  const [dietPreference, setDietPreference] = useState<"veg" | "both">("both");

  // Open add form if query param ?action=add is set
  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setShowAddForm(true);
    }
  }, [searchParams]);

  const fetchCustomers = async (page: number, searchVal: string, statusVal: string) => {
    setLoading(true);
    try {
      const url = `/api/owner/customers?page=${page}&limit=8&search=${encodeURIComponent(
        searchVal
      )}&status=${statusVal}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch customer directory");
      const data = await res.json();
      setCustomers(data.customers);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
      setTotalCustomers(data.totalCustomers);
    } catch (err: any) {
      error(err.message || "Failed to load customer list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(1, search, statusFilter);
    }, 300); // debounce search
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile || !address || !username || !password) {
      error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mobile,
          address,
          username,
          password,
          notes,
          joiningDate,
          dietPreference,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add customer");

      success(`Customer "${name}" created successfully!`, "Registration Success");
      
      // Reset form
      setName("");
      setMobile("");
      setAddress("");
      setUsername("");
      setPassword("");
      setNotes("");
      setDietPreference("both");
      setShowAddForm(false);
      
      // Refresh directory
      fetchCustomers(1, search, statusFilter);
      
      // Clean URL params
      if (searchParams.get("action")) {
        router.replace("/owner/customers");
      }
    } catch (err: any) {
      error(err.message || "Error adding customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Database</h2>
          <p className="text-sm text-muted-foreground">
            Manage your tiffin customers, details, and view their individual portfolios.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2.5 rounded-xl hover-lift shadow-md transition self-start cursor-pointer"
        >
          <UserPlus className="h-4.5 w-4.5" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile number, username..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:border-primary/30 focus:outline-none transition text-sm font-medium"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-8.5 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold focus:outline-none focus:border-primary/30 appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Customer Modal Drawer */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-base">Register New Customer</h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  if (searchParams.get("action")) router.replace("/owner/customers");
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-muted"
              >
                Close
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                  Address *
                </label>
                <div className="relative">
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Area, landmark, Pune..."
                    className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Username * (Portal Login)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. rahul_s"
                      autoComplete="username"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Joining Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Notes
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. No spicy bhaji"
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                    Dietary Preference *
                  </label>
                  <div className="relative">
                    <select
                      value={dietPreference}
                      onChange={(e) => setDietPreference(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-muted/40 border border-border/80 focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 rounded-xl focus:outline-none transition-all duration-200 text-sm font-semibold cursor-pointer"
                    >
                      <option value="both">Eat Both (Veg/Non-Veg)</option>
                      <option value="veg">Vegetarian</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    if (searchParams.get("action")) router.replace("/owner/customers");
                  }}
                  className="px-4 py-2 border border-border hover:bg-muted text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl hover-lift shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Customers List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading customer list...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <User className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Customers Found</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Try adjusting your search criteria, filter options, or register a new customer profile.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customers.map((c) => (
              <div
                key={c._id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-primary/20 hover-lift group"
              >
                <div className="flex items-start gap-4">
                  {/* Photo or Avatar */}
                  <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold text-lg flex-shrink-0">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name} className="h-full w-full object-cover rounded-xl" />
                    ) : (
                      c.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base truncate group-hover:text-primary transition">
                        {c.name}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
                        }`}
                      >
                        {c.status}
                      </span>
                      {c.dietPreference === "veg" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          Veg
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          Eat Both
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground block font-medium mt-0.5">@{c.username}</span>

                    {/* Contacts info */}
                    <div className="space-y-1 mt-3">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{c.mobile}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground font-medium truncate">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                  <span className="text-[10px] text-muted-foreground">
                    Joined: {new Date(c.joiningDate).toLocaleDateString()}
                  </span>
                  
                  <div className="flex gap-2">
                    {c.status === "pending" && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/owner/customers/${c._id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'active' })
                              });
                              if (res.ok) {
                                success(`Approved "${c.name}" successfully!`);
                                fetchCustomers(currentPage, search, statusFilter);
                              } else {
                                error("Failed to approve customer.");
                              }
                            } catch (e) {
                              error("Failed to approve customer.");
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold rounded-lg transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/owner/customers/${c._id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'rejected' })
                              });
                              if (res.ok) {
                                success(`Rejected and deleted "${c.name}" successfully.`);
                                fetchCustomers(currentPage, search, statusFilter);
                              } else {
                                error("Failed to reject customer.");
                              }
                            } catch (e) {
                              error("Failed to reject customer.");
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <Link
                      href={`/owner/customers/${c._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-lg transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Profile</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                Showing Page {currentPage} of {totalPages} ({totalCustomers} total)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => fetchCustomers(currentPage - 1, search, statusFilter)}
                  className="inline-flex items-center gap-1 border border-border px-3 py-1.5 bg-card hover:bg-muted disabled:opacity-40 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => fetchCustomers(currentPage + 1, search, statusFilter)}
                  className="inline-flex items-center gap-1 border border-border px-3 py-1.5 bg-card hover:bg-muted disabled:opacity-40 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CustomersList() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading customers interface...</p>
      </div>
    }>
      <CustomersListContent />
    </Suspense>
  );
}
