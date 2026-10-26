# Offline Reconciliation Flow

This flow documents the intended sale-line inventory workflow. A completed sale line in `ordersSellingTracking` is the inventory work source for stock-tracked products. It is not given a separate inventory status or copied to a separate request collection. A deterministic `inventorySaleLocks` record means that line's FIFO deduction and audit writes committed successfully. `inventoryTracking` remains the audit of actual movements, with one row per batch allocation.

```mermaid
flowchart TD
    A[Cashier completes and pays order] --> B[Persist sale lines in ordersSellingTracking]
    B --> C{Line isStockTracked?}
    C -- No --> D[Keep sales record; skip inventory deduction and inventory lock]
    C -- Yes --> E{Online?}
    E -- Yes --> F[Read completed sale lines oldest-first]
    E -- No --> G[Queue sale lines in SQLite offline document storage]
    G --> H[Sync sale lines to Firestore when connectivity returns]
    H --> F

    F --> R{Processing completes within 15 seconds?}
    R -- No --> S[Keep payment/order complete; show inventory-pending notice and manual retry]
    R -- Yes --> I{Deterministic inventorySaleLocks record exists?}
    I -- Yes --> J[Skip; line was already processed]
    I -- No --> K[Read eligible productInventory batches]
    K --> L[Plan FIFO allocations by received time]
    L --> M{Enough batch quantity?}
    M -- No --> N[Leave without lock; report for reconciliation/retry]
    M -- Yes --> O[Atomic transaction: decrement batches,\nwrite one inventoryTracking row per allocation,\nwrite per-sale-line inventorySaleLocks record]
    O --> P[Line is processed; retry skips it]

    N --> Q[Cashier or manager retries during shift close\nor before next shift]
    Q --> F
```

## Key collections involved
- `ordersSellingTracking` (completed sale lines and source work records; no inventory-status field is required)
- `inventorySaleLocks` (idempotency/completion marker per tracked sale line; created in the same transaction as the deduction and audit rows)
- `inventoryTracking` (actual stock-movement audit, one row per allocated batch, linked to order and item code)
- `productInventory` (batch stock source of truth and FIFO deduction target)
- SQLite `offline_documents` (durable local copy of sale-line documents waiting to sync)
- `orderAccountingLedger`, `orderDetails`, and `reconciliationAuditLog` (accounting and broader reconciliation workflow)

## Notes
- Inventory work applies only when `isStockTracked === true`. Non-stock-tracked sale lines remain sales records and do not create batch deductions or inventory-sale locks.
- `itemCode` identifies the product. A particular sale line is identified by its order and line index; locks and audit entries must not be keyed only by item code, because one product can be sold repeatedly.
- A line is processed only if its exact lock exists. The lock must be written atomically with all batch quantity updates and `inventoryTracking` allocation rows, so a failed transaction leaves the line retryable and a successful retry cannot deduct twice.
- FIFO can split a sale line across several batches. Each allocation records that batch's `batchId`, document `refId`, quantity, and unit cost. Summing those allocation quantities for the exact sale line should equal the sold quantity.
- Offline sales must first be durably saved as completed sale-line documents in SQLite. After sync, processing can read completed tracked lines oldest-first and skip lines with an existing lock. If inventory cannot be processed, leave the line unlocked and report it for shift-close or next-shift reconciliation.
- Offline checkout queues sale-line records but does not read or deduct inventory. The reconnect sync triggers FIFO processing after those lines reach Firestore.
- Online checkout waits up to 15 seconds for inventory processing. A timeout does not undo or repeat payment: it shows a pending notice with a manual inventory-only retry action. Deterministic locks make retry safe if the original transaction finishes late.
- The order-level inventory status is marked `applied` only after every tracked sale line finishes without errors, not after the first line.
- This design does not use an `inventoryDeductionRequests` collection or an inventory-status field on `ordersSellingTracking`.
- Summary requests use the configured `reconciliationSummaryApi` and a Firebase ID token; a missing token or unsuccessful API response is reported to the user.
- Reconciliation searches and processing require connectivity. Offline capture itself must not depend on Firestore transactions.
