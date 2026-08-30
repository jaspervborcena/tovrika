# Financial Calculations & Dashboard Logic

## Overview
This document defines the financial calculation rules for the dashboard. It covers revenue computation, profit calculations, and how different transaction types (refunds, returns, damage) impact the financial metrics.

---

## Core Principles

### 1. Order Status Filtering
Only **completed orders** count toward revenue. Open pay-later orders are tracked separately and excluded from revenue until collected, even though stock and receivable amount are already affected.

| Status | Revenue Impact | Notes |
|--------|----------------|-------|
| **completed** | ✅ Include | Finalized and paid, counts toward revenue |
| **open** | ❌ Exclude | Pay-later / receivable sale; stock is deducted and amount is tracked as outstanding |
| **unpaid** | ⚠️ Track Separately | Outstanding payment on a previously completed sale |
| **recovered** | ✅ Add Back | Payment collected from an unpaid order |

> Note: For pay-later orders, stock is reduced immediately and the sale amount is recorded as a receivable, but it is not treated as realized revenue until payment is received.

### 2. Transaction Type Impact

| Transaction Type | Revenue Deducted | Inventory Affected | Profit Deducted | Notes |
|------------------|------------------|-------------------|-----------------|-------|
| **Refund** (Full/Partial) | ✅ YES | ❌ NO | ✅ YES | Cash returned to customer |
| **Return** (Full/Partial) | ❌ NO | ✅ YES | ❌ NO | Inventory restored only |
| **Damage** (Full/Partial) | ✅ YES | ✅ YES | ✅ YES | Cash loss + Inventory loss |
| **Recovered** | N/A | N/A | ✅ YES (+) | Payments from unpaid orders |

---

## Revenue Calculation

### Total Revenue (Base Amount)
```
Total Revenue = SUM(completed orders.amount) 
              - SUM(all refunds)              // Full + Partial
              - SUM(all damage)               // Full + Partial
```

**Important:** Open pay-later sales are not included in revenue. They may still reduce stock and create an outstanding receivable amount, but they are excluded from realized revenue until settled.

**Note:** Returns do NOT reduce revenue (inventory-only impact).

### Example:
```
Completed Orders Total:    ₱1,000
  └─ 1 completed order

Adjustments:
  - Refunds (partial):     -₱200    (customer refund)
  - Damage:                -₱50     (lost goods)
  - Returns:               ₱0       (inventory-only, no revenue impact)

Total Revenue = ₱1,000 - ₱200 - ₱50 = ₱750
```

---

## Profit Calculation

### Net Profit Formula
```
Net Profit = Total Revenue
           - Refunds                 // Cash out to customers
           - Damage                  // Cash loss + Inventory loss
           + Recovered Payments      // Cash collected from unpaid
           - Total Expenses
```

**Important:** Returns are NOT deducted (inventory-only impact).

### Calculation Breakdown

```typescript
// 1. Start with completed orders only
const completedOrderAmount = orders
  .filter(o => o.status === 'completed')
  .reduce((sum, o) => sum + o.amount, 0);

// 2. Calculate adjustments
const refunds = sumByTransactionType('refund');      // Full + Partial
const damage = sumByTransactionType('damage');       // Full + Partial
const returns = sumByTransactionType('return');      // Inventory-only (not in profit)
const recovered = sumByTransactionType('recovered'); // Unpaid payments collected

// 3. Calculate revenue (base for profit)
const totalRevenue = completedOrderAmount - refunds - damage;

// 4. Calculate net profit
const netProfit = totalRevenue 
  - refunds                    // Already deducted above, but shown separately
  - damage                     // Already deducted above, but shown separately
  + recovered                  // Add back payments from unpaid
  - totalExpenses;

// Simplified (non-redundant):
const netProfit = completedOrderAmount
  - refunds
  - damage
  + recovered
  - totalExpenses;
```

### Example Scenarios

#### Scenario 1: Simple Order with Partial Refund
```
Completed orders:  ₱1,000
Partial refund:    -₱200   (customer wants money back)
Damage:            ₱0
Recovered:         ₱0
Expenses:          ₱0

Net Profit = ₱1,000 - ₱200 = ₱800
```

#### Scenario 2: Order with Return & Damage
```
Completed orders:  ₱1,000
Refunds:           ₱0      (no cash refund)
Damage:            -₱100   (broken item, cash loss)
Returns:           2 units (inventory restored, NOT in calculation)
Recovered:         ₱0
Expenses:          -₱50

Net Profit = ₱1,000 - ₱100 - ₱50 = ₱850
Returns: 2 units ← only affects inventory, not profit
```

#### Scenario 3: Unpaid & Recovered
```
Completed orders:  ₱1,000
Refunds:           ₱0
Damage:            ₱0
Unpaid orders:     ₱300   (customer hasn't paid)
Recovered:         +₱300  (customer finally paid)
Expenses:          ₱0

Available Revenue = ₱1,000 - ₱300 + ₱300 = ₱1,000
Net Profit = ₱1,000 + ₱300 - ₱0 = ₱1,000 ✅ (recovered payment added)
```

---

## Dashboard Metrics

### Display on Dashboard

```
₱750
Total Revenue
├─ = SUM(completed.amount) - refunds - damage
└─ Returns excluded (inventory-only)

Orders: (1)
├─ = COUNT(completed orders)
└─ Only count completed

Items: (6)
├─ = SUM(completed orders.quantity)
└─ Only count completed

Returns: ₱0 (0 units)
├─ Inventory restored
└─ No revenue impact

Refunds: ₱200
├─ Cash returned to customers
└─ Deducted from profit

Damage: ₱50
├─ Lost goods
└─ Deducted from profit

Unpaid: ₱300
├─ Outstanding payment
└─ Reduces available cash

Recovered: ₱0
├─ Payments collected from unpaid
└─ Added to net profit

₱800
Net Profit
├─ = Revenue - Refunds - Damage + Recovered - Expenses
└─ Returns NOT included
```

---

## Implementation Notes

### SQL/Firestore Query Pattern
```typescript
// Calculate revenue for completed orders
const completedTotal = await db.collection('orders')
  .where('status', '==', 'completed')
  .get()
  .then(snapshot => snapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0));

// Get adjustments from separate collection (refunds, returns, damage)
const refunds = await db.collection('adjustments')
  .where('type', '==', 'refund')
  .where('storeId', '==', storeId)
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .get()
  .then(snapshot => snapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0));

// Net profit calculation
const netProfit = completedTotal - refunds - damage + recovered - expenses;
```

### Filtering by Date Range
All calculations should support date range filtering (today, last 7 days, last 30 days, etc.).

---

## Status Definitions

- **completed**: Order finalized and paid. Includes in revenue.
- **open**: Pay-later or open receivable sale. Stock is deducted and the amount is tracked as outstanding, but it does not count as revenue yet.
- **unpaid**: Payment still not received on a completed sale; tracked separately.
- **recovered**: Payment received on a previously unpaid order. Adds to profit.
- **refund**: Customer refund issued (full or partial amount).
- **return**: Item(s) returned to inventory (no cash impact).
- **damage**: Item(s) lost/damaged (both cash and inventory loss).

---

## Version History
- **2026-08-30**: Initial financial calculation documentation created
