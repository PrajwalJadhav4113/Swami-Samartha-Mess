# Billing Engine Optimization: Meal Tally V1 vs V2

This document details the architectural issue identified in the billing engine of **Swami Samartha Mess**, how it impacted multi-interval calculations on the `user/sumit` branch, and how the **V2 reduction-based implementation** resolved it.

---

## 1. Background

In Swami Samartha Mess, customers do not pay a flat subscription. Instead, bills are calculated based on **actual meals consumed** (`morning_full`, `morning_half`, `night_full`, `night_half`) across an owner-selected date range (e.g., `2026-10-01` to `2026-10-31`), minus holidays and leaves.

---

## 2. What Was Happening (The V1 Architecture)

### The Original V1 Logic
To tally meals consumed in a billing cycle, V1 did the following:

1. Generated **every calendar day** in the selected date range:
   ```typescript
   const dates = getDatesInRange(start, end); 
   // e.g., [Oct 1, Oct 2, Oct 3 ... Oct 31] (31 iterations)
   ```
2. Queried the database for `DailyMealRecord` documents and mapped them by timestamp:
   ```typescript
   const recordsMap = new Map(records.map((r) => [r.date.getTime(), r]));
   ```
3. Looped through **every calendar day**, checked holidays, and queried the Map:
   ```typescript
   dates.forEach((date) => {
     if (isHoliday(date)) return;

     const rec = recordsMap.get(date.getTime());
     if (!rec) return; // Guard: skip days with no meal record

     // Increment tallies...
   });
   ```

### Why That Was Inefficient in V1:
- **Redundant Iterations**: If a customer only ate 12 days in a 31-day month, the loop still executed 31 times, looking up keys in `recordsMap` 31 times and triggering `if (!rec) return;` on the 19 missing days.
- **Unnecessary Memory Allocation**: It had to generate an array of 31 `Date` objects and construct an intermediate JavaScript `Map` on every calculation.

---

## 3. The Compounding Issue on `user/sumit` (Multi-Call Overhead)

The `user/sumit` branch introduced advanced billing features:
- Partial and overlapping billing period detection.
- Segregating records into **`unbilledMealRecords`**, **`billedMealRecords`**, and **`allMealRecords`**.

To support this, the author wrapped the V1 logic into a reusable helper called `aggregateMeals`:

```typescript
const unbilledMealDetails = aggregateMeals(unbilledMealRecords);
const billedMealDetails   = aggregateMeals(billedMealRecords);
const totalMealDetails    = aggregateMeals(allMealRecords);
```

### The Problem:
Because `aggregateMeals` contained the calendar-loop logic, generating a single bill executed the entire calendar-day loop **three separate times**:
1. **Call 1 (`unbilledMealRecords`)**: Builds a Map, loops through all 31 days.
2. **Call 2 (`billedMealRecords`)**: Builds a 2nd Map, loops through all 31 days again.
3. **Call 3 (`allMealRecords`)**: Builds a 3rd Map, loops through all 31 days a third time.

Total work: **$3 \times 31 = 93$ calendar iterations**, 3 temporary Maps created, and dozens of redundant `if (!rec) return;` checks.

---

## 4. The Solution: V2 Reduction (`calculateMealTallyV2` & `aggregateMealsV2`)

### Core Insight
**If a meal was not recorded in the database, there is nothing to bill.** 

We do not need to iterate over every calendar day of the month just to discover which days have no meals. We only need to iterate over the **actual database records** that exist.

### How V2 Works:
1. **`calculateMealTallyV2`**: Uses native JavaScript `.reduce()` directly on the `mealRecords` array:
   ```typescript
   export function calculateMealTallyV2(
     mealRecords: Array<any>,
     isHoliday: (date: Date) => boolean
   ): MealTallyMap {
     return mealRecords.reduce(
       (tally: MealTallyMap, rec: any) => {
         // Skip holidays directly
         if (isHoliday(new Date(rec.date))) {
           return tally;
         }

         // Accumulate counts and price snapshots directly
         if (rec.morningMeal === "full") {
           tally.morning_full.quantity += 1;
           tally.morning_full.sumRates += rec.morningPrice;
         } else if (rec.morningMeal === "half") {
           tally.morning_half.quantity += 1;
           tally.morning_half.sumRates += rec.morningPrice;
         }

         if (rec.nightMeal === "full") {
           tally.night_full.quantity += 1;
           tally.night_full.sumRates += rec.nightPrice;
         } else if (rec.nightMeal === "half") {
           tally.night_half.quantity += 1;
           tally.night_half.sumRates += rec.nightPrice;
         }

         return tally;
       },
       {
         morning_full: { quantity: 0, sumRates: 0 },
         morning_half: { quantity: 0, sumRates: 0 },
         night_full: { quantity: 0, sumRates: 0 },
         night_half: { quantity: 0, sumRates: 0 },
       }
     );
   }
   ```

2. **`aggregateMealsV2`**: Converts the reduction tally into the final invoice details array:
   ```typescript
   const aggregateMealsV2 = (records: typeof allMealRecords) => {
     const mealTally = calculateMealTallyV2(records, isHoliday);
     const details: any[] = [];
     (Object.entries(mealTally) as [string, MealTallyItem][]).forEach(([type, info]) => {
       if (info.quantity > 0) {
         const rate = Math.round((info.sumRates / info.quantity) * 100) / 100;
         details.push({
           type,
           quantity: info.quantity,
           rate,
           amount: info.quantity * rate,
         });
       }
     });
     return details;
   };
   ```

3. **Active Invocation**:
   ```typescript
   const unbilledMealDetails = aggregateMealsV2(unbilledMealRecords);
   const billedMealDetails   = aggregateMealsV2(billedMealRecords);
   const totalMealDetails    = aggregateMealsV2(allMealRecords);
   ```

---

## 5. Comparison: V1 vs. V2

| Metric | V1 (Calendar Loop + Map) | V2 (Direct Reduction) |
| :--- | :--- | :--- |
| **Iteration Target** | Every day in the calendar (e.g., 31 days) | Only actual recorded meals ($N$ records) |
| **Auxiliary Data Structures** | `Date[]` array + `Map<number, Record>` | None (direct reduction on existing array) |
| **Number of Loops on `user/sumit`** | $3 \times \text{Days in Month}$ (93+ iterations) | $N_{\text{unbilled}} + N_{\text{billed}} + N_{\text{total}}$ |
| **Empty Day Handling** | Requires Map query + `if (!rec) return;` | Non-existent days are never processed |
| **Holiday Handling** | Checked per calendar day | Checked per recorded meal via `isHoliday(rec.date)` |
| **Time Complexity** | $O(3 \times D)$ with hash lookups | $O(N)$ linear pass |
| **Code Cleanliness** | Complex intermediary conversion | Clean, idiomatic functional TypeScript |

---

## 6. Summary of What Was Done

1. Kept the original V1 code intact so no regression or breaking change was introduced.
2. Implemented `calculateMealTallyV2` with strong TypeScript typing (`MealTallyItem`, `MealTallyMap`).
3. Implemented `aggregateMealsV2` to integrate seamlessly into the 3-tier partitioning (`unbilled`, `billed`, `total`) of `user/sumit`.
4. Resolved the merge conflict caused by `git stash pop`, preserving interval helpers (`mergeIntervals`, `DateInterval`, `subtractIntervals`, `formatIntervals`).
5. Switched invoice calculation to call `aggregateMealsV2` with explanatory code comments.
