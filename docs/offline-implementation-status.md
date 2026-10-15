# Offline Implementation Status

The app-managed offline cache uses `SqliteStorageService`. Firebase Auth and Firestore persistence remain SDK-managed and separate from this cache.

## ✅ Implemented Features

### Authentication
- **Offline Login**: Salted password authentication using credentials cached in SQLite settings
- **Session Management**: 1-30 day sessions with automatic expiry
- **User Data Caching**: User profile and permissions saved to the SQLite `users` table

### Data Persistence
- **Firestore Offline Mode**: Multi-tab persistence enabled through Firebase's Firestore SDK
- **Automatic Sync**: All offline writes queued and synced when online
- **Invoice Generation**: Offline invoice numbering with cache
- **User/Company Fallback**: SQLite cache fallback when memory is unavailable

### UI/UX
- **Network Status Indicator**: Shows "Offline Mode" banner
- **Dashboard Loading**: Graceful error handling for offline data loading
- **Offline Dialog Removed**: Auto-proceeds with invoice number

## ⚠️ Known Limitations

### First-Time Offline Use
- **Products**: Must be loaded online first to cache in Firestore
- **Stores**: Must be accessed online first to cache
- **Company Data**: Saved to SQLite on login, so an online session is needed to seed the cache initially

### Workaround
1. User must log in online at least once
2. User must visit POS and load products while online
3. Data is then cached and available offline

## 🔧 Technical Details

### Firestore Offline Persistence
```typescript
// Configured in app.config.ts
initializeFirestore(app, {
		localCache: persistentLocalCache({
			tabManager: persistentMultipleTabManager()
		})
});
```

### Data Storage Locations
- **User Credentials**: SQLite `settings` table (`offlineAuth_${uid}` keys)
- **User Profile**: SQLite `users` table
- **Companies and Stores**: SQLite `companies` and `stores` tables
- **Products and Pending Orders**: SQLite snapshots and `offline_documents` queue
- **Firestore Queries**: Firebase SDK-managed offline persistence, separate from the SQLite cache

### Offline Order Processing Flow
1. Check `navigator.onLine` status
2. Get user/company from SQLite if needed
3. Generate invoice number from cache
4. Save order to Firestore (queued automatically)
5. Order syncs to server when online

## 📝 Testing Offline Mode

1. **Login online first** to cache credentials
2. **Load products** while online to populate cache
3. **Go offline** (airplane mode or disable network)
4. **Login** with cached credentials
5. **Process orders** - they queue automatically
6. **Go online** - orders sync automatically

## 🐛 Troubleshooting

### "User or company not found"
- Check that the user has logged in online and the SQLite cache contains the required profile and company data.

### "Invoice transaction failed: Connection failed"
- ✅ Fixed: Added offline invoice transaction handler

### "No Internet" dialog on order completion
- ✅ Fixed: Removed offline invoice preference dialog

### Products not showing
- ⚠️ Limitation: Products must be loaded online first
- **Solution**: Ensure user visits POS while online before going offline

### Dashboard shows only "Offline Mode" banner
- ✅ Fixed: Added error handling to show dashboard even if data fails to load

## 📋 Recommendations

1. **Add offline data indicator**: Show users which data is cached
2. **Add manual sync button**: Let users trigger sync when back online
3. **Improve first-time offline**: Pre-cache essential data on login
4. **Add offline data expiry**: Warn users if cached data is too old
