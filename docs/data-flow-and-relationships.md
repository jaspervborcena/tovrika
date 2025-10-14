# Data Flow & Relationships - Complete System

## 🔄 Proper Data Flow

### 1. **Subscription Happens → Billing History Created**

```
┌─────────────────────────────────────────────────────┐
│  User Subscribes/Upgrades Store Subscription       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  1. Update Store.subscription                       │
│     - tier: 'standard'                              │
│     - status: 'active'                              │
│     - subscribedAt, expiresAt                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  2. Create CompanyBillingHistory Record             │
│     - companyId                                     │
│     - storeId                                       │
│     - tier, cycle, amount                           │
│     - promoCode, paymentMethod                      │
│     - paidAt (timestamp)                            │
└─────────────────────────────────────────────────────┘
```

### 2. **Devices Under Store (BIR Compliance)**

```
┌─────────────────────────────────────────────────────┐
│  Store (Has BIR Details)                            │
│  - isBirAccredited: true                            │
│  - birDetails: {...}                                │
│  - tinNumber                                        │
└────────────────┬────────────────────────────────────┘
                 │
                 │ HAS MANY
                 ▼
┌─────────────────────────────────────────────────────┐
│  Devices (POS Terminals)                            │
│  - Device 1: Terminal 001                           │
│  - Device 2: Terminal 002                           │
│  - Device 3: Terminal 003                           │
│  Each with:                                         │
│    - BIR Permit & Serial Numbers                    │
│    - Unique Invoice Series                          │
│    - VAT Configuration                              │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Complete Entity Relationships

```
                    ┌──────────────┐
                    │   Company    │
                    │  (Business)  │
                    └──────┬───────┘
                           │
                           │ owns (1:N)
                           │
                    ┌──────▼───────┐
                    │    Store     │
                    │  (Location)  │
                    │              │
                    │ - BIR Details│
                    │ - Subscription│
                    └──┬────────┬──┘
                       │        │
         has devices   │        │  triggers billing
              (1:N)    │        │  on subscription
                       │        │  change (1:N)
                       │        │
              ┌────────▼──┐  ┌──▼─────────────────┐
              │  Device   │  │ CompanyBillingHist │
              │(Terminal) │  │  (Payment Record)  │
              │           │  │                    │
              │- Invoice  │  │ - Subscription $   │
              │  Series   │  │ - Promo Codes      │
              │- BIR      │  │ - Payment Method   │
              │  Permit   │  └────────────────────┘
              └───────────┘
                   │
                   │ generates (1:N)
                   │
              ┌────▼──────┐
              │  Orders/  │
              │Transactions│
              └───────────┘
