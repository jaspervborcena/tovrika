# Offline Login Error - Diagnosis and Solution

**Date:** October 13, 2025  
**Error:** "Invalid credentials or session expired. Please login online to update your offline access."  
**Issue:** Application is showing as offline even when online

---

## 🔍 Root Cause Analysis

### Why You're Seeing "Offline" Mode:

The NetworkService is detecting you as **offline** for one of these reasons:

1. **Browser `navigator.onLine` reports false**
   - This is the initial check the app uses
   - Can be unreliable on some networks

2. **Connectivity check is failing**
   - The app tries to fetch `/favicon.ico` every 30 seconds
   - If this fails, it marks you as offline
   - 5-second timeout can be too short on slow connections

3. **Firebase endpoint is unreachable**
   - The auth service tries to reach Firebase servers
   - Network restrictions or firewall might block it

### Why "Invalid credentials" Error:

When the app detects offline mode, it tries to use **offline credentials** stored in IndexedDB:

```typescript
// From auth.service.ts line 671-679
async loginOffline(email: string, password: string) {
  const offlineAuthData = await this.validateOfflineCredentials(email, password);
  if (!offlineAuthData) {
    return {
      success: false,
      error: 'Invalid credentials or session expired. Please login online...'
    };
  }
}
```

**This error appears when:**
1. ❌ No offline credentials exist (never logged in online before)
2. ❌ Offline session has expired (default: 30 days)
3. ❌ Password doesn't match stored hash
4. ❌ IndexedDB data was cleared/corrupted

---

## 🛠️ Solutions

### Solution 1: Force Online Login (Quick Fix)

The NetworkService has a manual override method:

```typescript
// In browser console:
// Get the network service instance
const networkService = window['ng'].getComponent(document.body).injector.get(NetworkService);

// Force online mode
networkService.setOfflineMode(false);

// Then try logging in again
```

### Solution 2: Clear and Re-establish Offline Credentials

```typescript
// In browser console:
// Clear IndexedDB
indexedDB.deleteDatabase('tovrika-offline-db');

// Then refresh and login with internet connection
// This will re-save your credentials for offline use
```

### Solution 3: Increase Connectivity Check Timeout

Update the network check timeout to handle slow connections better.

### Solution 4: Add Better Network Detection

Add multiple fallback checks to determine true connectivity.

---

## 🔧 Code Fixes to Implement

### Fix 1: Improve Network Detection

**File:** `src/app/core/services/network.service.ts`

```typescript
private async checkConnectivity(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increase to 10 seconds
    
    // Try multiple endpoints for better reliability
    const endpoints = [
      '/favicon.ico',
      'https://www.google.com/favicon.ico',
      'https://firebasestorage.googleapis.com/v0/b/jasperpos-1dfd5.appspot.com/o/connectivity-check'
    ];
    
    let connected = false;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'no-cors' // Allow CORS for external URLs
        });
        connected = true;
        break;
      } catch (err) {
        console.log(`Network: Check failed for ${endpoint}`);
      }
    }
    
    clearTimeout(timeoutId);
    this.updateNetworkStatus(connected);
  } catch (error) {
    console.log('Network: All connectivity checks failed');
    this.updateNetworkStatus(false);
  }
}
```

### Fix 2: Add User-Friendly Error Messages

**File:** `src/app/services/auth.service.ts`

```typescript
async loginOffline(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    console.log('🔄 Attempting offline login for:', email);
    
    const offlineAuthData = await this.validateOfflineCredentials(email, password);
    if (!offlineAuthData) {
      // More helpful error message
      const hasAnyOfflineData = await this.hasOfflineAccess(email);
      
      if (!hasAnyOfflineData) {
        return {
          success: false,
          error: 'No offline access available. Please connect to the internet and login to enable offline mode.'
        };
      }
      
      return {
        success: false,
        error: 'Offline session has expired or password is incorrect. Please login online to renew your offline access.'
      };
    }
    
    // ... rest of method
  }
}
```

### Fix 3: Add Network Status Indicator in UI

**File:** `src/app/shared/components/app-header/app-header.component.ts`

Already exists! Check the header for network status indicator.

---

## 📋 Debugging Steps

### Check Current Network Status:

Open browser console and run:

```javascript
// Check browser's network status
console.log('Browser online:', navigator.onLine);

// Check app's network service
const appComponent = document.querySelector('app-root');
if (appComponent) {
  const networkService = ng.getComponent(appComponent).injector.get(NetworkService);
  console.log('App network status:', networkService.getCurrentStatus());
}

// Check for offline credentials
async function checkOfflineData() {
  const db = await indexedDB.databases();
  console.log('IndexedDB databases:', db);
  
  const request = indexedDB.open('tovrika-offline-db');
  request.onsuccess = (event) => {
    const db = event.target.result;
    console.log('Database stores:', db.objectStoreNames);
  };
}
checkOfflineData();
```

