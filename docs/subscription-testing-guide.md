# 🎯 Testing Your Subscription Management System

## 🌐 Access the Feature

Once the dev server is running (look for "Application bundle generation complete"):

1. Open browser: `http://localhost:4200`
2. Login to your account
3. Navigate to: **Dashboard → Company Profile**
4. Scroll down to see **"Store Subscriptions"** section

---

## 🖼️ What You'll See

### **Section Header**
```
┌─────────────────────────────────────────────────┐
│  Store Subscriptions          [+ Add Subscription] │
└─────────────────────────────────────────────────┘
```

### **Subscription Grid (if stores exist)**
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Store Name    │ Tier      │ Subscribed At  │ Expires At     │ Status   │ Actions │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Main Store    │ FREEMIUM  │ Oct 13, 2025  │ Nov 13, 2025  │ ACTIVE   │ [Upgrade] [View] │
│ Branch 1      │ STANDARD  │ Oct 1, 2025   │ Nov 1, 2025   │ ACTIVE   │ [Upgrade] [View] │
│ Branch 2      │ PREMIUM   │ Sep 15, 2025  │ Oct 15, 2025  │ EXPIRED  │ [Upgrade] [View] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### **Empty State (if no stores)**
```
┌─────────────────────────────────────────────────┐
│                    🏪                           │
│   No stores yet. Create a store to add         │
│           subscriptions.                        │
└─────────────────────────────────────────────────┘
```

---

## 🎬 Testing Scenarios

### **Scenario 1: Add Subscription to a Store**

**Steps:**
1. Click **"Add Subscription"** button
2. Modal opens showing 4 pricing tiers
3. Review features by clicking **"Compare Features"**
4. Click **"Select Plan"** on **Standard (₱599)**
5. Choose **"Monthly"** billing cycle
6. Enter promo code: **"LAUNCH50"** → Click "Apply"
7. See discount applied: ~~₱599~~ → **₱299.50** (50% off)
8. Choose payment method: **"GCash"**
9. Click **"Confirm Subscription"**
10. Alert: "Subscription activated successfully! 🎉"
11. Modal closes, grid updates showing new subscription

**Expected Result:**
- Store now shows **"Standard"** tier badge (purple)
- Status shows **"Active"** badge (green)
- Expires At shows date 1 month from today

---

### **Scenario 2: Upgrade Existing Subscription**

**Steps:**
1. Find a store with **"Standard"** tier
2. Click **"Upgrade"** button
3. Modal opens with current tier pre-selected
4. Select **"Premium (₱1,499)"** tier
5. Choose **"Quarterly"** billing cycle (3 months)
6. Total: ₱1,499 × 3 = **₱4,497**
7. No promo code needed
8. Choose payment: **"Bank Transfer"**
9. Click **"Confirm Subscription"**
10. Grid updates immediately

**Expected Result:**
- Store now shows **"Premium"** tier badge (gold)
- Expires At shows date 3 months from today
- Status remains **"Active"**

---

### **Scenario 3: View Subscription Details**

**Steps:**
1. Click **"View"** button on any store
2. Alert popup appears with details:

```
📊 Subscription Details

🏪 Store: Main Store
🎯 Tier: STANDARD
📅 Subscribed: Oct 13, 2025
⏰ Expires: Nov 13, 2025
💳 Status: ACTIVE
💰 Amount Paid: ₱599
🎁 Discount: 50%
💵 Final Amount: ₱299.50
🎟️ Promo Code: LAUNCH50
💳 Payment Method: GCASH
```

**Expected Result:**
- All subscription information displayed clearly
- User can see full payment history
- Close alert to return to grid

---

### **Scenario 4: Enterprise Tier (Custom Pricing)**

**Steps:**
1. Click **"Add Subscription"** button
2. Select **"Enterprise"** tier
3. Notice: **"Contact us for pricing"**
4. Click **"Select Plan"**
5. Payment method automatically set to **"Contact Tovrika Admin"**
6. Shows contact information:
   - 📧 Email: billing@tovrika.com
   - 📱 Phone: +63 917 123 4567
7. Message: "Our team will assist you with the subscription payment process."

**Expected Result:**
- User understands they need to contact admin
- No payment form shown
- Subscription marked as **"Pending"** until admin activates

---

### **Scenario 5: Promo Code Validation**

