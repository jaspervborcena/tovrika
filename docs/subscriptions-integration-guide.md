# Quick Integration Guide - Add Subscriptions Link to Sidebar

## 📍 Add to Dashboard Sidebar Navigation

### File to Edit:
`src/app/pages/dashboard/dashboard.component.html`

### Location:
Find the sidebar navigation sections (around line 90-150)

### Code to Add:

**Add this section after "User Roles" and before "Products":**

```html
<!-- Subscriptions (creator only) -->
<div class="nav-section" *ngIf="permissions.canViewAccess">
  <h3 class="nav-section-title">Billing</h3>
  <div class="nav-items">
    <a routerLink="subscriptions" class="nav-item" [class.active]="isActiveNavItem('subscriptions')">
      <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <span>Subscriptions</span>
    </a>
  </div>
</div>
```

---

## 🎯 Alternative: Add to Company Section

**If you want it under Company Profile instead:**

```html
<!-- Company Profile (view only, all users) -->
<div class="nav-section" *ngIf="permissions.canViewCompanyProfile">
  <h3 class="nav-section-title">Company</h3>
  <div class="nav-items">
    <a routerLink="company-profile" class="nav-item" [class.active]="isActiveNavItem('company-profile')">
      <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 7v4a1 1 0 001 1h3V7a1 1 0 00-1-1H4a1 1 0 00-1 1zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v2m0 0h6m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2m0 0v4a1 1 0 01-1 1h-3V7a1 1 0 011-1h2a1 1 0 011 1zm0 0v6a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6m0 0H9" />
      </svg>
      <span>Company Profile</span>
    </a>
    
    <!-- ADD THIS LINK -->
    <a routerLink="subscriptions" class="nav-item" [class.active]="isActiveNavItem('subscriptions')" *ngIf="permissions.canViewAccess">
      <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <span>Subscriptions</span>
    </a>
  </div>
</div>
```

---

## 🔗 Add Modal to Company Profile

### File to Edit:
`src/app/pages/dashboard/company-profile/company-profile.component.ts`

### 1. Import the Modal Component

```typescript
import { SubscriptionModalComponent } from '../subscriptions/subscription-modal.component';
```

### 2. Add to Component Imports Array

```typescript
@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    SubscriptionModalComponent  // <-- ADD THIS
  ],
  // ...
})
```

### 3. Add Modal State Properties

```typescript
export class CompanyProfileComponent {
  // ... existing properties ...
  
  // Add these:
  showSubscriptionModal = signal(false);
  selectedStore = signal<Store | undefined>(undefined);
}
```

### 4. Add Modal Methods

```typescript
openSubscriptionModal(store?: Store) {
  this.selectedStore.set(store);
  this.showSubscriptionModal.set(true);
}

closeSubscriptionModal() {
  this.showSubscriptionModal.set(false);
}

async handleSubscription(data: any) {
  try {
    console.log('Subscription data:', data);
    
    // TODO: Call billing service to save payment
    // TODO: Update store subscription in Firestore
    
    alert('Subscription updated successfully!');
    this.closeSubscriptionModal();
  } catch (error) {
    console.error('Error updating subscription:', error);
    alert('Failed to update subscription');
  }
}
```

### 5. Add to Template (company-profile.component.html)

**Add at the bottom of the template:**

```html
<!-- Subscription Modal -->
<app-subscription-modal
  [isOpen]="showSubscriptionModal()"
  [store]="selectedStore()"
  (closeModal)="closeSubscriptionModal()"
  (subscriptionSubmitted)="handleSubscription($event)"
></app-subscription-modal>
```

### 6. Add Button to Open Modal

**Add this button somewhere in your company profile form:**

```html
<button 
  type="button" 
  (click)="openSubscriptionModal()"
  class="btn-subscription"
>
  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
  Manage Subscription
</button>
```

**Add CSS for the button:**

```css
.btn-subscription {
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

.btn-subscription:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
}

.btn-subscription .icon {
  width: 20px;
  height: 20px;
}
```

---

## 🧪 Testing Steps

### 1. Test Navigation
1. Login as creator role
2. Check sidebar for "Subscriptions" link
3. Click link → should navigate to `/dashboard/subscriptions`

### 2. Test Dashboard
1. Should see stats cards (stores, active, revenue)
2. Should see subscription grid
3. Test search functionality
4. Test status filter
5. Test tier filter
6. Test CSV export

### 3. Test Modal
1. Click "Upgrade" or "Renew" button on a store
2. Modal should open
3. Select different plans
4. Change billing cycle
5. Apply promo code
6. Fill payment form
7. Submit

### 4. Test Responsive
1. Resize browser to mobile width
2. Check layout adapts correctly
3. Test all interactions on mobile

---

## 🎨 Icon Options

**Credit Card Icon (Current):**
```html
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
```

**Dollar Sign Icon (Alternative):**
```html
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
```

**Receipt Icon (Alternative):**
```html
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
```

---

## 📋 Checklist

- [ ] Add "Subscriptions" link to sidebar
- [ ] Import SubscriptionModalComponent in company-profile
- [ ] Add modal state signals
- [ ] Add modal methods (open/close/handle)
- [ ] Add modal to template
- [ ] Add "Manage Subscription" button
- [ ] Test navigation
- [ ] Test modal functionality
- [ ] Test on mobile
- [ ] Connect to backend services

---

## 🚀 Quick Commands

**Navigate to subscriptions page:**
```typescript
this.router.navigate(['/dashboard/subscriptions']);
```

**Open modal programmatically:**
```typescript
this.showSubscriptionModal.set(true);
```

**Get current user's stores:**
```typescript
const stores = await this.storeService.getStoresByCompany(companyId);
```

---

## 💡 Tips

1. **Permission Check:** Use `permissions.canViewAccess` to restrict to creators only
2. **Loading State:** Show skeleton while loading stores
3. **Error Handling:** Add try-catch blocks for all async operations
4. **User Feedback:** Use toasts/alerts for success/error messages
5. **Analytics:** Track which plans users select most

---

That's it! You now have everything needed to integrate the subscription system into your application. 🎉
