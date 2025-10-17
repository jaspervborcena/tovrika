# Price and Quantity Tracking Implementation

## Overview
Complete implementation of price and quantity change tracking for products in the POS system. Tracks all price changes and quantity adjustments with full audit trail.

## Schema Changes

### Product Interface Updates

```typescript
export interface Product {
  // ... existing fields ...
  
  // NEW: Price and Quantity Tracking
  priceHistory?: PriceChange[];
  quantityAdjustments?: QuantityAdjustment[];
  lastUpdated?: Date;
}

export interface PriceChange {
  oldPrice: number;
  newPrice: number;
  changeType: 'increase' | 'decrease' | 'initial';
  changeAmount: number;
  changePercentage: number;
  changedAt: Date;
  changedBy: string;  // uid
  changedByName: string;
  reason?: string;
  batchId?: string;  // If price change is for specific batch
}

export interface QuantityAdjustment {
  batchId: string;
  oldQuantity: number;
  newQuantity: number;
  adjustmentType: 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer';
  adjustedAt: Date;
  adjustedBy: string;  // uid
  adjustedByName: string;
  reason?: string;
  notes?: string;
}
```

## Firestore Collection Structure

### Products Collection
```
products/{productId}
```

**Document Fields:**
```json
{
  "productName": "Sticky Notes",
  "sellingPrice": 1.99,
  "totalStock": 60,
  "inventory": [
    {
      "batchId": "250826-09",
      "quantity": 20,
      "unitPrice": 1.75,
      "costPrice": 1.00,
      "receivedAt": "2025-08-26T00:00:00Z",
      "status": "active"
    },
    {
      "batchId": "251015-01",
      "quantity": 40,
      "unitPrice": 2.25,
      "costPrice": 1.20,
      "receivedAt": "2025-10-15T18:30:00Z",
      "status": "active"
    }
  ],
  "priceHistory": [
    {
      "oldPrice": 1.75,
      "newPrice": 2.25,
      "changeType": "increase",
      "changeAmount": 0.50,
      "changePercentage": 28.57,
      "changedAt": "2025-10-15T18:30:00Z",
      "changedBy": "user123uid",
      "changedByName": "John Doe",
      "reason": "Supplier cost increase",
      "batchId": "251015-01"
    }
  ],
  "quantityAdjustments": [
    {
      "batchId": "250826-09",
      "oldQuantity": 60,
      "newQuantity": 20,
      "adjustmentType": "transfer",
      "adjustedAt": "2025-10-15T18:30:00Z",
      "adjustedBy": "user123uid",
      "adjustedByName": "John Doe",
      "reason": "Moved 40 units to new batch at updated price",
      "notes": "Split from batch 250826-09"
    }
  ],
  "lastUpdated": "2025-10-15T18:30:00Z"
}
```

## Service Methods

### 1. Update Product Price
```typescript
await productService.updateProductPrice(
  productId: string,
  newPrice: number,
  reason?: string,
  batchId?: string  // Optional: update specific batch price
);
```

**Example:**
```typescript
// Update main selling price
await productService.updateProductPrice(
  'prod123',
  2.99,
  'Market price adjustment'
);

// Update specific batch price
await productService.updateProductPrice(
  'prod123',
  2.25,
  'New supplier price',
  '251015-01'
);
```

### 2. Adjust Batch Quantity
```typescript
await productService.adjustBatchQuantity(
  productId: string,
  batchId: string,
  newQuantity: number,
  adjustmentType: 'manual' | 'sale' | 'return' | 'damage' | 'restock' | 'transfer',
  reason?: string,
  notes?: string
);
```

**Example:**
```typescript
await productService.adjustBatchQuantity(
  'prod123',
  '250826-09',
  20,  // Reduce from 60 to 20
  'transfer',
  'Moved units to new batch',
  'Split from batch 250826-09'
);
```

### 3. Split Batch (Advanced)
```typescript
await productService.splitBatch(
  productId: string,
  sourceBatchId: string,
  quantityToMove: number,
  newBatchPrice: number,
  reason?: string
);
```

**Example:**
```typescript
// Move 40 units from existing batch to new batch at new price
await productService.splitBatch(
  'prod123',
  '250826-09',  // Source batch
  40,           // Quantity to move
  2.25,         // New price for new batch
  'Adjusted for supplier cost increase'
);
```

**What it does:**
1. Reduces quantity in source batch from 60 to 20
2. Creates new batch with 40 units at ₱2.25
3. Logs quantity adjustment in source batch
4. Logs price change for new batch
5. Updates total stock

### 4. Get History
```typescript
// Get all price changes for a product
const priceHistory = productService.getPriceHistory(productId);

// Get all quantity adjustments for a product
const quantityAdjustments = productService.getQuantityAdjustments(productId);

// Get adjustments for specific batch
const batchAdjustments = productService.getBatchAdjustments(productId, batchId);
```

