# 🧪 TESTING CHECKLIST - Enterprise Request Feature

## 🚀 Server Status
✅ **Dev server running at:** `http://localhost:4200/`  
✅ **Build successful:** Company Profile = 178.77 kB  
✅ **All features loaded:** Subscription modal with enterprise request  

---

## 📋 Step-by-Step Testing Guide

### **Test 1: Navigate to Company Profile**

**Steps:**
1. Open browser: `http://localhost:4200/`
2. Login with your credentials
3. Click on **"Dashboard"** in sidebar
4. Click on **"Company Profile"** menu item
5. Scroll down to see **"Store Subscriptions"** section

**✅ Expected Results:**
- [ ] Company Profile page loads successfully
- [ ] "Store Subscriptions" section is visible
- [ ] If stores exist: Grid shows store names, tiers, status
- [ ] If no stores: "No stores yet. Create a store to add subscriptions." message appears
- [ ] "Add Subscription" button is visible (if stores exist)

**📸 What to Look For:**
- Clean, modern design with gradient header
- Subscription grid with proper spacing
- Color-coded tier badges (Freemium=Blue, Standard=Purple, Premium=Gold)
- Status badges (Active=Green, Inactive=Gray, Expired=Red)

---

### **Test 2: Open Subscription Modal**

**Steps:**
1. In Company Profile page
2. Click **"Add Subscription"** button
3. Modal opens with overlay

**✅ Expected Results:**
- [ ] Modal opens with smooth animation
- [ ] Dark overlay covers background
- [ ] Modal title shows "Choose Your Plan"
- [ ] Billing cycle selector visible (Monthly, Quarterly, Yearly)
- [ ] **4 pricing boxes displayed** (NOT 3!)
- [ ] Close button (X) in top-right corner works

**📸 What to Look For:**
- Modal is centered on screen
- All 4 plan cards are visible side-by-side (desktop)
- Cards stack nicely on mobile

---

### **Test 3: Verify 4 Pricing Tiers**

**Steps:**
1. Modal is open
2. Look at the pricing grid

**✅ Expected Results - 4 Boxes:**

**Box 1: Freemium**
- [ ] Name: "Freemium"
- [ ] Price: ₱0/month
- [ ] Badge: Blue background
- [ ] Features listed (30-day trial, 1 store, etc.)
- [ ] Button: "Select Plan"

**Box 2: Standard**
- [ ] Name: "Standard"
- [ ] Price: ₱599/month
- [ ] Badge: "Most Popular" (if configured)
- [ ] Purple background badge
- [ ] Features listed (2 stores, 4 devices, etc.)
- [ ] Button: "Select Plan"

**Box 3: Premium**
- [ ] Name: "Premium"
- [ ] Price: ₱1,499/month
- [ ] Gold background badge
- [ ] Features listed (5 stores, 10 devices, etc.)
- [ ] Button: "Select Plan"

**Box 4: Enterprise** ⭐
- [ ] Name: "Enterprise"
- [ ] Price: **"Contact us for pricing"** (NOT a number!)
- [ ] Background: Purple-blue **gradient** (stands out!)
- [ ] Badge: **"Custom Solution"** in gold (top-right corner)
- [ ] Features listed (Unlimited everything, API, Custom domain)
- [ ] Button: **"Request Enterprise"** (different text!)

**📸 What to Look For:**
- Enterprise card has gradient background (different from others)
- Enterprise card has gold "Custom Solution" badge
- Button text says "Request Enterprise" not "Select Plan"
- Pricing text is different: "Contact us for pricing"

---

### **Test 4: Select Enterprise Tier**

**Steps:**
1. Click on the **Enterprise** card (4th box)
2. Card should highlight

**✅ Expected Results:**
- [ ] Enterprise card gets **gold border glow**
- [ ] Button changes to "Selected - Request ✓"
- [ ] Other cards are not selected
- [ ] Bottom action button changes to **"Request Enterprise"**

**📸 What to Look For:**
- Gold border animation on Enterprise card
- Checkmark appears in button

---

### **Test 5: Open Enterprise Request Form**

**Steps:**
1. Enterprise card is selected (gold border)
2. Scroll to bottom of modal
3. Click **"Request Enterprise"** button

**✅ Expected Results:**
- [ ] View changes from pricing to request form
- [ ] Large building icon appears at top
- [ ] Title: "Request Enterprise Plan"
- [ ] Subtitle explains the process

**📸 What to Look For:**
- Form layout is clean and organized
- Icon is centered and visible
- Typography is clear and readable

---

### **Test 6: Verify Auto-Filled Information**

**Steps:**
1. In Enterprise Request Form
2. Look at the "Info Grid" section (gray background)

**✅ Expected Results - 4 Fields (Auto-Filled, Read-Only):**
- [ ] **Company:** Shows your company name (e.g., "Brew Organics Inc")
- [ ] **Email:** Shows your email (e.g., "jasper.borcena@forda.com")
- [ ] **Phone:** Shows company phone or "Not provided"
- [ ] **Request Date:** Shows today's date (Oct 13, 2025)

