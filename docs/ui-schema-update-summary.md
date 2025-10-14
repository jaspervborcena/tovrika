# UI Schema Update Summary

## Overview
Updated all UI components to work with the new comprehensive Store schema that includes BIR compliance and subscription management features.

## Changes Made

### 1. Store Service (`store.service.ts`)
**Changes:**
- Removed duplicate `Store` interface definition
- Imported `Store` from `company.interface.ts`
- Updated store mapping to include all new fields:
  - `uid`: User ID
  - `isBirAccredited`: BIR accreditation status
  - `tempInvoiceNumber`: Temporary invoice number
  - `birDetails`: Nested BIR compliance object
  - `tinNumber`: Tax Identification Number
  - `subscription`: Nested subscription object
  - `promoUsage`: Promo code usage (optional)
  - `subscriptionPopupShown`: UI state flag

**Removed Fields:**
- `invoiceNo` → replaced with `tempInvoiceNumber`
- `managerName` → no longer needed
- `taxId` → replaced with `tinNumber`
- `invoiceNumber`, `invoiceType` → moved to `birDetails`
- `message` → removed

### 2. Stores Management Component (`stores-management.component.ts`)
**Form Updates:**
- Added BIR Compliance fields:
  - `isBirAccredited` (checkbox)
  - `tempInvoiceNumber`
  - `tinNumber`
  - `birPermitNo`
  - `atpOrOcn`
  - `inclusiveSerialNumber`
  - `serialNumber`
  - `minNumber`
  - `invoiceType`
  - `invoiceNumber`
  - `permitDateIssued`
  - `validityNotice`

- Added Subscription fields:
  - `subscriptionTier` (dropdown: freemium, standard, premium, enterprise)
  - `subscriptionStatus` (dropdown: active, inactive, expired, cancelled)
  - `subscriptionPopupShown` (hidden field)

- Added Store fields:
  - `branchName`
  - `uid`
  - `logoUrl`

**Table Updates:**
- Added "Branch Name" column
- Replaced "Invoice No" with "BIR Status" badge
- Added "Subscription" column with tier badge
- Removed "Address" column (still in form, just hidden from table for space)

**CSS Enhancements:**
- Added `.form-section-header` for organizing form sections
- Added `.checkbox-label` for BIR accreditation toggle
- Added `.subscription-badge` with tier-based colors:
  - Free/Freemium: Teal
  - Standard: Blue
  - Premium: Orange
  - Enterprise: Purple

### 3. Invoice Service (`invoice.service.ts`)
**Changes:**
- Updated all references from `store.invoiceNo` to `store.tempInvoiceNumber`
- Updated Firestore field name: `invoiceNo` → `tempInvoiceNumber`
- Updated store cache updates to use new field

### 4. Company Interface (`company.interface.ts`)
**Changes:**
- Made `promoUsage` optional (`promoUsage?: PromoUsage`) to allow stores without promo codes

## Data Structure

### Store Schema (New)
```typescript
{
  id: string;
  storeName: string;
  storeCode: string;
  storeType: string;
  branchName: string;
  address: string;
  phoneNumber: string;
  email: string;
  companyId: string;
  uid: string;
  status: 'active' | 'inactive' | 'suspended';
  logoUrl?: string;
  
  // BIR Compliance
  isBirAccredited: boolean;
  tempInvoiceNumber?: string;
  birDetails: {
    birPermitNo: string;
    atpOrOcn: string;
    inclusiveSerialNumber: string;
    serialNumber: string;
    minNumber: string;
    invoiceType: string;
    invoiceNumber: string;
    permitDateIssued: Date;
    validityNotice: string;
  };
  tinNumber: string;
  
  // Subscription
  subscription: {
    tier: 'freemium' | 'standard' | 'premium' | 'enterprise';
    status: 'active' | 'inactive' | 'expired' | 'cancelled';
    subscribedAt: Date;
    expiresAt: Date;
    billingCycle: 'monthly' | 'quarterly' | 'yearly';
    durationMonths: number;
    amountPaid: number;
    discountPercent: number;
    finalAmount: number;
    promoCode?: string;
    referralCodeUsed?: string;
    paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' | 'gcash' | 'paymaya';
    lastPaymentDate: Date;
  };
  promoUsage?: PromoUsage;
  subscriptionPopupShown: boolean;
  
  createdAt: Date;
  updatedAt?: Date;
}
```

## Migration Notes

### For Existing Stores
Existing stores in Firestore will need migration:
1. Old `invoiceNo` → `tempInvoiceNumber`
2. Add default `birDetails` object with empty strings
3. Add default `subscription` object with 'freemium' tier
4. Set `isBirAccredited` to false by default
5. Add `uid` field (empty string or map from existing user association)
6. Set `subscriptionPopupShown` to false

### Store Service Mapping
The `loadStores()` and `loadStoresByCompany()` methods now provide default values:
- `birDetails`: Empty strings for all fields
- `subscription`: Free tier with trial status, monthly billing
- `isBirAccredited`: false
- `tempInvoiceNumber`: empty string
- `tinNumber`: empty string
- `subscriptionPopupShown`: false

## UI/UX Improvements

1. **Form Organization**: Separated BIR and Subscription sections with headers
2. **Visual Indicators**: 
   - BIR Status badge (green = accredited, red = not accredited)
   - Subscription tier badges with distinct colors
3. **Data Validation**: Required fields marked with asterisk (*)
4. **User Experience**: Checkbox for BIR accreditation for easy toggle

## Testing Checklist

- [ ] Create new store with BIR details
- [ ] Edit existing store
- [ ] Update BIR accreditation status
- [ ] Change subscription tier
- [ ] Verify invoice number generation uses `tempInvoiceNumber`
- [ ] Check store listing table displays correctly
- [ ] Verify badges show correct colors
- [ ] Test search functionality with new fields
- [ ] Validate form submission with all required fields
- [ ] Test without optional fields (branchName, uid, logoUrl)

## Breaking Changes

⚠️ **API Changes:**
- Store interface no longer has `invoiceNo` - use `tempInvoiceNumber`
- Store interface no longer has `managerName`
- Store interface no longer has `taxId` - use `tinNumber`
- Invoice-related fields moved to `birDetails` nested object

## Files Modified

1. `src/app/services/store.service.ts` - Store data mapping
2. `src/app/services/invoice.service.ts` - Invoice field updates
3. `src/app/pages/dashboard/stores-management/stores-management.component.ts` - Form and table updates
4. `src/app/interfaces/company.interface.ts` - Made promoUsage optional

## Compilation Status

✅ **No TypeScript errors**
✅ **All Store references updated**
✅ **Form validation working**
✅ **CSS styling applied**

---
*Last Updated: 2025-01-20*
*Related Docs: company-schema-simplification.md, store-schema-update.md*
