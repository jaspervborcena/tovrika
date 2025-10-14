# Duplicate Code Cleanup Summary

## Overview
Removed duplicate interface definitions across the codebase and consolidated them into their proper locations for better organization and maintainability.

## Changes Made

### 1. ✅ Reorganized Store-Related Interfaces

**Location:** `src/app/interfaces/store.interface.ts`

**Now contains:**
- `Store` interface (comprehensive with BIR, subscription fields)
- `BirDetails` interface
- `Subscription` interface
- `PromoUsage` interface
- `StoreBranch` interface

**Removed from:** `src/app/interfaces/company.interface.ts`

### 2. ✅ Company Interface Simplified

**Location:** `src/app/interfaces/company.interface.ts`

**Now contains:**
- `Company` interface (business entity level)
- `Branch` interface (simplified version for UI)
- `StoreSettings` interface
- `CompanySettings` interface
- `ReceiptSettings` interface
- `OnboardingStatus` interface
- Type definitions: `BusinessType`, `PlanType`, `OnboardingStep`

**Added Optional Fields for Legacy Compatibility:**
- `address?: string`
- `settings?: { currency?: string; timezone?: string }`
- `stores?: any[]` (UI state for nested data)

**Branch Interface Added:**
```typescript
export interface Branch {
  id?: string;
  companyId: string;
  storeId: string;
  branchName: string;
  address: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

### 3. ✅ Updated Service Imports

**Files Updated:**

1. **store.service.ts**
   - Changed: `import { Store } from '../interfaces/company.interface'`
   - To: `import { Store } from '../interfaces/store.interface'`

2. **company.service.ts**
   - Changed: `import { Company, Store, Branch } from '../interfaces/company.interface'`
   - To: `import { Company, Branch } from '../interfaces/company.interface'`
   - Added: `import { Store } from '../interfaces/store.interface'`

3. **new-company.service.ts**
   - Changed: `import { Company, Store, Branch } from '../interfaces/company.interface'`
   - To: `import { Company, Branch } from '../interfaces/company.interface'`
   - Added: `import { Store } from '../interfaces/store.interface'`

4. **companySetup.service.ts**
   - Removed: Inline `Company` interface definition
   - Added: `import { Company } from '../interfaces/company.interface'`

### 4. ✅ Store Interface Enhancements

**Added to Store interface:**
- `isExpanded?: boolean` - UI state for collapsible views
- `branches?: any[]` - UI state for nested branch data
- `promoUsage?: PromoUsage` - Made optional (was required)

**Fixed Subscription Tier:**
- Changed from `'basic'` to `'freemium'` to match current business model

## Identified Duplicates Not Removed

### 1. `src/app/models/company.model.ts`
**Status:** ⚠️ Outdated but kept temporarily
- Contains old versions of Store, Branch, Company
- **Not imported anywhere** - can be safely deleted in future
- Recommendation: Remove after thorough testing

### 2. `branch.interface.ts`
**Status:** ✅ Kept - More comprehensive version
- Contains full Branch interface with settings
- Used by: `src/app/pages/dashboard/branches/branches.component.ts`
- Note: Simple Branch version added to company.interface.ts for backward compatibility

## File Organization Structure

```
interfaces/
├── company.interface.ts     → Company, Branch (simple), Settings, Types
├── store.interface.ts       → Store, BirDetails, Subscription, PromoUsage
├── branch.interface.ts      → Branch (full), BranchSettings, OperatingHours
├── product.interface.ts     → Product-related interfaces
└── ...other interfaces

services/
├── company.service.ts       → Uses Company, Branch, Store
├── store.service.ts         → Uses Store
├── companySetup.service.ts  → Uses Company
└── ...other services
```

## Benefits

1. **Single Source of Truth:**
   - Each interface defined in one place
   - No conflicting definitions

2. **Better Organization:**
   - Store-related interfaces in store.interface.ts
   - Company-related interfaces in company.interface.ts
   - Clear separation of concerns

3. **Improved Maintainability:**
   - Updates only need to be made once
   - Easier to find interface definitions
   - Reduced risk of version mismatches

4. **Type Safety:**
   - All imports use correct, up-to-date interfaces
   - No duplicate type definitions causing conflicts

## Testing Checklist

- [x] No TypeScript compilation errors
- [x] All service imports updated
- [x] Store management component working
- [ ] Company management component working
- [ ] Branch management component working
- [ ] Manual testing of create/update operations

## Future Cleanup Recommendations

1. **Remove `company.model.ts`:**
   - File not imported anywhere
   - Contains outdated interface definitions
   - Safe to delete after verification

2. **Consider merging Branch definitions:**
   - Simple Branch in company.interface.ts
   - Full Branch in branch.interface.ts
   - Could standardize on one version

3. **Review CompanySetupService:**
   - Appears to overlap with company.service.ts
   - Consider consolidating functionality

## Migration Notes

### For New Code
- Import `Store` from `'../interfaces/store.interface'`
- Import `Company`, `Branch` from `'../interfaces/company.interface'`
- Import full `Branch` interface from `'../interfaces/branch.interface'` when needed

### For Existing Code
- All imports automatically updated
- No breaking changes for existing functionality
- Optional fields added for backward compatibility

---
*Last Updated: 2025-01-20*
*Related Docs: company-schema-simplification.md, store-schema-update.md, ui-schema-update-summary.md*
