# Inventory Tracking Event Types

`inventoryTracking` documents record inventory-related activity and sale history. The `InventoryEventType` union currently defines five values in [inventory-tracking.interface.ts](src/app/interfaces/inventory-tracking.interface.ts).

## Event types

| `eventType` | Meaning | Current use |
|---|---|---|
| `completed` | A completed sale deducted inventory. | FIFO batch deductions and non-batch deductions, including order tracking, POS, and inventory transaction flows. |
| `sale` | A completed sale snapshot for a product marked as not stock-tracked. | Stores sale-line details and cost/price history without allocating FIFO batches. The current checkout flow writes `stockMovement: true` and notes that there is no FIFO batch movement; see the open follow-up in [TODO.md](TODO.md). |
| `damage` | Inventory was marked damaged or lost. | Damage-related order tracking operations, with or without a batch. |
| `restock` | A new inventory batch was added. | Batch creation in the inventory data service. |
| `update` | An existing inventory batch was changed. | Batch updates, with the old and new values stored for audit purposes. |

## Record fields

The shared `InventoryTracking` interface includes `eventType`, product and company/store identifiers, quantity, and creation time. Records can also include batch and order references, prices, stock balance, timestamps, audit users, a note, and offline sync metadata. Which optional fields are populated depends on the event type; for example, `update` records include `oldData`, while sale and deduction records may include invoice and order references.

Example shape (optional fields omitted):

```typescript
{
  eventType: 'completed' | 'sale' | 'damage' | 'restock' | 'update',
  productId: string,
  companyId: string,
  storeId: string,
  quantity: number,
  createdAt: Date
}
```

## Existing records

Older `inventoryTracking` documents may not have `eventType`; the interface describes current records and does not migrate stored data. Do not infer an event type solely from `orderId` or a note. Audit legacy documents and decide whether to backfill or continue treating them as legacy before relying on event-type filters for historical reporting.

## Verification

- Verify completed FIFO and non-batch deductions are recorded as `completed`.
- Verify non-stock-tracked completed sales produce a `sale` snapshot with sale and price details and no FIFO batch allocation.
- Verify damage, restock, and batch update operations produce `damage`, `restock`, and `update` records respectively.
- Check that reports handle legacy documents without `eventType`.