```

---

## 🎯 Business Logic Workflows

### Workflow 1: **Subscription Payment**

```typescript
// STEP 1: User upgrades store subscription
async function upgradeSubscription(storeId: string, tier: string, promoCode?: string) {
  
  // Calculate pricing
  const pricing = calculatePricing(tier, promoCode);
  
  // Process payment
  const payment = await processPayment(pricing);
  
  // STEP 2: Update Store subscription
  await updateStore(storeId, {
    subscription: {
      tier: tier,
      status: 'active',
      subscribedAt: new Date(),
      expiresAt: calculateExpiryDate(pricing.durationMonths),
      billingCycle: pricing.cycle,
      durationMonths: pricing.durationMonths,
      amountPaid: pricing.finalAmount,
      discountPercent: pricing.discountPercent,
      finalAmount: pricing.finalAmount,
      promoCode: promoCode,
      paymentMethod: payment.method,
      lastPaymentDate: new Date()
    }
  });
  
  // STEP 3: Create billing history record
  await createBillingHistory({
    companyId: store.companyId,
    storeId: storeId,
    tier: tier,
    cycle: pricing.cycle,
    durationMonths: pricing.durationMonths,
    amount: pricing.amount,
    discountPercent: pricing.discountPercent,
    finalAmount: pricing.finalAmount,
    promoCode: promoCode,
    referralCode: pricing.referralCode,
    paymentMethod: payment.method,
    paidAt: new Date()
  });
}
```

### Workflow 2: **Device Registration (Under Store)**

```typescript
// STEP 1: Store must be BIR-accredited
async function registerDevice(storeId: string, deviceData: Partial<Device>) {
  
  const store = await getStore(storeId);
  
  // Validate store has BIR compliance
  if (!store.isBirAccredited) {
    throw new Error('Store must be BIR-accredited to register devices');
  }
  
  // STEP 2: Create device with BIR details
  const device: Device = {
    companyId: store.companyId,
    storeId: storeId,
    
    // Device info
    deviceLabel: deviceData.deviceLabel,
    terminalId: deviceData.terminalId,
    
    // Invoice series (unique per device)
    invoicePrefix: `INV-${store.storeCode}-${deviceData.terminalId}`,
    invoiceSeriesStart: 1,
    invoiceSeriesEnd: 999999,
    currentInvoiceNumber: 1,
    
    // BIR Compliance (from device registration)
    serialNumber: deviceData.serialNumber,
    minNumber: deviceData.minNumber,
    birPermitNo: deviceData.birPermitNo,
    atpOrOcn: deviceData.atpOrOcn,
    permitDateIssued: deviceData.permitDateIssued,
    vatRegistrationType: deviceData.vatRegistrationType,
    vatRate: deviceData.vatRate,
    receiptType: deviceData.receiptType,
    validityNotice: deviceData.validityNotice,
    
    status: 'active',
    createdAt: new Date()
  };
  
  return await createDevice(device);
}
```

### Workflow 3: **POS Transaction with Device**

```typescript
// STEP 1: Select device (terminal) for transaction
async function createPOSTransaction(storeId: string, deviceId: string, orderData: any) {
  
  const device = await getDevice(deviceId);
  const store = await getStore(storeId);
  
  // STEP 2: Generate invoice number from device
  const invoiceNumber = `${device.invoicePrefix}-${device.currentInvoiceNumber.toString().padStart(6, '0')}`;
  
  // STEP 3: Create order with BIR-compliant invoice
  const order = await createOrder({
    ...orderData,
    storeId: storeId,
    deviceId: deviceId,
    invoiceNumber: invoiceNumber,
    
    // BIR Details from Device
    serialNumber: device.serialNumber,
    minNumber: device.minNumber,
    birPermitNo: device.birPermitNo,
    atpOrOcn: device.atpOrOcn,
    vatRate: device.vatRate,
    
    // Store BIR Details
    tinNumber: store.tinNumber,
    storeAddress: store.address
  });
  
  // STEP 4: Increment device invoice counter
  await updateDevice(deviceId, {
    currentInvoiceNumber: device.currentInvoiceNumber + 1,
    lastUsedAt: new Date()
  });
  
  return order;
}
```

---

## 🗂️ Collection Structure & Purpose

### 1. **companies**
- **Purpose:** Business entity container
- **Stores:** Basic company info
- **Relationship:** Parent of stores
- **No billing/device data here**

### 2. **stores**
- **Purpose:** Operational location with compliance
- **Stores:** 
  - Location details
  - BIR compliance status & details
  - Current subscription status
- **Relationship:** 
  - Child of company
  - Parent of devices
  - Referenced by billing history

### 3. **devices** ← **UNDER STORE**
- **Purpose:** BIR-registered POS terminals
- **Stores:**
  - Terminal identification
  - BIR permit & serial numbers per device
  - Invoice series per device
  - VAT configuration
- **Why under Store:**
  - ✅ BIR compliance is at store level
  - ✅ Each store location needs BIR-registered devices
  - ✅ Invoice series unique per terminal
  - ✅ Different stores = different BIR permits

### 4. **companyBillingHistory** ← **SUBSCRIPTION EVENTS**
- **Purpose:** Audit trail of all subscription payments
- **Created When:**
  - ✅ Initial store subscription
  - ✅ Subscription upgrade/downgrade
  - ✅ Subscription renewal
- **Stores:**
  - Payment details
  - Promo codes used
  - Pricing & discounts
  - Links to both company & specific store

---

## 🎨 UI Flow Examples

### Subscription Management Page
```
Store: TechMart Makati
Current Plan: Freemium (Free)

[Upgrade to Standard - ₱999/month]
  └─> Payment Flow
      └─> Creates CompanyBillingHistory
      └─> Updates Store.subscription

Billing History:
┌────────────────────────────────────────────┐
│ Jan 13, 2025 - Standard (3 months)        │
│ ₱2,997 → ₱1,498.50 (50% off WELCOME50)   │
│ Paid via PayPal                            │
└────────────────────────────────────────────┘
```

### Device Management Page
```
Store: TechMart Makati
BIR Status: ✅ Accredited

Registered Devices:
┌────────────────────────────────────────────┐
│ Terminal 1 - TERM001                       │
│ Series: INV-MKT-001-000001 to 999999      │
│ Current: INV-MKT-001-000123                │
│ BIR Permit: BIR-PERMIT-2025-56789         │
│ Status: 🟢 Active                          │
└────────────────────────────────────────────┘

[+ Register New Device]
```

---

## ✅ Key Takeaways

1. **Subscription → Billing History**
   - Every subscription change creates billing record
   - Tracks payment history
   - Links to store that was upgraded

2. **Devices Under Store**
   - Store has BIR accreditation
   - Each device has unique BIR permit & invoice series
   - Multiple devices per store supported
   - Devices generate invoices for transactions

3. **Data Hierarchy**
   ```
   Company
     └─ Store (+ BIR + Subscription)
         ├─ Devices (+ BIR Permits + Invoice Series)
         └─ Billing History (when subscription changes)
   ```

---

*This structure ensures BIR compliance while maintaining clean subscription billing tracking!*
