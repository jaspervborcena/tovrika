# 🎯 Final Implementation Plan - Subscription Management in Company Profile

## ✅ What We've Built So Far

### 1. **Subscription Plans Config** ✅ 
`src/app/shared/config/subscription-plans.config.ts`
- 4 realistic tiers: Freemium (₱0), Standard (₱599), Premium (₱1,499), Enterprise (Custom)
- 20+ feature comparisons
- Promo code system
- Helper functions for price calculation

### 2. **Subscriptions Dashboard** ✅
`src/app/pages/dashboard/subscriptions/`
- Grid view of all store subscriptions
- Stats cards
- Search & filters
- CSV export

### 3. **Subscription Modal** ✅
`src/app/pages/dashboard/subscriptions/subscription-modal.component.*`
- Plan selection with feature comparison
- Promo code validation
- Payment form
- Order summary

---

## 🎯 Next Steps: Company Profile Integration

### **What You Requested:**
1. ✅ Show subscription summary in company profile
2. ✅ "Add Subscription" button opens modal
3. ✅ User selects plan → sees summary → agrees → chooses payment
4. ✅ Payment options: Card, E-wallet, or "Contact Tovrika Admin"
5. ✅ Save subscription data to `stores.subscription`
6. ✅ Show grid in company profile: Store Name, Tier, Created, Expiry, Status

---

## 📋 **Implementation Plan**

### **Step 1: Add Subscription Grid to Company Profile**

**File:** `company-profile.component.html`

**Location:** After company form, before closing `</div>`

```html
<!-- Subscription Management Section -->
<div class="subscription-section">
  <div class="section-header">
    <h2>Store Subscriptions</h2>
    <button (click)="openSubscriptionModal()" class="btn-add-subscription">
      <svg><!-- icon --></svg>
      Add Subscription
    </button>
  </div>

  <!-- Subscription Grid -->
  <div class="subscription-grid" *ngIf="stores().length > 0">
    <table class="subscription-table">
      <thead>
        <tr>
          <th>Store Name</th>
          <th>Tier</th>
          <th>Subscribed At</th>
          <th>Expires At</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (store of stores(); track store.id) {
          <tr>
            <td>{{ store.storeName }}</td>
            <td>
              <span [class]="getTierBadgeClass(store.subscription.tier)">
                {{ store.subscription.tier | titlecase }}
              </span>
            </td>
            <td>{{ formatDate(store.subscription.subscribedAt) }}</td>
            <td [class.expiring]="isExpiringSoon(store.subscription.expiresAt)">
              {{ formatDate(store.subscription.expiresAt) }}
            </td>
            <td>
              <span [class]="getStatusBadgeClass(store.subscription.status)">
                {{ store.subscription.status | titlecase }}
              </span>
            </td>
            <td>
              <button (click)="upgradeSubscription(store)" class="btn-action">
                Upgrade
              </button>
              <button (click)="viewSubscriptionDetails(store)" class="btn-action">
                View
              </button>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>

  <!-- Empty State -->
  <div class="empty-state" *ngIf="stores().length === 0">
    <p>No stores yet. Create a store to add subscriptions.</p>
  </div>
</div>

<!-- Subscription Modal -->
<app-subscription-modal
  [isOpen]="showSubscriptionModal()"
  [store]="selectedStore()"
  (closeModal)="closeSubscriptionModal()"
  (subscriptionSubmitted)="handleSubscription($event)"
></app-subscription-modal>
```

---

### **Step 2: Update Company Profile Component**

**File:** `company-profile.component.ts`

**Add imports:**
```typescript
import { SubscriptionModalComponent } from '../subscriptions/subscription-modal.component';
import { StoreService } from '../../../services/store.service';
import { BillingService } from '../../../services/billing.service';
```

**Add to imports array:**
```typescript
imports: [
  // ... existing imports
  SubscriptionModalComponent
]
```