**📸 What to Look For:**
- All 4 fields are filled automatically
- Data is correct (matches your profile)
- Fields are in a 2x2 grid with gray background
- Labels are uppercase and small

---

### **Test 7: Test Notes Field (Only Editable Field)**

**Steps:**
1. Find the large textarea labeled "What are your specific requirements?"
2. Try typing in it

**✅ Expected Results:**
- [ ] Textarea is **editable** (only field you can edit!)
- [ ] Red asterisk (*) indicates it's required
- [ ] Placeholder text provides helpful guidance:
  ```
  Please describe your needs:
  • Number of stores and devices
  • Custom domain requirements
  • Integration needs (accounting, inventory, etc.)
  • Special features or customizations
  • Expected transaction volume
  • Any other specific requirements
  ```
- [ ] Helper text with lightbulb icon below: "💡 The more details you provide..."
- [ ] Textarea expands as you type

**📸 What to Type (Test Data):**
```
We need:
- Custom domain: breworganics.tovrika.com
- 10 stores across Metro Manila
- 50 POS devices
- Integration with QuickBooks for accounting
- Audit logging for BIR compliance
- Support for 100K+ transactions per month
- White-label branding with our logo
```

---

### **Test 8: Verify Enterprise Benefits Section**

**Steps:**
1. Scroll down in the form
2. Find the "What You Get with Enterprise:" section

**✅ Expected Results:**
- [ ] Purple-gradient background box
- [ ] Title: "What You Get with Enterprise:"
- [ ] 6 benefits listed with green checkmarks:
  - ✅ Unlimited stores, devices, and transactions
  - ✅ Custom domain (yourcompany.tovrika.com)
  - ✅ White-label branding options
  - ✅ Priority 24/7 dedicated support
  - ✅ API access for custom integrations
  - ✅ Advanced security and compliance features

**📸 What to Look For:**
- Green checkmark icons
- Benefits are clearly listed
- Purple gradient background matches branding

---

### **Test 9: Verify Contact Info Box**

**Steps:**
1. Below benefits section
2. Find yellow highlighted box

**✅ Expected Results:**
- [ ] Yellow background box
- [ ] Text: "📞 Our team will contact you within **24 hours** to discuss your requirements."
- [ ] "24 hours" is bold
- [ ] Phone emoji visible

**📸 What to Look For:**
- Yellow/gold warning-style box
- Clear timeline (24 hours)
- Reassuring message

---

### **Test 10: Test Submit Button States**

**Steps:**
1. With notes field **EMPTY**
2. Try clicking "Submit Request" button

**✅ Expected Results:**
- [ ] Button is **DISABLED** (grayed out)
- [ ] Cursor shows "not-allowed" on hover
- [ ] Nothing happens when clicked

**Now, Steps:**
3. Type something in notes field (any text)
4. Look at "Submit Request" button

**✅ Expected Results:**
- [ ] Button becomes **ENABLED** (purple gradient)
- [ ] Button is clickable
- [ ] Hover effect shows (slight raise + glow)

**📸 What to Look For:**
- Clear visual difference between disabled/enabled states
- Smooth transition when field is filled

---

### **Test 11: Test Back Button**

**Steps:**
1. In Enterprise Request Form
2. Click **"Back"** button (bottom-left)

**✅ Expected Results:**
- [ ] Returns to 4-tier pricing view
- [ ] Enterprise card is still selected (gold border)
- [ ] Can navigate back and forth without losing data

**📸 What to Look For:**
- Smooth transition back to pricing view
- No errors in console

---

### **Test 12: Submit Enterprise Request**

**Steps:**
1. Fill in notes field with meaningful text (see Test 7 example)
2. Click **"Submit Request"** button
3. Wait for response

**✅ Expected Results:**
- [ ] Success alert appears:
  ```
  🎉 Enterprise request submitted successfully!
  
  Our team will review your request and contact you within 24 hours.
  ```
- [ ] Modal **closes automatically** after clicking OK
- [ ] Returns to Company Profile page
- [ ] No errors in browser console

**📸 What to Look For:**
- Success message is clear and friendly
- Modal closes smoothly
- Page state is preserved

---

### **Test 13: Verify Firestore Data**

**Steps:**
1. After submitting request
2. Open Firebase Console: https://console.firebase.google.com
3. Select your project
4. Go to **Firestore Database**
5. Find collection: **`subscriptionRequests`**
6. Look for your document

**✅ Expected Document Structure:**
```json
{
  "companyId": "your-company-id",
  "companyName": "Your Company Name",
  "ownerEmail": "your@email.com",
  "contactPhone": "+639171234567",
  "requestedAt": "2025-10-13T14:21:00.000Z",
  "requestedTier": "enterprise",
  "notes": "We need: Custom domain: breworganics.tovrika.com...",
  "status": "pending",
  "reviewedAt": null,
  "reviewedBy": null
}
```

