# UI Workflow - Company Settings & Account Management

## 🎯 UI Navigation Structure

```
Company Settings Page
├── 1. Company Profile (Basic Info)
├── 2. Subscription Management ← Subscribe Here
│   ├── Current Plan Display
│   ├── Upgrade/Downgrade Options
│   └── Payment Flow
├── 3. Stores Grid/Table
│   ├── Store List
│   ├── Store Details
│   └── Billing History per Store ← View Here
└── 4. (Future: Users, Permissions, etc.)
```

---

## 📋 Detailed UI Flows

### Flow 1: **Subscribe at Company Level**

```
┌─────────────────────────────────────────────┐
│  Company Settings > Subscription Tab        │
├─────────────────────────────────────────────┤
│                                             │
│  Current Plan: Freemium (Free)              │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ 📦 Standard - ₱999/month              │ │
│  │ ✓ Multiple stores                     │ │
│  │ ✓ Advanced reporting                  │ │
│  │ [Subscribe] ────────────┐             │ │
│  └─────────────────────────│─────────────┘ │
│                             │               │
│  ┌──────────────────────────▼────────────┐ │
│  │ 📦 Premium - ₱2,999/month             │ │
│  │ ✓ Everything in Standard              │ │
│  │ ✓ Priority support                    │ │
│  │ [Subscribe]                           │ │
│  └───────────────────────────────────────┘ │
│                                             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Select Store for Subscription              │
├─────────────────────────────────────────────┤
│  ○ TechMart Makati                          │
│  ○ TechMart Cebu                            │
│  ○ TechMart Manila                          │
│                                             │
│  [ Continue ]                               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Payment Details                            │
├─────────────────────────────────────────────┤
│  Promo Code: [WELCOME50]  [Apply]          │
│                                             │
│  Subtotal:     ₱2,997.00                    │
│  Discount 50%: -₱1,498.50                   │
│  Total:        ₱1,498.50                    │
│                                             │
│  Payment Method:                            │
│  ○ GCash  ○ PayMaya  ○ PayPal              │
│                                             │
│  [ Pay Now ]                                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
         Update Store.subscription
                   +
       Create CompanyBillingHistory
```

---

### Flow 2: **View Billing History Under Stores Table**

```
┌─────────────────────────────────────────────────────────────────┐
│  Company Settings > Stores                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stores List:                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Store Name        │ Type    │ Status │ Subscription      │ │
│  ├───────────────────┼─────────┼────────┼──────────────────┤ │
│  │ TechMart Makati   │ Retail  │ Active │ Standard         │ │
│  │ [View Details] [Billing History] [Devices]              │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ TechMart Cebu     │ Retail  │ Active │ Freemium        │ │
│  │ [View Details] [Billing History] [Devices]              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
            Click [Billing History]
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Billing History - TechMart Makati                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Date        │ Plan      │ Duration │ Amount   │ Discount │ │
│  ├─────────────┼───────────┼──────────┼──────────┼─────────┤ │
│  │ Jan 13 2025 │ Standard  │ 3 months │ ₱2,997   │ 50%     │ │
│  │ Promo: WELCOME50 | Paid via PayPal | ₱1,498.50          │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ Oct 13 2024 │ Freemium  │ Trial    │ ₱0       │ 0%      │ │
│  │ Initial signup                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Total Spent: ₱1,498.50                                         │
│  [ Export CSV ]  [ Close ]                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Flow 3: **BIR Compliance & Devices (Under Store)**

```
┌─────────────────────────────────────────────────────────────────┐
│  Store Details - TechMart Makati                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Basic Info:                                                    │
│  ├─ Store Name: TechMart Makati                                │
│  ├─ Address: 123 Ayala Avenue, Makati City                     │
│  └─ Contact: +63 917 123 4567                                  │
│                                                                 │
│  BIR Compliance:                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ☐ BIR Accredited                                          │ │
│  │                                                            │ │
│  │ [Submit for BIR Accreditation] ← Checkbox triggers this   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
          Check "BIR Accredited" box
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BIR Accreditation Submission                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Store BIR Details:                                             │
│  ├─ TIN Number: [000-000-000-000]                              │
│  ├─ Business Name: [____________________]                      │
│  └─ BIR Registration: [📎 Upload]                              │
│                                                                 │
│  Device/Terminal Details:                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Device Label: [TechMart Terminal 1]                       │ │
│  │ Terminal ID:  [TERM001]                                   │ │
│  │                                                            │ │
│  │ BIR Permit No:          [BIR-PERMIT-2025-56789]          │ │
│  │ Serial Number:          [SN-2025-000888]                  │ │
│  │ MIN Number:             [MIN-2025-456789012]              │ │
│  │ ATP/OCN:                [OCN-2025-001234]                 │ │
│  │ Permit Date Issued:     [📅 2025-01-01]                   │ │
│  │                                                            │ │
│  │ Invoice Series:                                            │ │
│  │ ├─ Prefix:     [INV-MKT-001-]                             │ │
│  │ ├─ Start:      [100001]                                   │ │
│  │ └─ End:        [199999]                                   │ │
│  │                                                            │ │
│  │ VAT Configuration:                                         │ │
│  │ ├─ Registration Type: [VAT-registered ▼]                  │ │
│  │ ├─ VAT Rate:          [12.0%]                             │ │
│  │ └─ Receipt Type:      [POS Receipt]                       │ │
│  │                                                            │ │
│  │ Supporting Documents:                                      │ │
│  │ ├─ BIR Permit Copy:   [📎 Upload]                         │ │
│  │ ├─ ATP/OCN Copy:      [📎 Upload]                         │ │
│  │ └─ Store Photos:      [📎 Upload]                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Submit for Admin Review]  [Cancel]                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⏳ Pending Admin Review                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Your BIR accreditation request has been submitted.             │
│  Tovrika admin will review and verify the details.              │
│                                                                 │
│  Status: 🟡 Pending Review                                      │
│  Submitted: Jan 13, 2025 2:30 PM                                │
│                                                                 │
│  You will be notified once approved.                            │
│  [ OK ]                                                         │
└─────────────────────────────────────────────────────────────────┘
                   │
         Admin Approves in Backend
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  ✅ BIR Accreditation Approved                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Congratulations! Your store is now BIR-accredited.             │
│                                                                 │
│  ✓ Store marked as BIR-accredited                               │
│  ✓ Device registered and active                                 │
│  ✓ Invoice series locked and ready                              │
│                                                                 │
│  ⚠️ BIR details are now LOCKED and cannot be changed.           │
│  Contact Tovrika support for any corrections.                   │
│                                                                 │
│  [ View Device ]  [ Close ]                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### Flow 4: **Managing Devices After BIR Approval**