**Valid Promo Codes:**
- **LAUNCH50** → 50% off
- **FRIEND20** → 20% off
- **ANNUAL15** → 15% off (annual billing only)
- **WELCOME10** → 10% off

**Testing:**
1. Enter **"LAUNCH50"** → ✅ "50% discount applied!"
2. Enter **"INVALIDCODE"** → ❌ "Invalid promo code"
3. Enter **"ANNUAL15"** on monthly billing → ❌ "Valid for annual billing only"
4. Enter **"ANNUAL15"** on annual billing → ✅ "15% discount applied!"

---

### **Scenario 6: Expiring Soon Warning**

**Setup:**
1. Manually set a subscription expiry to 5 days from now in Firestore
2. Reload company profile page

**Expected Result:**
- Expiry date shows in **RED**
- Visual warning indicator
- User prompted to renew soon

---

## 🎨 Visual Elements to Check

### **Tier Badge Colors:**
- 🔵 **Freemium** → Light blue background, dark blue text
- 🟣 **Standard** → Light purple background, dark purple text
- 🟡 **Premium** → Light gold background, dark gold text
- 🟢 **Enterprise** → Light violet background, dark violet text

### **Status Badge Colors:**
- 🟢 **Active** → Light green background, dark green text
- ⚪ **Inactive** → Light gray background, dark gray text
- 🔴 **Expired** → Light red background, dark red text
- 🟠 **Cancelled** → Light orange background, dark orange text

### **Responsive Design:**
- Desktop: Full table layout
- Mobile: Stacked cards (if needed)
- Buttons scale properly

---

## 🐛 Common Issues & Solutions

### **Issue 1: No stores showing**
**Solution:** Create a store first in Store Management

### **Issue 2: Modal not opening**
**Solution:** Check browser console for errors

### **Issue 3: Subscription not saving**
**Solution:** 
- Check Firestore permissions
- Verify user has valid company ID
- Check network tab for API calls

### **Issue 4: Promo code not working**
**Solution:**
- Verify code is typed correctly (case-sensitive)
- Check if code is valid for selected billing cycle
- Ensure code hasn't expired

### **Issue 5: Payment method not showing**
**Solution:**
- All payment methods should be visible
- If "Contact Admin" not showing for Enterprise, check tier selection

---

## 📝 Data to Verify in Firestore

After creating a subscription, check Firestore:

**Path:** `stores/{storeId}`

**Expected Data:**
```json
{
  "storeName": "Main Store",
  "storeCode": "STORE001",
  "subscription": {
    "tier": "standard",
    "status": "active",
    "subscribedAt": "2025-10-13T00:00:00.000Z",
    "expiresAt": "2025-11-13T00:00:00.000Z",
    "billingCycle": "monthly",
    "durationMonths": 1,
    "amountPaid": 599,
    "discountPercent": 50,
    "finalAmount": 299.50,
    "promoCode": "LAUNCH50",
    "referralCodeUsed": "",
    "paymentMethod": "gcash",
    "lastPaymentDate": "2025-10-13T00:00:00.000Z"
  }
}
```

---

## ✅ Success Criteria

Your subscription system is working correctly if:

- ✅ Grid displays all stores with subscription info
- ✅ Modal opens when clicking "Add Subscription"
- ✅ All 4 tiers are visible and selectable
- ✅ Promo codes validate and apply discounts
- ✅ Payment methods are all available
- ✅ Subscription saves to Firestore correctly
- ✅ Grid updates immediately after saving
- ✅ "View" button shows complete details
- ✅ "Upgrade" button opens modal with current store
- ✅ Tier and status badges show correct colors
- ✅ Expiring subscriptions show warning
- ✅ Empty state appears when no stores exist

---

## 🎉 You're All Set!

Your subscription management system is now fully functional. Users can:

1. ✅ View all store subscriptions
2. ✅ Add new subscriptions with 4 tier options
3. ✅ Apply promo codes for discounts
4. ✅ Choose flexible billing cycles
5. ✅ Select from multiple payment methods
6. ✅ Upgrade existing subscriptions
7. ✅ View detailed subscription information
8. ✅ See expiry warnings for timely renewals

**Happy testing! 🚀**

---

## 📞 Need Help?

If you encounter any issues:

1. Check browser console for errors
2. Verify Firestore rules allow reads/writes
3. Ensure user is authenticated
4. Check that company profile exists
5. Verify stores collection has data

**All systems ready!** 🎯
