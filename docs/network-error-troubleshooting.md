# Network Error Troubleshooting Guide

## Issue
When activating a subscription, you're encountering: **"Network error. Please check your connection and try again."**

## Enhanced Error Handling

### Updated Error Catching
The error handling in `handleSubscription()` has been improved to show specific error messages:

```typescript
} catch (error: any) {
  console.error('Error activating subscription:', error);
  
  // Show specific error message
  let errorMessage = 'Failed to activate subscription. Please try again.';
  
  if (error?.code === 'permission-denied') {
    errorMessage = 'Permission denied. Please check your access rights.';
  } else if (error?.code === 'unavailable') {
    errorMessage = 'Network error. Please check your connection and try again.';
  } else if (error?.message) {
    errorMessage = `Error: ${error.message}`;
  }
  
  this.toastService.error(errorMessage);
}
```

## Common Causes & Solutions

### 1. **Firestore Permission Issues**

**Symptoms:**
- Error code: `permission-denied`
- Message: "Permission denied. Please check your access rights."

**Solutions:**
- Check Firestore Security Rules for the `stores` collection
- Verify user has write access to the store document
- Ensure companyId and storeId match security rules

**Check Rules:**
```javascript
// firestore.rules
match /stores/{storeId} {
  allow read, write: if request.auth != null && 
                        get(/databases/$(database)/documents/stores/$(storeId)).data.companyId == request.auth.token.companyId;
}
```

### 2. **Network Connectivity Issues**

**Symptoms:**
- Error code: `unavailable`
- Message: "Network error. Please check your connection and try again."
- Firestore cannot reach Firebase servers

**Solutions:**
- Check internet connection
- Verify Firebase project is active
- Check browser console for network errors
- Try refreshing the page
- Check if Firebase services are down: https://status.firebase.google.com/

### 3. **Invalid Data Structure**

**Symptoms:**
- Error in console: "Invalid document data"
- Firestore rejects the update

**Solutions:**
- Check console logs for: `📋 Subscription data to save:`
- Verify all required fields are present
- Ensure dates are valid Date objects
- Check that numbers are not NaN

**Expected Data Structure:**
```typescript
{
  subscription: {
    tier: 'standard' | 'premium' | 'freemium' | 'enterprise',
    status: 'active' | 'inactive' | 'expired',
    subscribedAt: Date,
    expiresAt: Date,
    billingCycle: 'monthly' | 'quarterly' | 'yearly',
    durationMonths: number,
    amountPaid: number,
    discountPercent: number,
    finalAmount: number,
    promoCode: string,
    referralCodeUsed: string,
    paymentMethod: string,
    lastPaymentDate: Date
  }
}
```

### 4. **Missing Store ID**

**Symptoms:**
- Console error: "Store information is missing"
- Toast: "Store information is missing. Please try again."

**Solutions:**
- Ensure store has an `id` field
- Check that `selectedStore` signal has the correct store
- Verify store is selected before opening subscription modal

### 5. **Missing Subscription Data**

**Symptoms:**
- Console error: "Missing subscription data"
- Toast: "Missing subscription details. Please try again."

**Solutions:**
- Verify subscription modal emits all required fields
- Check `tier` and `billingCycle` are included
- Ensure paymentMethod is provided

### 6. **Billing History Creation Failure**

**Symptoms:**
- Subscription updates but billing history doesn't save
- Error after subscription update succeeds

**Solutions:**
- Check `companyBillingHistory` collection exists
- Verify security rules allow writes to billing collection
- Ensure companyId is available

## Debugging Steps

### Step 1: Check Browser Console

Open Chrome DevTools (F12) and look for:

```
📋 Subscription data to save: { ... }
📋 Store ID: store_xxxxx
🔥 Firestore updateStore - Store ID: store_xxxxx
🔥 Firestore updateStore - Updates: { subscription: { ... } }
🔥 Firestore updateStore - Final data to save: { ... }
✅ Firestore document updated successfully
✅ Billing history record created
```

### Step 2: Check Network Tab

1. Open DevTools → Network tab
2. Filter by "Firestore" or "firebaseio"
3. Look for failed requests (red)
4. Check response codes:
   - **403**: Permission denied
   - **404**: Document not found
   - **503**: Service unavailable (network issue)

### Step 3: Check Firestore Console

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find the store document
4. Check if subscription field was updated
5. Check `companyBillingHistory` collection for new record

### Step 4: Verify Security Rules

1. Firebase Console → Firestore → Rules tab
2. Check rules for `stores` and `companyBillingHistory`
3. Verify rules match your security requirements

### Step 5: Check User Authentication

```typescript
// In browser console
const user = firebase.auth().currentUser;
console.log('Current user:', user);
console.log('User ID:', user?.uid);
```

## Console Logging

### Current Logs in Code

**handleSubscription() method:**
```typescript
console.log('📋 Subscription data to save:', subscriptionData);
console.log('📋 Store ID:', store.id);
```

