# Date Storage and Handling Analysis

**Date:** January 20, 2026  
**Issue:** Understanding how dates are stored in Firestore and how to correctly query them

## Summary

**Your application uses JavaScript `Date` objects to store timestamps in Firestore, NOT ISO strings.**

When you save a JavaScript `Date` object to Firestore, it automatically converts it to a **Firestore Timestamp**, which stores:
- `seconds`: Unix timestamp (timezone-agnostic)
- `nanoseconds`: Fractional seconds

**Key Point:** Firestore Timestamps are timezone-agnostic (stored as UTC internally), but when you create a `new Date()` in your browser, it captures the exact moment in time, including your local timezone offset.

---

## How Dates Are Stored

### In Your Code:
```typescript
// Example from pos.service.ts line 683
createdAt: new Date()  // ✅ JavaScript Date object

// Example from ledger.service.ts line 131
createdAt: new Date()  // ✅ JavaScript Date object
```

### In Firestore:
When Firestore receives `new Date()`, it converts it to a Timestamp:
```json
{
  "createdAt": {
    "seconds": 1737331616,
    "nanoseconds": 123000000
  }
}
```

This represents a specific moment in time (UTC-based), **not** a string like "2026-01-20T00:00:00Z".

---

## How to Query Correctly

### ✅ Correct Approach (Your Current Implementation):

```typescript
// From order.service.ts line 958
const startTimestamp = Timestamp.fromDate(startDate);
const endTimestamp = Timestamp.fromDate(endDate);

const dateRangeQuery = query(
  ordersRef, 
  where('storeId', '==', storeId),
  where('createdAt', '>=', startTimestamp),
  where('createdAt', '<=', endTimestamp)
);
```

**Why this works:**
- `Timestamp.fromDate(startDate)` converts your JavaScript Date to a Firestore Timestamp
- Firestore compares Timestamps correctly (as moments in time)
- Your local timezone is preserved in the Date object before conversion

### ❌ The Problem We Fixed:

**BEFORE (Wrong):**
```typescript
// This was causing timezone issues
private formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];  // ❌ Converts to UTC first!
}

// Example with PHT (UTC+8):
const localDate = new Date('2026-01-20 15:30:00');  // 3:30 PM on Jan 20 in Philippines
localDate.toISOString();  // "2026-01-20T07:30:00Z" - converts to UTC (7:30 AM)
localDate.toISOString().split('T')[0];  // "2026-01-20" - looks correct but used UTC!
```

**AFTER (Correct):**
```typescript
// Fixed in sales-summary.component.ts
private formatDateForInput(date: Date): string {
  const year = date.getFullYear();        // Gets LOCAL year
  const month = String(date.getMonth() + 1).padStart(2, '0');  // Gets LOCAL month
  const day = String(date.getDate()).padStart(2, '0');         // Gets LOCAL day
  return `${year}-${month}-${day}`;
}

// Example with PHT:
const localDate = new Date('2026-01-20 15:30:00');
localDate.getFullYear();  // 2026
localDate.getMonth();     // 0 (January)
localDate.getDate();      // 20
// Result: "2026-01-20" ✅ Uses local timezone values
```

---

## The Timezone Issue Explained

### Scenario: User in Philippines (UTC+8)

**Creating a date for "Today" (Jan 20, 2026):**

```typescript
// ❌ WRONG WAY (causes timezone shift):
const wrongWay = new Date("2026-01-20");  // Interprets as UTC midnight
// In Philippines, this becomes: Jan 20, 08:00:00 AM (shifted by +8 hours)
wrongWay.toISOString();  // "2026-01-20T00:00:00.000Z"
// When you query, you're actually looking for Jan 20 08:00 AM onwards in your local time!

// ✅ CORRECT WAY (uses local timezone):
const today = new Date();
const correctWay = new Date(
  today.getFullYear(),   // 2026
  today.getMonth(),       // 0 (January)
  today.getDate(),        // 20
  0, 0, 0, 0              // Midnight in LOCAL time
);
// In Philippines, this is: Jan 20, 00:00:00 AM PHT
correctWay.toISOString();  // "2026-01-19T16:00:00.000Z" (UTC equivalent)
```

**Key Insight:**
- When stored in Firestore, both dates represent moments in time
- But the "wrong way" captures a different moment (8 hours later) than intended
- This is why "Yesterday" data was showing when you selected "Today"

---

## Date Handling in Your Application

### 1. **Storing Dates (Writing to Firestore):**
```typescript
// ✅ All your services do this correctly:
{
  createdAt: new Date(),    // Captures current moment with your timezone
  updatedAt: new Date()     // Firestore converts to Timestamp automatically
}
```