**Add properties:**
```typescript
showSubscriptionModal = signal(false);
selectedStore = signal<Store | undefined>(undefined);
stores = signal<Store[]>([]);
```

**Add methods:**
```typescript
async loadStores() {
  const permission = this.authService.getCurrentPermission();
  if (!permission?.companyId) return;
  
  const storesData = await this.storeService.getStoresByCompany(permission.companyId);
  this.stores.set(storesData);
}

openSubscriptionModal(store?: Store) {
  this.selectedStore.set(store);
  this.showSubscriptionModal.set(true);
}

closeSubscriptionModal() {
  this.showSubscriptionModal.set(false);
}

async handleSubscription(data: any) {
  try {
    const store = this.selectedStore();
    if (!store) {
      alert('Please select a store first');
      return;
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

    // Create subscription data
    const subscriptionData: Partial<Store> = {
      subscription: {
        tier: data.tier,
        status: 'active',
        subscribedAt: new Date(),
        expiresAt: expiresAt,
        billingCycle: data.billingCycle,
        durationMonths: 1,
        amountPaid: data.amountPaid,
        discountPercent: data.discountPercent,
        finalAmount: data.finalAmount,
        promoCode: data.promoCode,
        referralCodeUsed: data.referralCode,
        paymentMethod: data.paymentMethod || 'gcash',
        lastPaymentDate: new Date()
      }
    };

    // Update store subscription
    await this.storeService.updateStore(store.id!, subscriptionData);

    // Create billing history record
    await this.billingService.createBillingHistory({
      storeId: store.id!,
      subscriptionTier: data.tier,
      amountPaid: data.amountPaid,
      discountPercent: data.discountPercent,
      finalAmount: data.finalAmount,
      promoCode: data.promoCode,
      referralCodeUsed: data.referralCode,
      paymentDate: new Date(),
      paymentMethod: data.paymentMethod || 'gcash',
      billingCycle: data.billingCycle,
      status: 'completed'
    });

    alert('Subscription activated successfully!');
    this.closeSubscriptionModal();
    await this.loadStores(); // Reload stores
  } catch (error) {
    console.error('Error activating subscription:', error);
    alert('Failed to activate subscription');
  }
}

upgradeSubscription(store: Store) {
  this.openSubscriptionModal(store);
}

viewSubscriptionDetails(store: Store) {
  // TODO: Show detailed subscription modal
  console.log('View details for:', store);
}

getTierBadgeClass(tier: string): string {
  const baseClasses = 'tier-badge';
  switch (tier) {
    case 'freemium': return `${baseClasses} tier-freemium`;
    case 'standard': return `${baseClasses} tier-standard`;
    case 'premium': return `${baseClasses} tier-premium`;
    case 'enterprise': return `${baseClasses} tier-enterprise`;
    default: return baseClasses;
  }
}

getStatusBadgeClass(status: string): string {
  const baseClasses = 'status-badge';
  switch (status) {
    case 'active': return `${baseClasses} status-active`;
    case 'inactive': return `${baseClasses} status-inactive`;
    case 'expired': return `${baseClasses} status-expired`;
    case 'cancelled': return `${baseClasses} status-cancelled`;
    default: return baseClasses;
  }
}

formatDate(date: Date): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

isExpiringSoon(expiresAt: Date): boolean {
  if (!expiresAt) return false;
  const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}
```

**Call loadStores in ngOnInit:**
```typescript
ngOnInit() {
  // ... existing code
  this.loadStores();
}
```

---

### **Step 3: Add CSS Styles**

**File:** `company-profile.component.css`

