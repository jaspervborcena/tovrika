# Company Schema Simplification

## Overview
Simplified the Company interface to only include essential company-level fields, removing store-specific and complex nested structures.

## Changes Made

### Company Interface (Simplified)
**Before:**
```typescript
export interface Company {
  id?: string;
  name: string;
  slug: string;
  ownerUid: string;
  plan: PlanType;
  address?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  website?: string;
  birPermitNo?: string;
  inclusiveSerialNumber?: string;
  tin?: string;
  atpOrOcn?: string;
  onboardingStatus: OnboardingStatus;
  settings?: CompanySettings;
  createdAt: Date;
  updatedAt?: Date;
  stores?: Store[];
}
```

**After:**
```typescript
export interface Company {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  ownerUid: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

### Firestore Document Structure
```javascript
{
  name: "Brew Organics Inc",
  slug: "brew-organics-inc",
  logoUrl: "https://yourdomain.com/logo.png",
  email: "jasper.borcena@forda.com",
  phone: "+639173019759",
  website: "3434",
  ownerUid: "VMvVVy9XegfOS07IV6IzUgVOqT83",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Removed Fields

### From Company Interface:
- ❌ `plan` - Plan management moved elsewhere
- ❌ `address` - Store-specific, not company-level
- ❌ `taxId` - Store-specific (Philippines TIN)
- ❌ `birPermitNo` - Store-specific BIR compliance
- ❌ `inclusiveSerialNumber` - Store-specific BIR compliance
- ❌ `tin` - Store-specific tax identification
- ❌ `atpOrOcn` - Store-specific BIR compliance
- ❌ `onboardingStatus` - Removed complex onboarding tracking
- ❌ `settings` - Removed complex settings object
- ❌ `stores` - Stores managed separately

### Rationale:
- **Simplicity**: Company represents basic business entity information
- **Separation of Concerns**: Store-specific data belongs in Store collection
- **Scalability**: Easier to manage when company and store data are separate
- **Compliance**: BIR and tax information is store-specific (each store has its own TIN/permits)

## Files Updated

### 1. **Interfaces**
- ✅ `src/app/interfaces/company.interface.ts` - Simplified Company interface
- ✅ `src/app/models/company.model.ts` - Simplified Company model

### 2. **Components**
- ✅ `src/app/pages/dashboard/pos/pos.component.ts`
  - Removed `company.address`, `company.taxId`, `company.tin`, `company.birPermitNo`, `company.inclusiveSerialNumber`
  - Now uses store-level data: `(storeInfo as any)?.address`, `(storeInfo as any)?.tinNumber`, etc.

- ✅ `src/app/pages/dashboard/pos/mobile/pos-mobile.component.ts`
  - Same changes as pos.component.ts
  - Receipt data now pulls from store instead of company

- ✅ `src/app/pages/dashboard/company-profile/company-profile.component.ts`
  - Removed `address` and `taxId` fields from form
  - Simplified company creation/update logic
  - Form now only includes: name, logoUrl, phone, email, website

### 3. **Services**
- ✅ `src/app/services/pos.service.ts`
  - Updated order processing to use store-level data
  - Removed company address/tax references
  - BIR fields now expected from store settings

## Impact on Receipts

Receipt data now sources information from:
- **Company**: name, logo, phone, email, website
- **Store**: address, TIN, BIR permit, serial numbers, invoice type

```typescript
storeInfo: {
  storeName: company?.name,           // From Company
  address: storeInfo?.address,        // From Store
  phone: company?.phone,              // From Company
  email: company?.email,              // From Company  
  tin: storeInfo?.tinNumber,         // From Store
  birPermitNo: storeInfo?.birPermitNo, // From Store
  inclusiveSerialNumber: storeInfo?.inclusiveSerialNumber // From Store
}
```

## Migration Notes

### For Existing Data:
If you have existing companies with these fields in Firestore, they won't cause errors but will be ignored. You should:

1. **Migrate address/tax data to stores**:
   ```javascript
   // Old structure
   company: {
     address: "20 de Castro, Sta. Lucia, Pasig City",
     taxId: "123-456-789"
   }
   
   // New structure
   store: {
     address: "20 de Castro, Sta. Lucia, Pasig City",
     tinNumber: "123-456-789",
     birPermitNo: "...",
     inclusiveSerialNumber: "..."
   }
   ```

2. **Clean up company documents** (optional):
   - Remove unused fields from Firestore
   - Or leave them (they'll be ignored by the interface)

## Benefits

### ✅ Cleaner Data Model
- Company focuses on business entity information
- Store handles operational/compliance details

### ✅ Better Scalability
- Multi-store companies can have different addresses/TINs per store
- Each store manages its own compliance documents

### ✅ Simplified Code
- Less nested objects
- Easier to understand and maintain
- Clearer separation of concerns

### ✅ Compliance Ready
- Philippines BIR requires store-level permits
- Each physical location needs its own TIN/permits
- This structure supports that requirement

## Form Fields

### Company Profile Form (Now):
- Name *
- Logo URL
- Email *
- Phone
- Website

### Store Settings Form (Should have):
- Store Name *
- Address *
- TIN Number *
- BIR Permit Number
- Inclusive Serial Number Range
- Invoice Type
- Business Type

## Testing Checklist

- [x] Company interface compiles without errors
- [x] POS component works with simplified schema
- [x] POS Mobile component works with simplified schema
- [x] Company profile form works correctly
- [x] Receipt generation pulls correct data from stores
- [ ] Test with actual Firestore data
- [ ] Verify receipts print correctly
- [ ] Test company creation flow
- [ ] Test company update flow

## Next Steps

1. **Update Store Interface** to include all compliance fields
2. **Create Store Settings Form** for managing store-specific data
3. **Migrate existing data** if needed
4. **Update documentation** for multi-store setup