**✅ Verify Each Field:**
- [ ] `companyId` matches your company
- [ ] `companyName` is correct
- [ ] `ownerEmail` is your email
- [ ] `contactPhone` is correct (or empty if not provided)
- [ ] `requestedAt` is current timestamp
- [ ] `requestedTier` is "enterprise"
- [ ] `notes` contains your typed requirements
- [ ] `status` is "pending"
- [ ] `reviewedAt` is null
- [ ] `reviewedBy` is null

**📸 What to Look For:**
- Document exists in Firestore
- All fields are populated correctly
- Status is "pending"

---

### **Test 14: Test Multiple Requests**

**Steps:**
1. Go back to Company Profile
2. Click "Add Subscription" again
3. Select Enterprise
4. Submit a different request with different notes

**✅ Expected Results:**
- [ ] Second request submits successfully
- [ ] New document created in Firestore
- [ ] Each request has unique ID
- [ ] Both documents visible in `subscriptionRequests` collection

**📸 What to Look For:**
- No duplicate prevention (users can submit multiple requests)
- Each request is independent

---

### **Test 15: Responsive Design (Mobile)**

**Steps:**
1. Open browser DevTools (F12)
2. Click responsive design mode
3. Set device to "iPhone 12" or similar
4. Repeat Tests 1-12

**✅ Expected Results:**
- [ ] Pricing cards stack vertically (1 column)
- [ ] Enterprise card still has gradient and badge
- [ ] Form is easily readable on mobile
- [ ] Buttons are full-width on mobile
- [ ] Info grid becomes 1 column
- [ ] No horizontal scrolling needed

**📸 What to Look For:**
- Everything is thumb-friendly
- Text is readable without zooming
- No layout breaking

---

## 🐛 Common Issues & Solutions

### **Issue 1: Enterprise card not showing gradient**
**Solution:** Clear browser cache, hard refresh (Ctrl+Shift+R)

### **Issue 2: "Request Enterprise" button not appearing**
**Solution:** Check if SUBSCRIPTION_PLANS config has 4 items including enterprise tier

### **Issue 3: Form shows old company/email data**
**Solution:** 
- Check if user is logged in
- Verify company profile exists
- Check CompanyService and AuthService are working

### **Issue 4: Submit button stays disabled even with text**
**Solution:** Check if notes field is actually binding to signal properly

### **Issue 5: Firestore document not creating**
**Solution:**
- Check Firestore rules allow writes to `subscriptionRequests`
- Check Firebase connection is active
- Look for errors in browser console

### **Issue 6: Modal doesn't close after submit**
**Solution:** Check if `close()` method is being called in `submitEnterpriseRequest()`

---

## ✅ Success Criteria

Your implementation is successful if:

1. ✅ **4 pricing tiers display** (Freemium, Standard, Premium, Enterprise)
2. ✅ **Enterprise has unique styling** (gradient, gold badge, custom pricing text)
3. ✅ **Request form opens** when Enterprise selected
4. ✅ **Company info auto-fills** (only notes field is editable)
5. ✅ **Submit button validates** (disabled when notes empty)
6. ✅ **Request saves to Firestore** with correct structure
7. ✅ **Success message shows** and modal closes
8. ✅ **Responsive design works** on mobile
9. ✅ **No console errors** during entire flow
10. ✅ **Data persists in Firestore** after submission

---

## 📊 Testing Results Template

Copy this and fill it out:

```
TESTING SESSION: October 13, 2025
Tester: [Your Name]
Browser: [Chrome/Firefox/Safari]
Device: [Desktop/Mobile]

✅ Test 1: Navigate to Company Profile - PASS/FAIL
✅ Test 2: Open Subscription Modal - PASS/FAIL
✅ Test 3: Verify 4 Pricing Tiers - PASS/FAIL
✅ Test 4: Select Enterprise Tier - PASS/FAIL
✅ Test 5: Open Enterprise Request Form - PASS/FAIL
✅ Test 6: Verify Auto-Filled Information - PASS/FAIL
✅ Test 7: Test Notes Field - PASS/FAIL
✅ Test 8: Verify Enterprise Benefits - PASS/FAIL
✅ Test 9: Verify Contact Info Box - PASS/FAIL
✅ Test 10: Test Submit Button States - PASS/FAIL
✅ Test 11: Test Back Button - PASS/FAIL
✅ Test 12: Submit Enterprise Request - PASS/FAIL
✅ Test 13: Verify Firestore Data - PASS/FAIL
✅ Test 14: Test Multiple Requests - PASS/FAIL
✅ Test 15: Responsive Design - PASS/FAIL

OVERALL: PASS/FAIL

Issues Found: [List any issues]
Notes: [Any additional observations]
```

---

## 🎯 Start Testing Now!

**Open your browser:**  
👉 `http://localhost:4200/`

**Follow the tests in order:**  
Start with Test 1 and work your way down!

**Report back with:**
- Screenshots of the 4 pricing tiers
- Screenshot of the enterprise request form
- Screenshot of Firestore document created

Good luck! 🚀✨