### Check Offline Credentials Expiry:

```javascript
// Check stored offline auth data
const checkExpiry = async () => {
  const request = indexedDB.open('tovrika-offline-db');
  request.onsuccess = (event) => {
    const db = event.target.result;
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = () => {
      const settings = getAllRequest.result;
      const offlineAuth = settings.filter(s => s.key?.startsWith('offlineAuth_'));
      console.log('Offline auth data:', offlineAuth);
      
      offlineAuth.forEach(auth => {
        const expiry = new Date(auth.value.sessionExpiry);
        const now = new Date();
        console.log(`User: ${auth.value.userProfile.email}`);
        console.log(`Expires: ${expiry}`);
        console.log(`Expired: ${expiry < now}`);
        console.log(`Days remaining: ${Math.floor((expiry - now) / (1000 * 60 * 60 * 24))}`);
      });
    };
  };
};
checkExpiry();
```

---

## 🎯 Immediate Action Items

### For End Users:

1. **Check Internet Connection**
   - Make sure you have active internet
   - Check if firewall/VPN is blocking Firebase domains

2. **Clear Cache and Login Online**
   - Clear browser cache
   - Ensure you're actually online
   - Login with valid credentials
   - This will save offline credentials for future use

3. **Check Network Status in App**
   - Look for network indicator in top-right corner
   - If showing offline but you're online, refresh the page

### For Developers:

1. **Implement Fix 1** - Improve network detection with multiple endpoints
2. **Implement Fix 2** - Better error messages
3. **Add logging** - More detailed logging for network status changes
4. **Test offline mode** - Ensure offline login works after online login
5. **Extend session expiry** - Consider 90 days instead of 30 days

---

## 📊 Network Detection Flow

```
App Startup
    ↓
Check navigator.onLine
    ↓
    ├─── TRUE (Browser says online)
    │       ↓
    │    Try fetch /favicon.ico (timeout: 5s)
    │       ↓
    │       ├─── SUCCESS → Mark as ONLINE
    │       └─── FAIL → Mark as OFFLINE
    │
    └─── FALSE (Browser says offline)
            ↓
         Mark as OFFLINE

Every 30 seconds:
    Repeat connectivity check

On Login:
    ↓
Check NetworkService.isOnline()
    ↓
    ├─── TRUE → Try Firebase Auth
    │       ↓
    │       ├─── SUCCESS → Save offline credentials
    │       └─── FAIL → Try offline login
    │
    └─── FALSE → Try offline login only
            ↓
         Check IndexedDB for credentials
            ↓
            ├─── Found & Valid → Login Success
            └─── Not Found / Expired → Show Error
```

---

## 🔐 Offline Session Details

**Default Settings:**
- **Session Duration:** 30 days
- **Storage:** IndexedDB (`tovrika-offline-db`)
- **Password:** Hashed with salt (not stored plain text)
- **Data Stored:**
  - User profile
  - Hashed password
  - Salt for password verification
  - Session expiry date
  - Last login timestamp

**When Session Expires:**
- User must login online to renew
- Offline credentials are cleared automatically
- New session is created with fresh 30-day expiry

---

## ✅ Verification Steps

After implementing fixes:

1. ✅ **Test Online Login**
   - Login with internet connection
   - Check that offline credentials are saved
   - Verify no errors in console

2. ✅ **Test Offline Login**
   - Disconnect internet (or use DevTools offline mode)
   - Try logging in with same credentials
   - Should succeed if session not expired

3. ✅ **Test Network Detection**
   - Toggle network on/off
   - Check that UI indicator updates correctly
   - Verify no false offline detection

4. ✅ **Test Session Expiry**
   - Manually set expiry date in past (DevTools)
   - Try offline login
   - Should show appropriate error message

---

## 🚀 Recommended Improvements

### Priority 1: Network Detection
- [ ] Implement multi-endpoint connectivity check
- [ ] Increase timeout from 5s to 10s
- [ ] Add retry logic (3 attempts)

### Priority 2: Error Messages
- [ ] Distinguish between "no credentials" vs "expired session"
- [ ] Show days until expiry in UI
- [ ] Add "Renew Offline Access" button

### Priority 3: User Experience
- [ ] Show network status prominently during login
- [ ] Add manual "Force Online Login" button
- [ ] Provide offline credential status in settings

### Priority 4: Robustness
- [ ] Extend session to 90 days
- [ ] Add offline data migration for schema changes
- [ ] Implement offline credential backup/restore

---

**Summary:** The error occurs when the app detects offline mode (either falsely or truly) and can't find valid offline credentials. The primary fix is to improve network detection and provide clearer guidance to users about offline mode requirements.
