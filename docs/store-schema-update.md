# Store Collection Schema

## Overview
Updated Store schema to include comprehensive store management, BIR compliance, and subscription features.

## Firestore Document Structure

```javascript
{
  // Basic Store Information
  storeName: "TechMart HQ Store",
  storeCode: "MAIN-01",
  storeType: "Convenience Store",
  branchName: "TechMart Central Branch",
  address: "123 Espresso Blvd, Roast City, CA 90210",
  phoneNumber: "+1-555-123-4567",
  email: "jasper@pos.com",
  companyId: "cqT10Mn608HWMspeo2AuP2",
  uid: "ee3B68VEDzXRxnt7jo2JR2mCWc12",
  status: "active",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  logoUrl: "https://yourdomain.com/logo.png",

  // BIR Compliance (Philippines)
  isBirAccredited: true,
  tempInvoiceNumber: "TEMP-2025-000456",
  birDetails: {
    birPermitNo: "BIR-PERMIT-2025-56789",
    atpOrOcn: "OCN-2025-001234",
    inclusiveSerialNumber: "000001-000999",
    serialNumber: "SN-2025-000888",
    minNumber: "MIN-2025-456789012",
    invoiceType: "Sales Invoice",
    invoiceNumber: "INV-2025-000123",
    permitDateIssued: Timestamp,
    validityNotice: "This invoice/receipt shall be valid for five (5) years from the date of the permit to use."
  },
  tinNumber: "TIN-2025-987654321",

  // Subscription Management
  subscription: {
    tier: "standard",
    status: "active",
    subscribedAt: Timestamp,
    expiresAt: Timestamp,
    billingCycle: "monthly",
    durationMonths: 3,
    amountPaid: 2997,
    discountPercent: 50,
    finalAmount: 1498.5,
    promoCode: "WELCOME50",
    referralCodeUsed: "ref123",
    paymentMethod: "paypal",
    lastPaymentDate: Timestamp
  },

  // Promo & Referral Tracking
  promoUsage: {
    promoCodeApplied: "WELCOME50",
    referralCodeUsed: "ref123",
    discountPercent: 50
  },

  subscriptionPopupShown: false
}
```

## TypeScript Interfaces

### Store Interface
```typescript
export interface Store {
  id?: string;
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
  createdAt: Date;
  updatedAt?: Date;
  logoUrl?: string;
  
  // BIR Compliance
  isBirAccredited: boolean;
  tempInvoiceNumber?: string;
  birDetails: BirDetails;
  tinNumber: string;
  
  // Subscription
  subscription: Subscription;
  promoUsage: PromoUsage;
  subscriptionPopupShown: boolean;
}
```

### BirDetails Interface
```typescript
export interface BirDetails {
  birPermitNo: string;
  atpOrOcn: string;
  inclusiveSerialNumber: string;
  serialNumber: string;
  minNumber: string;
  invoiceType: string;
  invoiceNumber: string;
  permitDateIssued: Date;
  validityNotice: string;
}
```

### Subscription Interface
```typescript
export interface Subscription {
  tier: 'basic' | 'standard' | 'premium' | 'enterprise';
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
}
```

### PromoUsage Interface
```typescript
export interface PromoUsage {
  promoCodeApplied?: string;
  referralCodeUsed?: string;
  discountPercent: number;
}
```

## Field Descriptions

### Basic Store Information

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeName` | string | Yes | Official store name |
| `storeCode` | string | Yes | Unique store identifier (e.g., "MAIN-01") |
| `storeType` | string | Yes | Type of store (e.g., "Convenience Store", "Restaurant") |
| `branchName` | string | Yes | Branch identifier |
| `address` | string | Yes | Full physical address |
| `phoneNumber` | string | Yes | Contact phone number |
| `email` | string | Yes | Store email address |
| `companyId` | string | Yes | Reference to parent company |
| `uid` | string | Yes | User ID of store manager/owner |
| `status` | enum | Yes | Store operational status: `active`, `inactive`, `suspended` |
| `logoUrl` | string | No | Store-specific logo URL |
| `createdAt` | Timestamp | Yes | Store creation timestamp |
| `updatedAt` | Timestamp | No | Last update timestamp |

### BIR Compliance (Philippines-specific)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isBirAccredited` | boolean | Yes | Whether store is BIR accredited |
| `tempInvoiceNumber` | string | No | Temporary invoice number during setup |
| `tinNumber` | string | Yes | Tax Identification Number |
| **birDetails** | object | Yes | BIR compliance details |
| `└─ birPermitNo` | string | Yes | BIR Permit Number |
| `└─ atpOrOcn` | string | Yes | Authority to Print or Official Control Number |
| `└─ inclusiveSerialNumber` | string | Yes | Serial number range (e.g., "000001-000999") |
| `└─ serialNumber` | string | Yes | Current serial number |
| `└─ minNumber` | string | Yes | Machine Identification Number |
| `└─ invoiceType` | string | Yes | Type of invoice (e.g., "Sales Invoice") |
| `└─ invoiceNumber` | string | Yes | Current invoice number |
| `└─ permitDateIssued` | Timestamp | Yes | Date permit was issued |
| `└─ validityNotice` | string | Yes | Legal validity notice text |