### 2. **Reading Dates (From Firestore):**
```typescript
// From order.service.ts line 89
createdAt: toDateValue(data.createdAt) ?? new Date()

// The toDateValue() function (date-utils.ts) handles multiple formats:
export function toDateValue(val: any): Date | undefined {
  if (val instanceof Date) return val;
  if (val && typeof val.toDate === 'function') {
    return val.toDate();  // ✅ Firestore Timestamp → JavaScript Date
  }
  if (val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);  // ✅ Handles raw Timestamp format
  }
  // ... other formats
}
```

### 3. **Querying by Date Range:**
```typescript
// ✅ Correct pattern (already implemented):
const startDate = new Date(year, month, day, 0, 0, 0, 0);  // Start of day (local)
const endDate = new Date(year, month, day, 23, 59, 59, 999);  // End of day (local)

const startTimestamp = Timestamp.fromDate(startDate);
const endTimestamp = Timestamp.fromDate(endDate);

query(
  collection,
  where('createdAt', '>=', startTimestamp),
  where('createdAt', '<=', endTimestamp)
);
```

### 4. **Displaying Dates (UI Formatting):**
```typescript
// For date input fields (YYYY-MM-DD):
private formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// For display in UI (formatted):
date.toLocaleDateString('en-PH');  // Uses Philippine locale
date.toLocaleString('en-PH');      // Includes time
```

---

## What We Fixed

### Components Updated:

1. **sales-summary.component.ts** (Line 2133)
   - Changed `formatDateForInput()` from using `toISOString()` to local date components
   - Added logging to track date conversions

2. **overview.component.ts** (Line 2605-2608)
   - Changed TODAY date creation to use explicit local components

3. **sales-summary.component.ts** (Line 1825-1845)
   - Fixed `loadSalesData()` to parse date strings using local timezone

### Pattern Applied:
```typescript
// ❌ BEFORE (UTC-based):
const dateStr = date.toISOString().split('T')[0];  // "2026-01-20"
const parsed = new Date(dateStr);  // Interprets as UTC!

// ✅ AFTER (Local timezone):
const [year, month, day] = dateStr.split('-').map(Number);
const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);  // Local midnight
```

---

## Answer to Your Question

> "Are they all ISO? So you mean if they are entered in ISO we need to convert to PHT to get the correct date?"

**Answer:**

1. **Storage:** Dates are stored as **Firestore Timestamps** (not ISO strings). When you do `createdAt: new Date()`, Firestore automatically converts it to a Timestamp.

2. **The Issue:** The problem was NOT in how dates are stored, but in how we were **creating Date objects** for queries:
   - Using `new Date("2026-01-20")` interprets the string as UTC
   - In UTC+8 timezone, this shifts the date by 8 hours
   - This caused queries to miss data

3. **The Fix:** Instead of relying on ISO string parsing, we now:
   - Create dates using explicit local components: `new Date(year, month, day, 0, 0, 0, 0)`
   - This ensures dates represent the correct moment in YOUR timezone
   - Firestore Timestamps handle the UTC conversion internally and correctly

4. **No Manual Conversion Needed:** You don't need to manually convert between PHT and UTC. JavaScript's `Date` object and Firestore Timestamps handle this automatically, as long as you:
   - ✅ Create dates using local components (not ISO strings)
   - ✅ Use `Timestamp.fromDate()` for queries
   - ✅ Use `toDateValue()` to read Timestamp from Firestore

---

## Best Practices

### ✅ DO:
```typescript
// Create dates with explicit local components
const startOfDay = new Date(year, month, day, 0, 0, 0, 0);

// Store dates as Date objects
createdAt: new Date()

// Query using Timestamp.fromDate()
where('createdAt', '>=', Timestamp.fromDate(startDate))

// Format for display using local methods
date.getFullYear(), date.getMonth(), date.getDate()
```

### ❌ DON'T:
```typescript
// Don't parse ISO strings directly
new Date("2026-01-20")  // Interprets as UTC!

// Don't use toISOString() for date-only formatting
date.toISOString().split('T')[0]  // Converts to UTC first!

// Don't store dates as ISO strings
createdAt: new Date().toISOString()  // Store as Date object instead
```

---

## Conclusion

Your Firestore data is stored correctly as Timestamps. The issue was in the **client-side date formatting** when creating query parameters. The fixes ensure that when you select "Today", it correctly queries for orders created today in YOUR timezone (PHT/UTC+8), not UTC.

**No database changes needed** - just the client-side date handling we already fixed.
