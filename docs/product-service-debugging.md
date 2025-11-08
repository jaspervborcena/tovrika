# ProductService Debugging Guide

## Changes Made

### 1. Updated POS Component to Use New ProductService API

**Before (causing issues):**
```typescript
// Old deprecated methods
await this.productService.loadProductsByCompanyAndStore(companyId, storeId);
const prods = this.productService.getProducts();
```

**After (fixed):**
```typescript
// New signal-based API
await this.productService.initializeProducts(storeId);
const prods = this.productService.getProductsSignal()();
```

### 2. Added Debug Logging

The ProductService now logs:
- 🔄 When `loadProductsRealTime` is called
- 🔑 Authentication details (user email, companyId, storeId)
- 📨 Firestore snapshot updates (document count, cache status)
- ➕ Individual product additions
- ✅ Final cache update with product count and categories

### 3. Updated Product Reactive Computing

```typescript
readonly products = computed(() => {
  const prods = this.productService.getProductsSignal()();
  console.log('🔍 PRODUCTS COMPUTED - Count:', prods.length);
  return prods;
});
```

## Debugging Steps

1. **Open Browser DevTools Console**
2. **Navigate to POS page**
3. **Look for these log messages:**

   - `🔄 ProductService.loadProductsRealTime called` - Service is being called
   - `🔑 Authentication details` - User is authenticated with proper company/store
   - `📨 Firestore snapshot update received` - Firestore is responding
   - `➕ Product added` - Individual products are being processed
   - `✅ Products cache updated` - Final count of products loaded
   - `🔍 PRODUCTS COMPUTED` - UI is getting the products

## Expected Firestore Query

The service should query:
```
collection: products
filters: 
  - companyId == [user's company]
  - storeId == [selected store]
  - status == 'active'
orderBy: productName
limit: 100
```

## Common Issues to Check

1. **No Authentication**: Check if user is properly logged in
2. **No storeId**: Ensure a store is selected before loading products
3. **Empty Collection**: Check if products exist in Firestore with correct fields
4. **Firestore Rules**: Ensure user has read access to products collection
5. **Network Issues**: Check if Firestore connection is working

## Test Data Requirements

Ensure Firestore has products with this structure:
```json
{
  "productName": "Test Product",
  "companyId": "user-company-id",
  "storeId": "selected-store-id", 
  "status": "active",
  "sellingPrice": 10.99,
  "category": "General",
  "totalStock": 100
}
```