### Subscription Management

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **subscription** | object | Yes | Subscription details |
| `└─ tier` | enum | Yes | `basic`, `standard`, `premium`, `enterprise` |
| `└─ status` | enum | Yes | `active`, `inactive`, `expired`, `cancelled` |
| `└─ subscribedAt` | Timestamp | Yes | Subscription start date |
| `└─ expiresAt` | Timestamp | Yes | Subscription expiry date |
| `└─ billingCycle` | enum | Yes | `monthly`, `quarterly`, `yearly` |
| `└─ durationMonths` | number | Yes | Subscription duration in months |
| `└─ amountPaid` | number | Yes | Original amount (before discount) |
| `└─ discountPercent` | number | Yes | Discount percentage applied |
| `└─ finalAmount` | number | Yes | Final amount after discount |
| `└─ promoCode` | string | No | Promo code used |
| `└─ referralCodeUsed` | string | No | Referral code used |
| `└─ paymentMethod` | enum | Yes | Payment method used |
| `└─ lastPaymentDate` | Timestamp | Yes | Date of last payment |

### Promo & Referral Tracking

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **promoUsage** | object | Yes | Promo tracking |
| `└─ promoCodeApplied` | string | No | Applied promo code |
| `└─ referralCodeUsed` | string | No | Applied referral code |
| `└─ discountPercent` | number | Yes | Total discount percentage |
| `subscriptionPopupShown` | boolean | Yes | Whether subscription popup has been shown |

## Usage Examples

### Creating a New Store

```typescript
const newStore: Omit<Store, 'id' | 'createdAt' | 'updatedAt'> = {
  storeName: "TechMart HQ Store",
  storeCode: "MAIN-01",
  storeType: "Convenience Store",
  branchName: "TechMart Central Branch",
  address: "123 Espresso Blvd, Roast City, CA 90210",
  phoneNumber: "+1-555-123-4567",
  email: "jasper@pos.com",
  companyId: "cqT10Mn608HWMspeo2AuP2",
  uid: "ee3B68VEDzXRxnt7jo2JR2mCWc12",
  status: "active",
  logoUrl: "https://yourdomain.com/logo.png",
  
  isBirAccredited: true,
  tempInvoiceNumber: "TEMP-2025-000456",
  tinNumber: "TIN-2025-987654321",
  
  birDetails: {
    birPermitNo: "BIR-PERMIT-2025-56789",
    atpOrOcn: "OCN-2025-001234",
    inclusiveSerialNumber: "000001-000999",
    serialNumber: "SN-2025-000888",
    minNumber: "MIN-2025-456789012",
    invoiceType: "Sales Invoice",
    invoiceNumber: "INV-2025-000123",
    permitDateIssued: new Date(),
    validityNotice: "This invoice/receipt shall be valid for five (5) years from the date of the permit to use."
  },
  
  subscription: {
    tier: "standard",
    status: "active",
    subscribedAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
    billingCycle: "monthly",
    durationMonths: 3,
    amountPaid: 2997,
    discountPercent: 50,
    finalAmount: 1498.5,
    promoCode: "WELCOME50",
    referralCodeUsed: "ref123",
    paymentMethod: "paypal",
    lastPaymentDate: new Date()
  },
  
  promoUsage: {
    promoCodeApplied: "WELCOME50",
    referralCodeUsed: "ref123",
    discountPercent: 50
  },
  
  subscriptionPopupShown: false
};

// Add to Firestore
await addDoc(collection(firestore, 'stores'), {
  ...newStore,
  createdAt: serverTimestamp()
});
```

