# Complete Schema Overview - All Collections

## Collections Structure

### 1. 👔 **companies** (Business Entity)
**Interface:** `Company` in `company.interface.ts`

```typescript
{
  id: string;
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

**Purpose:** Top-level business entity  
**Relationships:** 
- Has many → stores
- Has many → companyBillingHistory
- Owner → users (via ownerUid)

---

### 2. 🏪 **stores** (Operational Units)
**Interface:** `Store` in `store.interface.ts`

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
  companyId: string;  // → companies
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
  promoUsage?: PromoUsage;
  subscriptionPopupShown: boolean;
}
```

**Purpose:** Physical locations/branches with BIR compliance  
**Relationships:**
- Belongs to → companies (via companyId)
- Has many → devices
- Has many → companyBillingHistory (via storeId)

---

### 3. 💳 **companyBillingHistory** (Payment Records)
**Interface:** `CompanyBillingHistory` in `billing.interface.ts`

```typescript
{
  id: string;
  companyId: string;  // → companies
  storeId: string;    // → stores
  tier: 'freemium' | 'standard' | 'premium' | 'enterprise';
  cycle: 'monthly' | 'quarterly' | 'yearly';
  durationMonths: number;
  amount: number;
  discountPercent: number;
  finalAmount: number;
  promoCode?: string;
  referralCode?: string;
  paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' | 'gcash' | 'paymaya';
  paidAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
```

**Purpose:** Track all subscription payments and upgrades  
**Relationships:**
- Belongs to → companies (via companyId)
- Belongs to → stores (via storeId)

**Use Cases:**
- Payment history tracking
- Subscription renewal reminders
- Revenue analytics
- Promo code effectiveness tracking
- Audit trail for billing

---

### 4. 🖥️ **devices** (POS Terminals)
**Interface:** `Device` in `device.interface.ts`

```typescript
{
  id: string;
  companyId: string;  // → companies
  storeId: string;    // → stores
  
  // Device Identification
  deviceLabel: string;
  terminalId: string;
  
  // Invoice Series Management
  invoicePrefix: string;
  invoiceSeriesStart: number;
  invoiceSeriesEnd: number;
  currentInvoiceNumber: number;
  
  // BIR Compliance
  serialNumber: string;
  minNumber: string;
  birPermitNo: string;
  atpOrOcn: string;
  permitDateIssued: Date;
  vatRegistrationType: 'VAT-registered' | 'Non-VAT' | 'VAT-exempt';
  vatRate: number;
  receiptType: string;
  validityNotice: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
  
  // Device Status
  status?: 'active' | 'inactive' | 'maintenance';
  lastUsedAt?: Date;
  isOnline?: boolean;
}
```

**Purpose:** Register POS terminals with BIR-compliant invoice series  
**Relationships:**
- Belongs to → companies (via companyId)
- Belongs to → stores (via storeId)
- Generates → orders/transactions

**Use Cases:**
- Multi-terminal support per store
- BIR-compliant invoice numbering per device
- Track which terminal processed each transaction
- Device management and monitoring
- Invoice series exhaustion alerts

---

## 📊 Complete Entity Relationship Diagram

```
┌─────────────────────┐
│     companies       │
│  (Business Entity)  │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐
│      stores         │
│ (Operational Units) │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           │ 1:N                 │ 1:N
           │                     │
┌──────────▼──────────┐  ┌──────▼──────────────────┐
│      devices        │  │ companyBillingHistory   │
│  (POS Terminals)    │  │   (Payment Records)     │
└─────────────────────┘  └─────────────────────────┘
```

---

## 🔑 Key Features by Collection

### Companies
- ✅ Simple business entity
- ✅ Multi-store support (via stores collection)
- ✅ Owner management
- ✅ Company-level settings

### Stores
- ✅ Complete BIR compliance (birDetails)
- ✅ Subscription management per store
- ✅ Store-specific settings
- ✅ Multi-device support
- ✅ Promo code tracking

### Billing History
- ✅ Complete payment audit trail
- ✅ Support multiple payment methods
- ✅ Promo and referral code tracking
- ✅ Flexible billing cycles
- ✅ Discount tracking

### Devices
- ✅ BIR-compliant invoice series per terminal
- ✅ ATP/OCN tracking
- ✅ VAT configuration per device
- ✅ Serial number management
- ✅ Device status monitoring
- ✅ Automatic invoice numbering

---

## 🎯 Business Logic Flows

### 1. **New Company Onboarding**
```
1. Create Company
2. Create Store (with subscription: freemium/trial)
3. Register Device (for that store)
4. Device ready to generate invoices
```

### 2. **Subscription Upgrade**
```
1. User selects tier (standard/premium/enterprise)
2. Apply promo code (if any)
3. Process payment
4. Create companyBillingHistory record
5. Update store.subscription
```

### 3. **Invoice Generation**
```
1. POS transaction initiated
2. Select device (terminal)
3. Device generates next invoice number:
   - Prefix: device.invoicePrefix
   - Number: device.currentInvoiceNumber
   - Format: {prefix}-{number}
4. Increment device.currentInvoiceNumber
5. Create order with invoice details
```

### 4. **Device Management**
```
1. Store can have multiple devices (terminals)
2. Each device has unique invoice series
3. BIR compliance tracked per device
4. Monitor device status and usage
```

---

## 📝 Interface Files Created

1. ✅ `company.interface.ts` - Company, CompanySettings
2. ✅ `store.interface.ts` - Store, BirDetails, Subscription, PromoUsage
3. ✅ `billing.interface.ts` - CompanyBillingHistory *(NEW)*
4. ✅ `device.interface.ts` - Device, DeviceInvoiceSeries *(NEW)*
5. ✅ `branch.interface.ts` - Branch (detailed)

---

## 🚀 Next Steps

### 1. Services to Create/Update
- [ ] `billing.service.ts` - Manage payment history
- [ ] `device.service.ts` - Manage POS terminals
- [ ] Update `store.service.ts` - Add device relationship
- [ ] Update `company.service.ts` - Add billing history

### 2. UI Components to Create
- [ ] Billing History page (view payments)
- [ ] Device Management page (register/manage terminals)
- [ ] Subscription upgrade flow
- [ ] Device selection in POS

### 3. Firestore Security Rules
- [ ] companyBillingHistory rules
- [ ] devices rules
- [ ] Ensure proper access control

---

## ✅ Schema Validation

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-company support | ✅ | Via companies collection |
| Multi-store per company | ✅ | Via stores collection |
| BIR compliance | ✅ | In stores.birDetails + devices |
| Subscription tiers | ✅ | In stores.subscription |
| Payment tracking | ✅ | Via companyBillingHistory |
| Multi-terminal support | ✅ | Via devices collection |
| Invoice series mgmt | ✅ | Per device |
| Promo codes | ✅ | In billing + store |
| VAT handling | ✅ | In devices.vatRate |

---

*Last Updated: 2025-01-20*  
*All interfaces created and ready for service implementation*
