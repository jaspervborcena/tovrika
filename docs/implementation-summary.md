# Implementation Summary - Account Settings Feature

## ✅ What We've Built

### 1. **Complete Schema Structure** (4 Collections)

| Collection | Interface File | Purpose |
|-----------|---------------|---------|
| `companies` | `company.interface.ts` | Business entity |
| `stores` | `store.interface.ts` | Locations with BIR + Subscription |
| `devices` | `device.interface.ts` | POS terminals with BIR compliance |
| `companyBillingHistory` | `billing.interface.ts` | Subscription payment tracking |

---

### 2. **Key Features Designed**

#### A. **Subscription Management**
- ✅ Subscribe at Company level
- ✅ Select which Store to upgrade
- ✅ Promo code support
- ✅ Multiple payment methods
- ✅ Billing history per store

#### B. **BIR Compliance Workflow**
- ✅ Submit BIR accreditation at Store level
- ✅ Include Device/Terminal BIR details in submission
- ✅ Admin review system (pending → approved/rejected)
- ✅ **BIR details locked after approval** (cannot edit)
- ✅ Support multiple devices per store

#### C. **Device Management**
- ✅ Devices belong to Stores
- ✅ Each device has unique BIR permit & invoice series
- ✅ Track device status (pending, active, inactive)
- ✅ Lock BIR details after admin approval

---

### 3. **Updated Interfaces**

#### Store Interface Enhancements:
```typescript
// BIR Approval Workflow
isBirAccredited: boolean;
birAccreditationStatus?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
birAccreditationSubmittedAt?: Date;
birAccreditationApprovedAt?: Date;
birAccreditationRejectedReason?: string;
```

#### Device Interface Enhancements:
```typescript
// Device Status
status?: 'pending' | 'active' | 'inactive' | 'maintenance';

// BIR Approval Tracking
isLocked?: boolean; // True after admin approval
approvedBy?: string; // Admin UID
approvedAt?: Date;
```

---

### 4. **Data Flow Documentation**

Created comprehensive docs:
- ✅ `complete-schema-overview.md` - All collections and relationships
- ✅ `data-flow-and-relationships.md` - How subscription & devices work
- ✅ `ui-workflow-company-settings.md` - Complete UI flows and mockups
- ✅ `duplicate-cleanup-summary.md` - Code organization cleanup

---

## 🎯 UI Structure

### Company Settings Page (Tabs):

```
┌─────────────────────────────────────────────┐
│  Company Settings                           │
├─────────────────────────────────────────────┤
│                                             │
│  [Profile] [Subscription] [Stores] [Users] │
│  ─────────  ────────────  ──────  ─────    │
│                                             │
│  Tab Content Here                           │
│                                             │
└─────────────────────────────────────────────┘
```

### 1. **Profile Tab**
- Company name, logo, contact info
- Basic details

### 2. **Subscription Tab** ← **Subscribe Here**
- View all plans (Freemium, Standard, Premium, Enterprise)
- Select plan → Select store → Payment
- Creates `CompanyBillingHistory` record

### 3. **Stores Tab** ← **View Billing History Here**
- **Stores Grid/Table**
  - Store name, type, status, subscription tier
  - Actions: [View Details] [Billing History] [Devices]
- **Billing History Modal** (per store)
  - Shows all `CompanyBillingHistory` for that store
  - Payment details, promo codes, amounts
- **Store Details Modal**
  - Basic store info
  - BIR Compliance section
    - Checkbox: "BIR Accredited"
    - Opens BIR Submission Popup when checked
- **BIR Submission Popup**
  - Store BIR details (TIN, business name)
  - Device BIR details (permit, serial, MIN, ATP/OCN)
  - Invoice series configuration
  - VAT settings
  - Upload supporting documents
  - Submit for admin review
- **Devices List** (after BIR approval)
  - View all registered devices
  - Device status, invoice series usage
  - **BIR details LOCKED** (read-only)
  - Register additional devices

### 4. **Users Tab** (Future)
- User management
- Role assignments

---

## 🔄 Key Workflows

### Workflow 1: Subscribe to a Plan
```
1. Go to Company Settings > Subscription Tab
2. Click [Subscribe] on desired plan
3. Select which store to upgrade
4. Enter promo code (optional)
5. Complete payment
6. System updates:
   ├─> Store.subscription (tier, status, dates)
   └─> Creates CompanyBillingHistory record
```

