"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeft, ChevronRight, Utensils, CalendarDays, HelpCircle, Loader2 } from "lucide-react";

interface MealRecord {
  _id: string;
  date: string;
  morningMeal: "none" | "half" | "full";
  nightMeal: "none" | "half" | "full";
}

interface ExtraItem {
  _id: string;
  date: string;
  name: string;
  quantity: number;
}

interface Holiday {
  _id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export default function CustomerMealsCalendar() {
  const { error } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Fetch calendar data for active month
  const fetchCalendarData = async (date: Date) => {
    setLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed
      
      // Calculate first and last day of month + buffer padding days
      const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

      const res = await fetch(`/api/customer/meals?startDate=${firstDay}&endDate=${lastDay}`);
      if (!res.ok) throw new Error("Could not retrieve calendar logs");
      const data = await res.json();
      
      setMeals(data.mealRecords);
      setExtras(data.extraItems);
      setHolidays(data.holidays);
    } catch (err: any) {
      error(err.message || "Failed to load calendar records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData(currentDate);
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Helper properties to render calendar days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  // Generate array for grid padding
  const paddingDays = Array.from({ length: startDayOfWeek });
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Match helpers
  const getDayInfo = (day: number) => {
    const targetDate = new Date(year, month, day);
    targetDate.setUTCHours(0, 0, 0, 0);
    const targetTime = targetDate.getTime();

    // 1. Check holiday status
    const isHoliday = holidays.some((h) => {
      const hStart = new Date(h.startDate);
      hStart.setUTCHours(0, 0, 0, 0);
      const hEnd = new Date(h.endDate);
      hEnd.setUTCHours(23, 59, 59, 999);
      return targetTime >= hStart.getTime() && targetTime <= hEnd.getTime();
    });

    const holidayReason = holidays.find((h) => {
      const hStart = new Date(h.startDate);
      hStart.setUTCHours(0, 0, 0, 0);
      const hEnd = new Date(h.endDate);
      hEnd.setUTCHours(23, 59, 59, 999);
      return targetTime >= hStart.getTime() && targetTime <= hEnd.getTime();
    })?.reason;

    // 2. Check meals logged
    const meal = meals.find((m) => {
      const mDate = new Date(m.date);
      mDate.setUTCHours(0, 0, 0, 0);
      return mDate.getTime() === targetTime;
    });

    // 3. Find extras
    const dayExtras = extras.filter((e) => {
      const eDate = new Date(e.date);
      eDate.setUTCHours(0, 0, 0, 0);
      return eDate.getTime() === targetTime;
    });

    return {
      isHoliday,
      holidayReason,
      meal: meal || null,
      extras: dayExtras,
    };
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Meals Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Track daily tiffin consumption records and holidays logged for you.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs bg-card border border-border p-3 rounded-xl shadow-sm font-semibold text-muted-foreground self-start sm:self-auto">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded bg-emerald-500" />
            <span>Full Tiffin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded bg-blue-500" />
            <span>Half Tiffin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
            <span>No Meal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded bg-amber-500" />
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col gap-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span>{monthName} {year}</span>
          </h3>
          
          <div className="flex gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Days grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Compiling calendar grid...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Week Headers */}
            <div className="grid grid-cols-7 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/40">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Days grid layout */}
            <div className="grid grid-cols-7 gap-2">
              {/* Padding for offset start */}
              {paddingDays.map((_, idx) => (
                <div key={`pad-${idx}`} className="aspect-square bg-muted/10 rounded-xl border border-transparent" />
              ))}

              {/* Calendar days mapping */}
              {daysArray.map((day) => {
                const info = getDayInfo(day);
                
                // Color formatting based on meal status
                let bgClass = "bg-muted/30 border-border/40 hover:bg-muted/50";
                
                if (info.isHoliday) {
                  bgClass = "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-400 hover:bg-amber-500/20";
                } else if (info.meal) {
                  const m = info.meal.morningMeal;
                  const n = info.meal.nightMeal;

                  if (m === "full" || n === "full") {
                    bgClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/20";
                  } else if (m === "half" || n === "half") {
                    bgClass = "bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-400 hover:bg-blue-500/20";
                  }
                }

                return (
                  <div
                    key={day}
                    className={`relative aspect-square border rounded-xl p-2.5 flex flex-col justify-between transition group cursor-default ${bgClass}`}
                  >
                    <span className="font-extrabold text-xs md:text-sm">{day}</span>
                    
                    {/* Status icons inside cell */}
                    <div className="flex flex-col gap-1 items-end mt-auto">
                      {info.extras.length > 0 && (
                        <span
                          className="text-[9px] bg-primary text-white font-extrabold px-1 rounded"
                          title={`${info.extras.map(e => `${e.name} x${e.quantity}`).join(", ")}`}
                        >
                          +{info.extras.reduce((sum, e) => sum + e.quantity, 0)}
                        </span>
                      )}

                      {info.isHoliday ? (
                        <span className="text-[8px] font-black uppercase text-amber-600 block leading-tight truncate w-full max-w-[60px]" title={info.holidayReason}>
                          Leave
                        </span>
                      ) : info.meal ? (
                        <div className="flex gap-1.5 items-center">
                          {info.meal.morningMeal !== "none" && (
                            <div
                              className={`h-2 w-2 rounded-full ${info.meal.morningMeal === "full" ? "bg-emerald-500" : "bg-blue-500"}`}
                              title={`Lunch: ${info.meal.morningMeal}`}
                            />
                          )}
                          {info.meal.nightMeal !== "none" && (
                            <div
                              className={`h-2 w-2 rounded-full ${info.meal.nightMeal === "full" ? "bg-emerald-500" : "bg-blue-500"}`}
                              title={`Dinner: ${info.meal.nightMeal}`}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
