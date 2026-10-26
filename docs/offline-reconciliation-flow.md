# Offline Reconciliation Flow

This flowchart documents the current manual offline reconciliation workflow. Completed online payments deduct FIFO batches during checkout. Offline sales skip batch writes and mark tracked lines pending for later reconciliation. Searches require connectivity and retrieve tracking summary rows through the configured reconciliation summary API.

```mermaid
flowchart TD
    A[Cashier processes order while offline] --> B[POS writes sales entries to ordersSellingTracking\nstatus=processing\n_offlineCreated=true]
    B --> C[Some side effects may be skipped or partial\nFIFO/ledger can be missing]

    C --> D[User opens Offline Reconciliation page]
    D --> E[Select Store + Date Range]
    E --> F[OfflineReconciliationService.findDiscrepancies]

    F --> G[Request authenticated summary rows\nfor store and date range]
    G --> H[Inspect offline and deferred-FIFO tracking rows]
    H --> I[Check inventory deductions\ninventoryTracking]

    I --> J{Per order: inventory issue found?}

    J -- No --> K[Not shown in discrepancy list]
    J -- Yes --> L[Build discrepancy record\nseverity + recommended actions]

    L --> M[Show in Offline Reconciliation UI]
    M --> N{User action}

    N -->|Reprocess Inventory| O[validateReprocessing]
    O --> P{Valid?}
    P -- No --> Q[Show validation errors\n(stock missing, no batches, offline, etc.)]
    P -- Yes --> R[reprocessInventory\nFIFO deduct productInventory\ncreate inventoryTracking\nupdate orderDetails flags]

    N -->|Create Ledger Entry| S[createMissingLedger\ncompute totals from tracking\nwrite orderAccountingLedger\nupdate orderDetails flags]

    N -->|Mark Reconciled| T[markAsReconciled\nset needsReconciliation=false]

    R --> U[Write reconciliationAuditLog]
    S --> U
    T --> U

    U --> V[Refresh discrepancies + summary counts in UI]
```

## Key collections involved
- `ordersSellingTracking` (source sales lines captured by POS)
- `orderAccountingLedger` (accounting totals/events)
- `inventoryTracking` (FIFO deduction evidence)
- `productInventory` (batch stock source of truth)
- `orderDetails` (reconciliation flags)
- `reconciliationAuditLog` (action history)

## Notes
- The reconciliation screen is a **manual repair workflow** for offline-captured discrepancies.
- Summary requests use the configured `reconciliationSummaryApi` and a Firebase ID token; a missing token or unsuccessful API response is reported to the user.
- The selected store and date range scope the summary request. Reprocessing uses FIFO inventory batches and refreshes the discrepancy list and summary counts afterward.
- Current UI/actions require connectivity to query and apply reconciliation updates.