```
┌─────────────────────────────────────────────────────────────────┐
│  Store Details - TechMart Makati                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BIR Status: ✅ Accredited (Approved Jan 15, 2025)              │
│                                                                 │
│  Registered Devices:                                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🖥️ TechMart Terminal 1 - TERM001                         │ │
│  │ Status: 🟢 Active                                         │ │
│  │ Series: INV-MKT-001-100123 (100,123 / 199,999 used)      │ │
│  │ BIR Permit: BIR-PERMIT-2025-56789 🔒 LOCKED              │ │
│  │ Last Used: 2 hours ago                                    │ │
│  │ [View Details] [View Transactions]                        │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ 🖥️ TechMart Terminal 2 - TERM002                         │ │
│  │ Status: 🔴 Inactive                                       │ │
│  │ Series: INV-MKT-002-200001 (Unused)                      │ │
│  │ BIR Permit: BIR-PERMIT-2025-56790 🔒 LOCKED              │ │
│  │ [Activate] [View Details]                                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [+ Register New Device]  ← Opens BIR submission popup again    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 BIR Approval Workflow

### States:

1. **Not Submitted** (Default)
   - Checkbox unchecked
   - No BIR details
   - Cannot register devices

2. **Pending Review** 🟡
   - User submitted BIR details + device
   - Waiting for admin approval
   - Store marked as `isBirAccredited: false`
   - Device marked as `status: 'pending'`

3. **Approved** ✅
   - Admin approved in backend
   - Store marked as `isBirAccredited: true`
   - Device marked as `status: 'active'`
   - **BIR details LOCKED** - cannot be edited
   - Can register additional devices

4. **Rejected** ❌
   - Admin rejected submission
   - User notified with reason
   - Can resubmit with corrections

---

## 💾 Data Flow Summary

### Subscription Flow:
```
Company Settings > Subscription Tab
  └─> Select Plan
      └─> Select Store
          └─> Payment
              └─> Update Store.subscription
              └─> Create CompanyBillingHistory
```

### BIR Accreditation Flow:
```
Store Details > Check "BIR Accredited"
  └─> Open BIR Submission Popup
      └─> Fill Store BIR + Device BIR Details
          └─> Submit for Review
              └─> Admin Reviews in Backend
                  └─> If Approved:
                      ├─> Store.isBirAccredited = true
                      ├─> Create Device with BIR details
                      └─> Lock all BIR fields (read-only)
```

### View Billing History:
```
Company Settings > Stores Tab
  └─> Store Row > [Billing History] Button
      └─> Show Modal/Popup with CompanyBillingHistory
          Filtered by storeId
```

---

## 📁 Component Structure

```
src/app/pages/company-settings/
├── company-settings.component.ts (Main page with tabs)
│
├── tabs/
│   ├── profile-tab/
│   │   └── company-profile-tab.component.ts
│   │
│   ├── subscription-tab/
│   │   ├── subscription-tab.component.ts
│   │   ├── plan-card.component.ts
│   │   └── payment-modal.component.ts
│   │
│   └── stores-tab/
│       ├── stores-tab.component.ts (Grid/Table)
│       ├── store-billing-history-modal.component.ts
│       ├── store-details-modal.component.ts
│       └── bir-submission-modal.component.ts
│
└── shared/
    ├── billing-history-list.component.ts
    └── device-card.component.ts
```

---

## ✅ Key Features

1. **Subscribe at Company Level**
   - ✅ View all plans in Subscription tab
   - ✅ Select which store to upgrade
   - ✅ Apply promo codes
   - ✅ Multiple payment methods

2. **Billing History Under Stores**
   - ✅ Each store has its own billing history
   - ✅ View payments made for that store
   - ✅ Track promo codes and discounts
   - ✅ Export to CSV

3. **BIR Submission Popup**
   - ✅ Opens when checkbox is checked
   - ✅ Collects Store BIR + Device BIR details together
   - ✅ Submit for admin review
   - ✅ Show pending/approved/rejected status

4. **BIR Details Locked After Approval**
   - ✅ Once approved, cannot edit BIR fields
   - ✅ Prevents fraud and ensures compliance
   - ✅ Contact support for corrections
   - ✅ Can add new devices under same BIR registration

---

*Ready to build these components! 🚀*
