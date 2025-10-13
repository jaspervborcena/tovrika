# Quick Fix Guide - Offline Login Error

## 🚨 If you're seeing: "Invalid credentials or session expired"

### Quick Checks:

1. **Check Network Status**
   - Look at the top-right corner of the app
   - Is it showing 🌐 Online or 📱 Offline?

2. **Browser Says You're Online?**
   - Open browser console (F12)
   - Type: `console.log(navigator.onLine)`
   - Should return `true` if browser thinks you're online

3. **Force Refresh Network Status**
   - Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - This clears cache and reloads

---

## 🛠️ Solutions (Try in Order)

### Solution 1: Hard Refresh (Most Common Fix)
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```
This forces the browser to re-check network status and reload everything.

---

### Solution 2: Clear Site Data and Login Fresh

**Chrome:**
1. Press F12 to open DevTools
2. Go to Application tab
3. Click "Clear site data"
4. Close DevTools
5. Refresh page (F5)
6. Login again (must be online)

**Firefox:**
1. Press Ctrl + Shift + Delete
2. Select "Everything" in Time Range
3. Check "Cookies" and "Cache"
4. Click "Clear Now"
5. Refresh page
6. Login again

---

### Solution 3: Force Online Mode (Console Command)

**Open Browser Console (F12)**, then run:

```javascript
// Force the app to treat connection as online
localStorage.setItem('forceOnlineMode', 'true');

// Refresh the page
location.reload();
```

Then try logging in again.

---

### Solution 4: Check Actual Internet Connectivity

**Test if you can reach Firebase:**

Open Console (F12) and run:
```javascript
fetch('https://identitytoolkit.googleapis.com/v1/projects', { mode: 'no-cors' })
  .then(() => console.log('✅ Can reach Firebase'))
  .catch(() => console.log('❌ Cannot reach Firebase - Check firewall/VPN'));
```

If you see "❌ Cannot reach Firebase":
- Check if VPN is blocking
- Check if corporate firewall is blocking
- Try disabling browser extensions
- Try different network (mobile hotspot)

---

### Solution 5: Clear IndexedDB (Nuclear Option)

**Only if nothing else works:**

Open Console (F12) and run:
```javascript
// This will delete all offline data
indexedDB.deleteDatabase('tovrika-offline-db')
  .onsuccess = () => {
    console.log('✅ IndexedDB cleared');
    alert('Offline data cleared. Please login with internet connection.');
    location.reload();
  };
```

After this, you **MUST** login while online to re-establish offline access.

---

## 🔍 Debugging - Check Your Status

Run these in Console (F12) to diagnose:

### Check Browser Network Status:
```javascript
console.log('Browser online:', navigator.onLine);
```

### Check App Network Status:
```javascript
// Get network service
const root = document.querySelector('app-root');
if (root) {
  const injector = (root as any).__ngContext__?.[8];
  if (injector) {
    const networkService = injector.get(NetworkService);
    console.log('App network status:', networkService.getCurrentStatus());
  }
}
```

### Check Offline Credentials:
```javascript
async function checkOfflineAuth(email) {
  const request = indexedDB.open('tovrika-offline-db');
  request.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const getRequest = store.get(`offlineAuth_${email}`);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        const data = getRequest.result.value;
        const expiry = new Date(data.sessionExpiry);
        const now = new Date();
        console.log('Offline auth found for:', data.userProfile.email);
        console.log('Expires:', expiry);
        console.log('Expired?', expiry < now);
        console.log('Days remaining:', Math.floor((expiry - now) / (1000*60*60*24)));
      } else {
        console.log('❌ No offline credentials found');
      }
    };
  };
}

// Replace with your email
checkOfflineAuth('your-email@example.com');
```

---

## 📝 What Changed in the Fix

### Network Detection Improvements:
1. ✅ Timeout increased from 5s to 10s (more reliable on slow connections)
2. ✅ Multiple endpoints checked (favicon.ico + google.com)
3. ✅ Better error messages distinguish between "no offline access" vs "expired session"

### Better Error Messages:
- **Before:** "Invalid credentials or session expired..."
- **After:** 
  - "📱 No offline access available. Please connect to internet..."
  - "⏰ Offline session expired. Please login online to renew..."

---

## ✅ Prevention Tips

### To Avoid This Issue:

1. **Login Online First**
   - Always do your first login while connected to internet
   - This saves your credentials for offline use

2. **Refresh Offline Access Every Month**
   - Login online at least once every 30 days
   - This renews your offline session

3. **Check Network Indicator**
   - Always look at the top-right corner
   - Make sure it shows 🌐 Online before important tasks

4. **Keep Browser Updated**
   - Network detection works better on latest browsers
   - Update Chrome/Firefox/Edge regularly

---

## 🆘 Still Not Working?

If none of these solutions work:

1. **Try Different Browser**
   - Chrome, Firefox, or Edge
   - See if issue persists

2. **Try Different Network**
   - Mobile hotspot
   - Different WiFi
   - Helps identify network-specific issues

3. **Check Firebase Status**
   - Go to https://status.firebase.google.com/
   - Make sure Firebase is operational

4. **Contact Support**
   - Provide browser console logs (F12 → Console tab)
   - Mention which solutions you tried
   - Note your browser and OS version

---

## 📊 Technical Details (For Developers)

### Offline Session Lifecycle:

```
First Online Login
    ↓
Save to IndexedDB:
  - Email
  - Hashed password + salt
  - User profile
  - Expiry (30 days)
    ↓
User goes offline
    ↓
Offline Login Attempt
    ↓
Check IndexedDB
    ├─ Found + Valid → Login Success ✅
    ├─ Found + Expired → Error (need online login)
    └─ Not Found → Error (never logged in online)
```

### Network Detection Logic:

```
App Checks:
1. navigator.onLine
2. fetch('/favicon.ico') with 10s timeout
3. fetch('https://google.com/favicon.ico') with 10s timeout
4. If ANY succeed → Mark ONLINE
5. If ALL fail → Mark OFFLINE

Checks run:
- On app startup
- Every 30 seconds
- On window online/offline events
```

---

**Remember:** The improvements are now in place, so the app should be more reliable at detecting when you're actually online! 🎉
