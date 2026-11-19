# Inventory Reconciliation

This guide describes the reconciliation page at `/dashboard/reconciliation` and the inventory repair action currently implemented in the Angular app. The page uses authenticated summary/details APIs to find discrepancies. The **Fix inventory** action is client-triggered and runs the existing FIFO sale-line processor against Firestore. This is not a scheduled or callable Cloud Function workflow.

## What the page shows

The page requires an internet connection and a selected store and date range. It provides date-period and severity filters, invoice-level discrepancy counts, and a detail dialog.

The summary API (`reconciliationSummaryApi` in `src/environments/environment.ts` and `environment.prod.ts`) is requested with `storeId`, `from`, and `to`. Its rows provide invoice number/date/cashier, totals, sales and inventory quantities, issue counts, and severity. The client calculates the summary cards from those rows.

The invoice-details API (`reconciliationInvoiceDetailsApi`) is requested with `storeId` and `invoiceNumber`. It provides item-level sales quantity/amount, inventory quantity, difference, issue type, and matching `inventoryTracking` rows. The APIs return no Firestore order ID, so the repair action separately resolves the invoice in Firestore.

Issue codes displayed by the UI:

| Code | Meaning |
| --- | --- |
| `NO_INVENTORY` | A stock-tracked sale item has no matching inventory quantity in the details response. |
| `QTY_MISMATCH` | The inventory quantity differs from the sales quantity. |
| `OK` | Item-level details report no discrepancy. |

Severity (`critical` or `high`) is supplied by the summary API; the client displays and filters it.

## Fix inventory action

The detail dialog offers **Fix inventory** only for `NO_INVENTORY` rows. It is disabled while a repair is running or when the device is offline. A standard confirmation dialog warns that the repair may process other eligible tracked sale lines on the same invoice.

After confirmation:

1. The client queries Firestore `orders` by `invoiceNumber` and `storeId`, limited to two results. No match or multiple matches stops the repair without changing inventory.
2. The service calls `processPendingInventoryForOrder(orderId, { trackedOnly: true })`.
3. That method reads `ordersSellingTracking` for the whole order, then selects completed rows with `isStockTracked === true`, ordered oldest-first by `createdAt` and then line index.
4. It checks matching `inventoryTracking` ledger rows. A complete ledger quantity is skipped to avoid deducting the line again. A partial ledger quantity is reported as an error rather than topped up.
5. Remaining lines go through the same atomic FIFO transaction used by normal online sale processing. It validates the product and eligible batches, allocates oldest active batches first, and writes the product/batch updates, inventory ledger rows, and deterministic `inventorySaleLocks` record together.
6. If at least one line was processed and there were no errors, the client writes a `reconciliationAuditLog` entry. The page then refreshes the summary and item details. If the discrepancy remains, it displays a warning to inspect the batches and ledger. A zero-processed result is reported separately and does not create a success audit entry.

FIFO order is based on batch `receivedAt` (falling back to `createdAt`), with document ID as a tie-breaker. Batch planning also accounts for `pendingBatchDeductionQty`.

The action operates at **order scope**, not just the clicked item. It can therefore process other unprocessed, completed, tracked lines on that invoice. It does not create stock or repair a `QTY_MISMATCH` by force.

## Online and offline behavior

- **Online checkout:** tracked completed sale lines are processed through FIFO. The POS has a stock validation step and the transaction rechecks stock before committing. A failed inventory operation can leave the sale recorded with inventory pending; the POS provides an inventory-only retry path.
- **Offline checkout:** sale lines are queued in the app-managed SQLite `offline_documents` store. No server batch reservation or FIFO deduction occurs while offline.
- **Reconnect:** offline orders are synced before other queued documents; the sync service remaps related order IDs. After successful sale-line sync, an `OrdersSellingTrackingService` listener attempts inventory processing for completed lines with an explicit boolean `isStockTracked` value.
- **Reconciliation page and Fix inventory:** both require connectivity. The page does not perform offline repairs.

See [offline-reconciliation-flow.md](offline-reconciliation-flow.md) for the sale/sync/FIFO flow diagram.

## Operational limitations and troubleshooting

- **Insufficient batch quantity:** the repair does not invent stock. Confirm the correct active batches exist in `productInventory`, their `productId` and `storeId` match, quantities are numeric, and the product summary agrees with the available batches.
- **Missing stock-tracking flag:** only rows explicitly marked `isStockTracked: true` are selected for this repair. A sale payload that omits the flag can be stored as `false` by the sale-tracking writer and will not be repaired by this action.
- **Partial processing:** each sale line has its own transaction. If a later line fails, earlier lines may already be committed; the error message reports the processed count. Recheck the invoice before retrying.
- **Existing partial ledger or lock:** complete ledger quantities and existing deterministic locks prevent duplicate deductions. Partial ledger entries are not automatically completed; investigate and correct them deliberately.
- **API vs Firestore mismatch:** the discrepancy summary/details come from APIs while the repair resolves the invoice and inventory from Firestore. If the API reports an invoice that is absent or duplicated in the selected store's Firestore data, the repair will stop or may not clear the displayed discrepancy.
- **Status fields:** successful FIFO processing updates `orders.inventoryStatus`; the repair does not update reconciliation flags on every `orderDetails` document.
- **Empty processing result:** the sale-line processor can set `orders.inventoryStatus` to `applied` when it found no errors, even if it found no eligible lines. The reconciliation action still reports “no unprocessed completed tracked sale lines” when nothing was processed or skipped.
- **Audit logging:** an audit write failure is logged, but does not roll back a successful FIFO transaction.
- **No eligible lines:** if no unprocessed completed tracked rows are found, the action reports that there is nothing to process or that ledger/lock records already exist.

## Relevant implementation

- UI, filters, confirmation dialog, and refresh: `src/app/pages/dashboard/reconciliation/`
- API loading and invoice repair orchestration: `src/app/services/reconciliation.service.ts`
- Pending sale-line selection, ledger checks, and FIFO transaction: `src/app/services/orders-selling-tracking.service.ts`
- Offline document sync and post-sync listeners: `src/app/core/services/offline-document.service.ts`
- FIFO batch planning: `src/app/services/inventory-fifo.utils.ts`
- Response and audit interfaces: `src/app/interfaces/reconciliation.interface.ts`