## Usage Examples

### Example 1: Update Price for Existing Batch
```typescript
// Scenario: Sticky Notes batch 250826-09 price increases
await productService.updateProductPrice(
  'stickyNotesProdId',
  2.25,
  'Supplier cost increase',
  '250826-09'
);
```

### Example 2: Split Batch with Price Change
```typescript
// Scenario: "Update Sticky Notes: reduce batch 250826-09 to 20 units, 
//           move 40 units to new batch at ₱2.25"
await productService.splitBatch(
  'stickyNotesProdId',
  '250826-09',    // Original batch
  40,             // Units to move
  2.25,           // New price
  'Reallocated 40 units to new batch at updated price'
);

// Result:
// - Batch 250826-09: 20 units at ₱1.75
// - New batch 251015-01: 40 units at ₱2.25
// - Total stock: 60 units
// - Logged in quantityAdjustments and priceHistory
```

### Example 3: Manual Quantity Adjustment (Damage/Loss)
```typescript
await productService.adjustBatchQuantity(
  'prod123',
  '250826-09',
  15,  // Reduce from 20 to 15
  'damage',
  'Water damage during storage',
  '5 units damaged and discarded'
);
```

### Example 4: Restock Adjustment
```typescript
await productService.adjustBatchQuantity(
  'prod123',
  '251015-01',
  50,  // Increase from 40 to 50
  'restock',
  'Additional inventory received',
  'Same supplier, same batch extended'
);
```

## AI Agent Integration

Your AI agent can now understand commands like:

**Command:**
> "Update Sticky Notes: reduce batch 250826-09 to 20 units, move 40 units to new batch at ₱2.25"

**Agent Action:**
```typescript
await productService.splitBatch(
  await findProductByName('Sticky Notes'),
  '250826-09',
  40,
  2.25,
  'Reallocated 40 units to new batch at updated price'
);
```

**Command:**
> "Mark 5 units of batch 250826-09 as damaged"

**Agent Action:**
```typescript
const product = await findProductByName('Sticky Notes');
const batch = product.inventory.find(inv => inv.batchId === '250826-09');
await productService.adjustBatchQuantity(
  product.id,
  '250826-09',
  batch.quantity - 5,
  'damage',
  'Marked as damaged per user request'
);
```

## Audit Trail Features

### What Gets Tracked
✅ **Price Changes**
- Old and new price
- Change amount and percentage
- Who made the change
- When it was changed
- Reason for change
- Specific batch (if applicable)

✅ **Quantity Adjustments**
- Old and new quantity
- Adjustment type (manual, sale, return, damage, restock, transfer)
- Who made the adjustment
- When it was adjusted
- Reason and notes

### Benefits
1. **Complete History**: Never lose track of price or quantity changes
2. **Accountability**: Know who made each change
3. **Audit Trail**: Meet compliance requirements
4. **Analytics**: Track pricing trends and inventory movements
5. **Debugging**: Easily identify when and why discrepancies occurred

## Backward Compatibility

- ✅ `priceHistory` and `quantityAdjustments` are **optional** fields
- ✅ Existing products without these fields will work normally
- ✅ History starts accumulating when you first use the tracking methods
- ✅ No migration required for existing data

## Next Steps

1. **UI Integration**: Create components to display price and quantity history
2. **Reports**: Build analytics dashboards showing price trends
3. **Alerts**: Notify when quantities drop below thresholds
4. **Bulk Operations**: Add methods for bulk price/quantity updates
5. **Export**: Add CSV/Excel export for audit reports

## Testing

```typescript
// Test price update
const product = await productService.getProduct('prod123');
await productService.updateProductPrice('prod123', 2.99, 'Test price change');
const history = productService.getPriceHistory('prod123');
console.log('Price history:', history);

// Test quantity adjustment
await productService.adjustBatchQuantity(
  'prod123',
  'batch001',
  50,
  'manual',
  'Test adjustment'
);
const adjustments = productService.getQuantityAdjustments('prod123');
console.log('Quantity adjustments:', adjustments);

// Test batch split
await productService.splitBatch('prod123', 'batch001', 20, 3.50, 'Test split');
```

## Security Considerations

- ✅ User authentication required (uses `authService.getCurrentUser()`)
- ✅ User UID and name tracked in all changes
- ✅ Timestamp automatically set (no manual date manipulation)
- ✅ Changes are append-only (history cannot be modified)
- ⚠️ Consider adding role-based permissions for price changes

## Status

✅ **IMPLEMENTED**
- Product interface updated with tracking fields
- Service methods created for all operations
- Transform methods for Firestore data
- Complete audit trail functionality
- Backward compatibility maintained

🔄 **TODO**
- UI components for history display
- Analytics dashboard
- Export functionality
- Role-based permissions

---

**Implementation Date:** October 15, 2025  
**Feature Branch:** `feature/categoryAndProductInventory`