### Updating Subscription

```typescript
const storeRef = doc(firestore, 'stores', storeId);
await updateDoc(storeRef, {
  'subscription.status': 'expired',
  'subscription.expiresAt': new Date(),
  updatedAt: serverTimestamp()
});
```

### Checking BIR Compliance

```typescript
const store = await getDoc(doc(firestore, 'stores', storeId));
const storeData = store.data() as Store;

if (storeData.isBirAccredited && storeData.birDetails.birPermitNo) {
  console.log('Store is BIR compliant');
  console.log('Permit No:', storeData.birDetails.birPermitNo);
  console.log('Valid until:', storeData.birDetails.permitDateIssued);
}
```

## Validation Rules

### Firestore Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stores/{storeId} {
      // Read: Owner or company members can read
      allow read: if request.auth != null && 
        (resource.data.uid == request.auth.uid || 
         resource.data.companyId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyIds);
      
      // Create: Authenticated users can create
      allow create: if request.auth != null &&
        request.resource.data.uid == request.auth.uid &&
        request.resource.data.companyId != null &&
        request.resource.data.storeName is string &&
        request.resource.data.storeCode is string &&
        request.resource.data.tinNumber is string;
      
      // Update: Owner can update
      allow update: if request.auth != null &&
        resource.data.uid == request.auth.uid;
      
      // Delete: Owner can delete
      allow delete: if request.auth != null &&
        resource.data.uid == request.auth.uid;
    }
  }
}
```

## Migration from Old Schema

### Old Schema
```typescript
{
  name: string;
  address: { street, city, state, zipCode, country };
  phone?: string;
  email?: string;
  companyId: string;
  status: 'active' | 'inactive';
}
```

### Migration Script
```typescript
async function migrateStore(oldStore: any): Promise<Store> {
  return {
    storeName: oldStore.name,
    storeCode: generateStoreCode(oldStore.name),
    storeType: "Retail", // Default value
    branchName: oldStore.name + " Main",
    address: formatAddress(oldStore.address),
    phoneNumber: oldStore.phone || "",
    email: oldStore.email || "",
    companyId: oldStore.companyId,
    uid: oldStore.uid || "",
    status: oldStore.status,
    logoUrl: "",
    
    isBirAccredited: false,
    tinNumber: "",
    
    birDetails: {
      birPermitNo: "",
      atpOrOcn: "",
      inclusiveSerialNumber: "",
      serialNumber: "",
      minNumber: "",
      invoiceType: "Sales Invoice",
      invoiceNumber: "",
      permitDateIssued: new Date(),
      validityNotice: ""
    },
    
    subscription: {
      tier: "basic",
      status: "active",
      subscribedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingCycle: "monthly",
      durationMonths: 1,
      amountPaid: 0,
      discountPercent: 0,
      finalAmount: 0,
      paymentMethod: "credit_card",
      lastPaymentDate: new Date()
    },
    
    promoUsage: {
      discountPercent: 0
    },
    
    subscriptionPopupShown: false,
    createdAt: oldStore.createdAt || new Date(),
    updatedAt: new Date()
  };
}
```

## Benefits of New Schema

### ✅ BIR Compliance
- Complete Philippines BIR requirements
- Stores all required permit information
- Supports multiple invoice types
- Tracks validity periods

### ✅ Subscription Management
- Multi-tier subscription support
- Flexible billing cycles
- Discount and promo tracking
- Payment method tracking

### ✅ Better Organization
- Clear separation of concerns
- Structured data for reports
- Easy to query and filter
- Supports multi-store operations

### ✅ Audit Trail
- Created/updated timestamps
- Subscription history
- Promo usage tracking
- Status changes

## Future Enhancements

### Planned Features:
1. **Multi-currency support** - Store-specific currency settings
2. **Operating hours** - Store hours and timezone
3. **Staff management** - Store-level employee assignments
4. **Inventory tracking** - Store-specific stock levels
5. **Sales reporting** - Store performance metrics
6. **Customer data** - Store-specific customer database
7. **Integration settings** - Payment gateways, shipping providers

## Files Updated
- ✅ `src/app/interfaces/company.interface.ts` - Updated Store interface
- ✅ `src/app/interfaces/store.interface.ts` - Updated Store interface
- ✅ Added BirDetails interface
- ✅ Added Subscription interface
- ✅ Added PromoUsage interface
