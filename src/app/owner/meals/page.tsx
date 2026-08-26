"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Calendar, Search, Save, Plus, X, Loader2, CheckCircle, RefreshCw, AlertCircle, Filter } from "lucide-react";

interface ExtraSelection {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface CustomerMealRecord {
  customerId: string;
  customerName: string;
  pricingType?: "standard" | "special";
  morningMeal: "none" | "half" | "full";
  nightMeal: "none" | "half" | "full";
  notes: string;
  extras: ExtraSelection[];
  dietPreference?: "veg" | "both";
}

interface MenuItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  specialPrice: number;
  isActive: boolean;
}

export default function DailyMealsEntry() {
  const { success, error } = useToast();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [mealFilter, setMealFilter] = useState<"all" | "remaining" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CustomerMealRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Autosave tracking
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active popover customer ID for extra items selector
  const [activeExtrasPopover, setActiveExtrasPopover] = useState<string | null>(null);

  // Fetch configured active menu items
  const fetchMenu = async () => {
    try {
      const res = await fetch("/api/owner/menu");
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data.filter((item: MenuItem) => item.isActive));
      }
    } catch (err) {
      console.error("Error loading menu master:", err);
    }
  };

  // Fetch meals worksheet for date
  const fetchMeals = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/meals?date=${targetDate}`);
      if (!res.ok) throw new Error("Could not fetch daily sheet");
      const data = await res.json();
      setRecords(data);
      setSaveStatus("saved");
    } catch (err: any) {
      error(err.message || "Failed to load daily sheet");
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    fetchMeals(date);
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
  }, [date]);

  // Bulk save trigger API
  const saveMealsToServer = async (currentRecords: CustomerMealRecord[]) => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/owner/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          records: currentRecords,
        }),
      });

      if (!res.ok) throw new Error("Failed to write sheets to DB");
      setSaveStatus("saved");
    } catch (err: any) {
      console.error("Autosave Error:", err);
      setSaveStatus("error");
      error("Autosave failed. Click the Save All button to retry.");
    }
  };

  // Debounced autosave
  const triggerAutosave = useCallback((updatedRecords: CustomerMealRecord[]) => {
    setSaveStatus("unsaved");
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = setTimeout(() => {
      saveMealsToServer(updatedRecords);
    }, 1500); // Save after 1.5s idle
  }, [date]);

  // Handle value change for basic meal options
  const handleMealChange = (
    customerId: string,
    field: "morningMeal" | "nightMeal",
    value: "none" | "half" | "full"
  ) => {
    const updated = records.map((rec) => {
      if (rec.customerId === customerId) {
        return { ...rec, [field]: value };
      }
      return rec;
    });
    setRecords(updated);
    triggerAutosave(updated);
  };

  // Handle note string change
  const handleNotesChange = (customerId: string, value: string) => {
    const updated = records.map((rec) => {
      if (rec.customerId === customerId) {
        return { ...rec, notes: value };
      }
      return rec;
    });
    setRecords(updated);
    triggerAutosave(updated);
  };

  // Handle extra item addition
  const handleAddExtra = (customerId: string, item: MenuItem) => {
    const updated = records.map((rec) => {
      if (rec.customerId === customerId) {
        const existingIdx = rec.extras.findIndex((e) => e.menuItemId === item._id);
        const newExtras = [...rec.extras];

        // Resolve correct price based on customer pricing type
        const price = rec.pricingType === "special" ? (item.specialPrice || item.price) : item.price;

        if (existingIdx > -1) {
          newExtras[existingIdx].quantity += 1;
        } else {
          newExtras.push({
            menuItemId: item._id,
            name: item.name,
            price: price,
            quantity: 1,
          });
        }
        return { ...rec, extras: newExtras };
      }
      return rec;
    });
    setRecords(updated);
    triggerAutosave(updated);
  };

  // Handle extra item quantity change
  const handleExtraQtyChange = (customerId: string, menuItemId: string, delta: number) => {
    const updated = records.map((rec) => {
      if (rec.customerId === customerId) {
        const newExtras = rec.extras
          .map((ext) => {
            if (ext.menuItemId === menuItemId) {
              return { ...ext, quantity: Math.max(0, ext.quantity + delta) };
            }
            return ext;
          })
          .filter((ext) => ext.quantity > 0); // remove item if qty drops to 0

        return { ...rec, extras: newExtras };
      }
      return rec;
    });
    setRecords(updated);
    triggerAutosave(updated);
  };

  // Handle direct save backup click
  const handleManualSave = () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    saveMealsToServer(records).then((res) => {
      success("Daily entry saved successfully!", "Database Synced");
    });
  };

  // Filter customers by search input and meal status
  const filteredRecords = records.filter((rec) => {
    const matchesSearch = rec.customerName.toLowerCase().includes(search.toLowerCase());
    const isDone = rec.morningMeal !== "none" || rec.nightMeal !== "none";
    if (mealFilter === "done") {
      return matchesSearch && isDone;
    }
    if (mealFilter === "remaining") {
      return matchesSearch && !isDone;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Meal Entry</h2>
          <p className="text-sm text-muted-foreground">
            Fast worksheet scheduler. Record daily lunch/dinner choices and extra items in bulk.
          </p>
        </div>

        {/* Date and Save indicators */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Autosave badge indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card">
            {saveStatus === "saved" && (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">All Saved</span>
              </>
            )}
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-primary">Autosaving...</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <>
                <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />
                <span className="text-amber-600">Pending Changes</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle className="h-4 w-4 text-rose-500 animate-bounce" />
                <span className="text-rose-600">Save Error</span>
              </>
            )}
          </div>

          <button
            onClick={handleManualSave}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-3 py-1.5 rounded-lg hover-lift shadow transition cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>Force Sync</span>
          </button>
        </div>
      </div>

      {/* Date selector and search filter bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-48 flex-shrink-0">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground pointer-events-none">
            <Calendar className="h-4 w-4" />
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold focus:outline-none focus:border-primary/20 cursor-pointer"
          />
        </div>

        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active customer list..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:border-primary/20 focus:outline-none transition text-sm font-medium"
          />
        </div>

        <div className="relative flex items-center w-full sm:w-44 flex-shrink-0">
          <span className="absolute left-3 text-muted-foreground pointer-events-none">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value as any)}
            className="w-full pl-8.5 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold focus:outline-none focus:border-primary/20 appearance-none cursor-pointer"
          >
            <option value="all">All Meals</option>
            <option value="remaining">Remaining Meals</option>
            <option value="done">Done Meals</option>
          </select>
        </div>
      </div>

      {/* Grid Worksheet Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Fetching daily tiffin worksheet...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-card border border-border p-12 text-center rounded-2xl">
          <AlertCircle className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="font-bold text-sm">No Active Customers Found</h4>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Ensure you have registered active customers in the database before logging meals.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop view */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className={`overflow-x-auto transition-all duration-200 ${activeExtrasPopover ? "min-h-[340px]" : ""}`}>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-bold uppercase">
                    <th className="px-6 py-4 w-1/4">Customer Name</th>
                    <th className="px-6 py-4 text-center">Morning Meal (Lunch)</th>
                    <th className="px-6 py-4 text-center">Night Meal (Dinner)</th>
                    <th className="px-6 py-4">Extras & Custom Items</th>
                    <th className="px-6 py-4">Row Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.customerId} className="hover:bg-muted/10 transition align-top">
                      {/* Customer Name */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2">
                          {rec.pricingType === "special" && (
                            <span className="text-amber-500 font-extrabold" title="Special Customer">⭐</span>
                          )}
                          <span className="font-bold block text-sm">{rec.customerName}</span>
                          {rec.dietPreference === "veg" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                              Veg
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                              Both
                            </span>
                          )}
                        </div>
                        <Link href={`/owner/customers/${rec.customerId}`} className="text-[10px] text-primary hover:underline font-semibold uppercase mt-1.5 block">
                          Profile Details
                        </Link>
                      </td>

                      {/* Morning Meal choices */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="inline-grid grid-cols-3 p-1 bg-muted/40 rounded-xl border border-border/60 gap-1">
                          {(["none", "half", "full"] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => handleMealChange(rec.customerId, "morningMeal", opt)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer border ${
                                rec.morningMeal === opt
                                  ? opt === "none"
                                    ? "bg-rose-600 text-white border-rose-600 shadow-sm scale-102 animate-pulse-subtle"
                                    : opt === "half"
                                      ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-102"
                                      : "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-102"
                                  : "bg-card border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Night Meal choices */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="inline-grid grid-cols-3 p-1 bg-muted/40 rounded-xl border border-border/60 gap-1">
                          {(["none", "half", "full"] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => handleMealChange(rec.customerId, "nightMeal", opt)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer border ${
                                rec.nightMeal === opt
                                  ? opt === "none"
                                    ? "bg-rose-600 text-white border-rose-600 shadow-sm scale-102 animate-pulse-subtle"
                                    : opt === "half"
                                      ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-102"
                                      : "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-102"
                                  : "bg-card border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Extras Items inline bubbles and picker popover */}
                      <td className="px-6 py-4.5 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rec.extras.map((ext) => (
                            <span
                              key={ext.menuItemId}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted border border-border text-xs"
                            >
                              <span>{ext.name}</span>
                              <span className="font-extrabold text-primary">x{ext.quantity}</span>
                              <button
                                onClick={() => handleExtraQtyChange(rec.customerId, ext.menuItemId, -1)}
                                className="ml-1 text-muted-foreground hover:text-rose-500 focus:outline-none"
                                title="Decrease"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}

                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveExtrasPopover(
                                  activeExtrasPopover === rec.customerId ? null : rec.customerId
                                )
                              }
                              className="inline-flex items-center justify-center p-1 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Add extra item"
                            >
                              <Plus className="h-4 w-4" />
                            </button>

                            {activeExtrasPopover === rec.customerId && (
                              <>
                                <div
                                  onClick={() => setActiveExtrasPopover(null)}
                                  className="fixed inset-0 z-10"
                                />
                                <div className="absolute left-0 mt-2 z-20 w-56 bg-card border border-border shadow-xl rounded-xl p-2 max-h-52 overflow-y-auto animate-in fade-in duration-150">
                                  <span className="text-[10px] text-muted-foreground font-bold uppercase block px-2.5 py-1">
                                    Select Extra Menu
                                  </span>
                                  {menuItems.length === 0 ? (
                                    <span className="text-xs text-muted-foreground block px-2.5 py-2">
                                      No active extras configured
                                    </span>
                                  ) : (
                                    menuItems.map((item) => (
                                      <button
                                        key={item._id}
                                        onClick={() => {
                                          handleAddExtra(rec.customerId, item);
                                        }}
                                        className="w-full text-left px-2.5 py-2 hover:bg-muted rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                                      >
                                        <span>{item.name}</span>
                                        <span className="text-emerald-600">
                                          ₹{rec.pricingType === "special" ? (item.specialPrice || item.price) : item.price}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Notes field */}
                      <td className="px-6 py-4.5">
                        <input
                          type="text"
                          value={rec.notes}
                          onChange={(e) => handleNotesChange(rec.customerId, e.target.value)}
                          placeholder="e.g. Extra bhaji"
                          className="w-full px-2.5 py-1.5 bg-muted border border-transparent rounded-lg focus:border-primary/20 focus:bg-card focus:outline-none transition text-xs font-semibold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile view */}
          <div className="block md:hidden space-y-4">
            {filteredRecords.map((rec) => (
              <div key={rec.customerId} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:border-primary/10 transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      {rec.pricingType === "special" && (
                        <span className="text-amber-500 font-extrabold" title="Special Customer">⭐</span>
                      )}
                      <span className="font-bold text-base block">{rec.customerName}</span>
                      {rec.dietPreference === "veg" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          Veg
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          Both
                        </span>
                      )}
                    </div>
                    <Link href={`/owner/customers/${rec.customerId}`} className="text-[10px] text-primary hover:underline font-semibold uppercase mt-0.5 block">
                      Profile Details
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Lunch (Morning)</span>
                    <div className="grid grid-cols-3 p-1 bg-muted/40 rounded-xl border border-border/60 gap-1">
                      {(["none", "half", "full"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleMealChange(rec.customerId, "morningMeal", opt)}
                          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer border ${
                            rec.morningMeal === opt
                              ? opt === "none"
                                ? "bg-rose-500 text-white border-rose-500 shadow-sm scale-95"
                                : opt === "half"
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-95"
                                  : "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-95"
                              : "bg-card border-border/40 text-muted-foreground"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Dinner (Night)</span>
                    <div className="grid grid-cols-3 p-1 bg-muted/40 rounded-xl border border-border/60 gap-1">
                      {(["none", "half", "full"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => handleMealChange(rec.customerId, "nightMeal", opt)}
                          className={`py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer border ${
                            rec.nightMeal === opt
                              ? opt === "none"
                                ? "bg-rose-500 text-white border-rose-500 shadow-sm scale-95"
                                : opt === "half"
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-95"
                                  : "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-95"
                              : "bg-card border-border/40 text-muted-foreground"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Extras</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rec.extras.map((ext) => (
                      <span
                        key={ext.menuItemId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-border text-[10px] font-semibold"
                      >
                        <span>{ext.name}</span>
                        <span className="font-extrabold text-primary">x{ext.quantity}</span>
                        <button
                          onClick={() => handleExtraQtyChange(rec.customerId, ext.menuItemId, -1)}
                          className="ml-1 text-muted-foreground hover:text-rose-500 focus:outline-none"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveExtrasPopover(
                            activeExtrasPopover === rec.customerId ? null : rec.customerId
                          )
                        }
                        className="inline-flex items-center justify-center p-1 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      {activeExtrasPopover === rec.customerId && (
                        <>
                          <div
                            onClick={() => setActiveExtrasPopover(null)}
                            className="fixed inset-0 z-10"
                          />
                          <div className="absolute left-0 mt-2 z-20 w-48 bg-card border border-border shadow-xl rounded-xl p-1.5 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                            {menuItems.map((item) => (
                              <button
                                key={item._id}
                                onClick={() => handleAddExtra(rec.customerId, item)}
                                className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-lg text-[10px] font-semibold flex items-center justify-between transition cursor-pointer"
                              >
                                <span>{item.name}</span>
                                <span className="text-emerald-600">₹{item.price}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">Notes</span>
                  <input
                    type="text"
                    value={rec.notes}
                    onChange={(e) => handleNotesChange(rec.customerId, e.target.value)}
                    placeholder="e.g. Extra bhaji"
                    className="w-full px-3 py-2 bg-muted border border-border/60 rounded-xl focus:border-primary/20 focus:bg-card focus:outline-none transition text-xs font-semibold"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
