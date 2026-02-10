# Inventory Tracking Event Type Implementation

## Overview
Added `eventType` field to all `inventoryTracking` collection records to track the type of inventory movement: `completed`, `damage`, or `restock`.

## Changes Made

### 1. Created Interface Definition
**File**: [src/app/interfaces/inventory-tracking.interface.ts](src/app/interfaces/inventory-tracking.interface.ts)
- Defined `InventoryEventType` type with three possible values: `'completed' | 'damage' | 'restock'`
- Created comprehensive `InventoryTracking` interface with all fields
- Added `CreateInventoryTracking` partial type for new records

### 2. Updated Services

#### **fifo-inventory.service.ts**
- Added `eventType: 'completed'` to deduction records created during FIFO inventory allocation
- These records track inventory deductions when orders are completed

#### **pos.service.ts**
- Added `eventType: 'completed'` to POS FIFO deduction records
- Tracks inventory movements during point-of-sale transactions

#### **inventory-transaction.service.ts**
- Added `eventType: 'completed'` to deduction records in the master transaction service
- Maintains consistency across all inventory transaction operations

#### **orders-selling-tracking.service.ts**
- Added `eventType: 'damage'` to all damage-related inventory tracking records:
  - Damaged items with batch tracking
  - Damaged items without batch tracking
  - markOrderTrackingDamaged operations
- Added `eventType: 'completed'` to order completion records:
  - Non-batch product sales
  - Batch-tracked product sales

#### **inventory-data.service.ts**
- Added `eventType: 'restock'` tracking when new inventory batches are added
- Creates an inventoryTracking record after successful batch creation
- Records include full product and batch details for audit trail

## Event Type Definitions

### `completed`
- **When**: Order is completed and inventory is deducted
- **Context**: Normal sales transactions
- **Services**: fifo-inventory, pos, inventory-transaction, orders-selling-tracking

### `damage`
- **When**: Items are marked as damaged or lost
- **Context**: Damaged goods, expired items, or other inventory losses
- **Services**: orders-selling-tracking

### `restock`
- **When**: New inventory is added via batch creation
- **Context**: Receiving new stock, restocking operations
- **Services**: inventory-data

## Database Schema

All `inventoryTracking` documents now include:
```typescript
{
  eventType: 'completed' | 'damage' | 'restock',
  productId: string,
  batchId: string | null,
  quantity: number,
  companyId: string,
  storeId: string,
  orderId?: string,  // For completed/damage events
  deductedAt: Date,
  createdAt: Date,
  // ... other fields
}
```

## Benefits

1. **Better Reporting**: Can now filter inventory movements by event type
2. **Audit Trail**: Clear distinction between sales, damages, and restocks
3. **Analytics**: Easier to track loss patterns, restock frequency, and sales velocity
4. **Compliance**: Improved inventory accounting and tracking

## Migration Notes

- Existing `inventoryTracking` records without `eventType` will need to be classified based on context:
  - Records with `orderId` and no damage indicators → `completed`
  - Records with damage notes → `damage`
  - Would need manual migration or accept as legacy records

## Testing Recommendations

1. Test order completion to verify `eventType: 'completed'` is recorded
2. Test damage marking to verify `eventType: 'damage'` is recorded
3. Test inventory batch addition to verify `eventType: 'restock'` is recorded
4. Verify queries can filter by `eventType`
5. Check that all tracking records include the required fields