```css
/* Subscription Section */
.subscription-section {
  margin-top: 3rem;
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.btn-add-subscription {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-subscription:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
}

/* Subscription Table */
.subscription-table {
  width: 100%;
  border-collapse: collapse;
}

.subscription-table thead {
  background: #f9fafb;
}

.subscription-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #6b7280;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid #e5e7eb;
}

.subscription-table td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.subscription-table tbody tr:hover {
  background: #f9fafb;
}

/* Badges */
.tier-badge,
.status-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tier-freemium {
  background: #dbeafe;
  color: #1e40af;
}

.tier-standard {
  background: #e0e7ff;
  color: #5b21b6;
}

.tier-premium {
  background: #fef3c7;
  color: #92400e;
}

.tier-enterprise {
  background: #f3e8ff;
  color: #6b21a8;
}

.status-active {
  background: #d1fae5;
  color: #065f46;
}

.status-inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.status-expired {
  background: #fee2e2;
  color: #991b1b;
}

.status-cancelled {
  background: #fed7aa;
  color: #9a3412;
}

/* Expiring Soon */
td.expiring {
  color: #dc2626;
  font-weight: 600;
}

/* Action Buttons */
.btn-action {
  padding: 0.5rem 1rem;
  margin-right: 0.5rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.empty-state p {
  font-size: 1rem;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .btn-add-subscription {
    width: 100%;
    justify-content: center;
  }

  .subscription-table {
    font-size: 0.875rem;
  }

  .subscription-table th,
  .subscription-table td {
    padding: 0.75rem 0.5rem;
  }
}
```

---

## 🎯 **Payment Flow**

### **In subscription-modal.component.ts**, add payment method selection:

```typescript
// Update payment form to include "Contact Admin" option
paymentMethod = signal<'gcash' | 'paymaya' | 'bank_transfer' | 'credit_card' | 'admin_contact'>('gcash');
```

### **In subscription-modal.component.html**, update payment method selector:

```html
<div class="payment-method-selector">
  <label>
    <input type="radio" name="paymentMethod" value="gcash" 
           [checked]="paymentMethod() === 'gcash'"
           (change)="paymentMethod.set('gcash')" />
    <span>GCash</span>
  </label>
  <label>
    <input type="radio" name="paymentMethod" value="paymaya" 
           [checked]="paymentMethod() === 'paymaya'"
           (change)="paymentMethod.set('paymaya')" />
    <span>PayMaya</span>
  </label>
  <label>
    <input type="radio" name="paymentMethod" value="credit_card" 
           [checked]="paymentMethod() === 'credit_card'"
           (change)="paymentMethod.set('credit_card')" />
    <span>Credit/Debit Card</span>
  </label>
  <label>
    <input type="radio" name="paymentMethod" value="admin_contact" 
           [checked]="paymentMethod() === 'admin_contact'"
           (change)="paymentMethod.set('admin_contact')" />
    <span>📞 Contact Tovrika Admin</span>
  </label>
</div>

<!-- Show contact info if admin_contact selected -->
@if (paymentMethod() === 'admin_contact') {
  <div class="admin-contact-info">
    <p>📱 <strong>Contact Tovrika Admin for payment:</strong></p>
    <p>Email: billing@tovrika.com</p>
    <p>Phone: +63 917 123 4567</p>
    <p>Our team will assist you with the subscription payment process.</p>
  </div>
}
```

---

## ✅ **Testing Checklist**

- [ ] Open company profile page
- [ ] See "Add Subscription" button
- [ ] Click button → modal opens
- [ ] Select plan (Standard ₱599)
- [ ] Fill payment details (or select "Contact Admin")
- [ ] Confirm → saves to store.subscription
- [ ] See store in subscription grid
- [ ] Verify tier badge shows correctly
- [ ] Verify status shows "Active"
- [ ] Check expiry date (1 month from now)
- [ ] Click "Upgrade" → modal reopens
- [ ] Select higher tier → saves
- [ ] Check billing history created

---

##  🎉 **Summary**

This implementation gives you:
1. ✅ Subscription grid in company profile
2. ✅ Modal for plan selection
3. ✅ Payment method selection (including "Contact Admin")
4. ✅ Automatic saving to `stores.subscription`
5. ✅ Billing history tracking
6. ✅ Visual status badges
7. ✅ Upgrade functionality

Ready to implement? Let me know if you want me to proceed with these changes!
