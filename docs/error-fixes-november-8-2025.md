# Error Fixes - November 8, 2025

## Issues Identified and Fixed

### 1. 404 Errors on API Endpoints (Fixed ✅)

**Problem**: Requests to `:4200/api?storeId=...` and similar URLs were getting 404 errors.

**Root Cause**: The `order.service.ts` had hardcoded `/api` as a fallback URL in the API URL array, but the proxy configuration only handles `/api/orders` and `/api/logs`.

**Files Changed**:
- `src/app/services/order.service.ts` (lines 638 and 757)

**Fix Applied**:
```typescript
// Before (causing 404s)
const rawUrls = ['/api', environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);

// After (fixed)
const rawUrls = [environment.api?.ordersApi || '', environment.api?.directOrdersApi || ''].filter(Boolean);
```

### 2. CORS Issues with BigQuery APIs (Already Configured ✅)

**Problem**: CORS errors when accessing BigQuery endpoints directly.

**Status**: Already properly configured in `proxy.conf.json` with:
- `/api/orders` → `https://get-orders-by-date-bq-7bpeqovfmq-de.a.run.app`
- `/api/logs` → `https://app-logs-7bpeqovfmq-de.a.run.app`

### 3. Firestore Listen Channel 400 Errors (Improved ✅)

**Problem**: Firestore real-time listeners were causing 400 Bad Request errors, likely due to rapid subscribe/unsubscribe cycles.

**Files Changed**:
- `src/app/services/product.service.ts` (unsubscribeFromRealTimeUpdates method)

**Fix Applied**:
```typescript
private unsubscribeFromRealTimeUpdates(): void {
  if (this.unsubscribeSnapshot) {
    try {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
      this.logger.debug('Unsubscribed from real-time updates', { area: 'products' });
    } catch (error) {
      this.logger.dbFailure('Error during unsubscribe from real-time updates', { area: 'products' }, error);
      this.unsubscribeSnapshot = null; // Clear it anyway
    }
  }
}
```

## Expected Results

After these fixes:

1. **No more 404 errors** on `/api` endpoints
2. **Orders API calls** should work through proxy (`/api/orders` → BigQuery)
3. **Firestore real-time updates** should be more stable with better error handling
4. **Product management** should work correctly with Firestore real-time listeners
5. **POS functionality** should load products and orders without errors

## Technical Architecture Summary

- **Products**: Use Firestore real-time listeners (no API calls needed)
- **Orders**: Use BigQuery API through Angular proxy to avoid CORS
- **Logs**: Use cloud logging API through Angular proxy
- **Offline Support**: IndexedDB for products, Firestore persistence for real-time sync

## Verification Steps

1. Check browser console for error reduction
2. Verify product loading works in POS
3. Verify order data loads correctly
4. Test offline functionality
5. Monitor Firestore connection stability

## Next Steps

If Firestore 400 errors persist:
1. Check Firestore security rules
2. Verify authentication tokens
3. Review Firestore indexes for the product queries
4. Consider adding retry logic for failed connections