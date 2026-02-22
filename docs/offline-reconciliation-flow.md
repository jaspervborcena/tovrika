# Offline Reconciliation Flow

This flowchart documents how manual offline reconciliation works in the current app implementation.

```mermaid
flowchart TD
    A[Cashier processes order while offline] --> B[POS writes sales entries to ordersSellingTracking\nstatus=processing\n_offlineCreated=true]
    B --> C[Some side effects may be skipped or partial\nFIFO/ledger can be missing]

    C --> D[User opens Offline Reconciliation page]
    D --> E[Select Store + Date Range]
    E --> F[OfflineReconciliationService.findDiscrepancies]

    F --> G[Load tracking entries\nordersSellingTracking]
    F --> H[Load accounting entries\norderAccountingLedger]
    F --> I[Check inventory deductions\ninventoryTracking]

    G --> J{Per order: issues found?}
    H --> J
    I --> J

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

    U --> V[Refresh discrepancies + summary in UI]
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
- Current UI/actions require connectivity to query and apply reconciliation updates.