### Workflow 2: BIR Accreditation
```
1. Go to Company Settings > Stores Tab
2. Click [View Details] on a store
3. Check "BIR Accredited" checkbox
4. BIR Submission Popup opens
5. Fill in:
   ├─> Store BIR details
   ├─> Device BIR details
   ├─> Invoice series
   └─> Upload documents
6. Submit for admin review
7. Status changes to "Pending Review"
8. Admin reviews in backend
9. If approved:
   ├─> Store.isBirAccredited = true
   ├─> Store.birAccreditationStatus = 'approved'
   ├─> Device created with status = 'active'
   ├─> Device.isLocked = true (cannot edit)
   └─> User notified
```

### Workflow 3: View Billing History
```
1. Go to Company Settings > Stores Tab
2. Click [Billing History] on any store
3. Modal opens showing all payments for that store
4. View:
   ├─> Payment date
   ├─> Plan tier
   ├─> Amount paid
   ├─> Discounts applied
   ├─> Promo codes used
   └─> Payment method
5. Export to CSV (optional)
```

---

## 🏗️ Component Structure to Build

```
src/app/pages/company-settings/
├── company-settings.component.ts       ← Main page with tabs
│
├── tabs/
│   ├── profile-tab/
│   │   └── company-profile-tab.component.ts
│   │
│   ├── subscription-tab/
│   │   ├── subscription-tab.component.ts       ← Plan selection
│   │   ├── plan-card.component.ts              ← Plan display
│   │   ├── store-selector-modal.component.ts   ← Select store
│   │   └── payment-modal.component.ts          ← Payment flow
│   │
│   └── stores-tab/
│       ├── stores-tab.component.ts             ← Stores grid/table
│       ├── store-billing-history-modal.component.ts  ← Billing history
│       ├── store-details-modal.component.ts    ← Store details
│       ├── bir-submission-modal.component.ts   ← BIR form
│       └── devices-list-modal.component.ts     ← Device management
│
└── shared/
    ├── billing-history-table.component.ts
    ├── device-card.component.ts
    └── status-badge.component.ts
```

---

## 🔧 Services to Build

### 1. **billing.service.ts**
```typescript
- createBillingHistory(data: CompanyBillingHistory)
- getBillingHistoryByStore(storeId: string)
- getBillingHistoryByCompany(companyId: string)
- getTotalSpent(storeId: string)
```

### 2. **device.service.ts**
```typescript
- createDevice(device: Device) // Creates pending device
- getDevicesByStore(storeId: string)
- updateDeviceStatus(deviceId: string, status)
- lockDevice(deviceId: string) // After approval
- getDeviceInvoiceUsage(deviceId: string)
- incrementInvoiceNumber(deviceId: string)
```

### 3. **Update existing services:**

**store.service.ts:**
```typescript
- submitBirAccreditation(storeId: string, birData)
- updateBirAccreditationStatus(storeId, status)
```

---

## 🔐 Admin Backend (Separate)

Admin will need:
```
Admin Dashboard > BIR Accreditation Requests

┌─────────────────────────────────────────────┐
│  Pending BIR Accreditation Requests         │
├─────────────────────────────────────────────┤
│  TechMart Makati                            │
│  Submitted: Jan 13, 2025                    │
│  Documents: [View]                          │
│  [Approve] [Reject]                         │
└─────────────────────────────────────────────┘

On Approve:
- Store.isBirAccredited = true
- Store.birAccreditationStatus = 'approved'
- Device.status = 'active'
- Device.isLocked = true
- Send notification to user

On Reject:
- Store.birAccreditationStatus = 'rejected'
- Store.birAccreditationRejectedReason = "..."
- Send notification to user
```

---

## ✅ Ready for Implementation!

### Phase 1: Services (Backend Logic)
1. Create `billing.service.ts`
2. Create `device.service.ts`
3. Update `store.service.ts` with BIR methods

### Phase 2: UI Components
1. Company Settings main page with tabs
2. Subscription Tab with plan selection
3. Stores Tab with grid/table
4. BIR Submission Modal
5. Billing History Modal
6. Devices Management

### Phase 3: Admin Panel (Separate)
1. BIR Accreditation review interface
2. Approve/Reject functionality
3. Notification system

---

## 📊 Current Status

| Item | Status | Notes |
|------|--------|-------|
| Interfaces | ✅ Complete | All 4 collections defined |
| Data Flow | ✅ Documented | Clear workflows |
| UI Mockups | ✅ Complete | All screens designed |
| Services | ⏳ Ready to build | Logic documented |
| Components | ⏳ Ready to build | Structure defined |
| Admin Panel | 📋 Planned | Separate implementation |

---

**Next Step:** Would you like me to start building:
1. **Services first** (billing.service.ts, device.service.ts)?
2. **UI components** (company-settings page with tabs)?
3. **Both together** (service + component)?

Let me know and I'll start implementing! 🚀