**updateStore() in StoreService:**
```typescript
console.log('🔥 Firestore updateStore - Store ID:', storeId);
console.log('🔥 Firestore updateStore - Updates:', updates);
console.log('🔥 Firestore updateStore - Final data to save:', updateData);
console.log('✅ Firestore document updated successfully');
```

**createBillingHistory():**
```typescript
console.log('✅ Billing history record created');
```

### Check These Logs

1. **Before update**: `📋 Subscription data to save`
   - Verify data structure is correct
   - Check all fields are present
   - Ensure dates are Date objects, not strings

2. **During update**: `🔥 Firestore updateStore`
   - Verify store ID exists
   - Check update data is valid
   - Ensure no undefined values

3. **After update**: `✅ Firestore document updated`
   - If you see this, update succeeded
   - If not, check previous error

## Quick Fixes

### Fix 1: Clear Browser Cache
```
Ctrl + Shift + Delete → Clear cached images and files
```

### Fix 2: Hard Refresh
```
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)
```

### Fix 3: Check IndexedDB
```
DevTools → Application → IndexedDB → firebase-*
Clear all IndexedDB databases if needed
```

### Fix 4: Re-authenticate
```typescript
// Log out and log back in
await firebase.auth().signOut();
// Then log in again
```

### Fix 5: Verify Firebase Config
Check `src/app/firebase.config.ts`:
```typescript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Error Messages Reference

### Error Types

| Error Code | Message | Cause | Solution |
|------------|---------|-------|----------|
| `permission-denied` | "Permission denied..." | Firestore rules block access | Update security rules |
| `unavailable` | "Network error..." | Cannot reach Firebase | Check internet connection |
| `not-found` | "Document not found" | Store ID doesn't exist | Verify store exists |
| `invalid-argument` | "Invalid document data" | Data structure wrong | Check data format |
| `unauthenticated` | "User not authenticated" | Not logged in | Re-authenticate |

## Testing Procedure

### 1. Test Offline Handling
```typescript
// In browser console
// Go offline
window.dispatchEvent(new Event('offline'));

// Try to activate subscription
// Should show: "Network error. Please check your connection"

// Go back online
window.dispatchEvent(new Event('online'));
```

### 2. Test with Different Subscriptions
- Try Freemium tier (₱0)
- Try Standard tier (₱599)
- Try Premium tier (₱1,499)
- Try Enterprise (request form)

### 3. Test Different Billing Cycles
- Monthly (1 month)
- Quarterly (3 months)
- Yearly (12 months)

### 4. Test with Promo Codes
- With promo code
- Without promo code
- With referral code
- Without referral code

## Firebase Project Checklist

### ✅ Verify These Settings

1. **Firebase Project Active**
   - Project not deleted
   - Billing enabled (if required)
   - Firestore enabled

2. **Authentication Enabled**
   - Email/Password enabled
   - User is authenticated
   - Token not expired

3. **Firestore Database**
   - Database created
   - Collections exist: `stores`, `companyBillingHistory`
   - Indexes created (if needed)

4. **Security Rules**
   - Rules deployed
   - Rules allow authenticated users
   - Rules match your access pattern

5. **Network Settings**
   - No firewall blocking firebaseio.com
   - No corporate proxy issues
   - HTTPS enabled

## Monitoring & Alerts

### Set Up Firebase Monitoring

1. **Firestore Usage**
   - Monitor read/write operations
   - Check for quota limits
   - Watch for spike in errors

2. **Performance Monitoring**
   - Track subscription activation time
   - Monitor Firestore response times
   - Set up alerts for slow operations

3. **Error Tracking**
   - Integrate Sentry or similar
   - Track error rates
   - Set up notifications

## Production Checklist

Before deploying to production:

- [ ] Test all subscription tiers
- [ ] Test all billing cycles
- [ ] Test with/without promo codes
- [ ] Test error scenarios
- [ ] Verify security rules in production
- [ ] Set up error monitoring
- [ ] Test on slow network (throttle in DevTools)
- [ ] Test offline behavior
- [ ] Verify billing history saves correctly
- [ ] Test with multiple stores
- [ ] Verify toast notifications work
- [ ] Test on different browsers
- [ ] Test on mobile devices

## Support Resources

### Firebase Documentation
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Error Handling](https://firebase.google.com/docs/firestore/handle-errors)
- [Offline Data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)

### Debug Tools
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Status](https://status.firebase.google.com/)
- Chrome DevTools Network tab
- Firebase Emulator Suite (for local testing)

## Summary

The improved error handling now provides:
✅ **Specific error messages** based on error codes
✅ **Better logging** to track the subscription flow
✅ **Clear user feedback** via toast notifications
✅ **Detailed console logs** for debugging

**Next Steps:**
1. Open browser DevTools console
2. Try activating a subscription
3. Check console logs for specific error
4. Follow troubleshooting steps above
5. Report specific error code if issue persists

---

**Updated**: October 13, 2025  
**Component**: company-profile.component.ts  
**Enhancement**: Improved error handling with specific error codes
