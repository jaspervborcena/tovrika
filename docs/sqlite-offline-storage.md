# SQLite Offline Storage

The app-managed offline cache uses `SqliteStorageService` and `sql.js`. `sql.js` runs SQLite in WebAssembly; this is not a native SQLite plugin. At app startup, the service initializes the schema and serializes the database to the `localStorage` key `tovrika_sqlite_database`; subsequent writes update the same entry.

## Stored Data

The current database schema contains:

- `settings` for app settings, offline credentials, and sync markers
- `users` for cached user profiles and permissions
- `products`, `orders`, `companies`, and `stores` for offline snapshots
- `notifications` for cached notifications
- `product_inventory` for cached inventory batches
- `offline_documents` for pending Firestore create, update, and delete operations

## Legacy Queue Migration

On initialization, the service imports valid entries from the legacy `pendingDocuments` localStorage key into `offline_documents`, persists the SQLite database, and removes the old queue key after migration. This migration covers the pending-document queue only. The retired app-owned IndexedDB database, `TovrikaOfflineDB`, is no longer used; deletion is requested when SQLite initializes. Its records are not migrated.

The app requests deletion once per browser session. If another open tab still has the legacy database open, deletion is blocked until that tab closes; this does not block or redirect app storage operations, which use SQLite.

## Separate Firebase Persistence

Firebase Auth and Firestore maintain their own browser persistence. Firestore is configured with `persistentLocalCache` and `persistentMultipleTabManager`; this SDK-managed persistence is separate from `SqliteStorageService` and may use browser IndexedDB internally.

## Troubleshooting

- Confirm `/assets/sql-wasm.wasm` loads successfully.
- Check that browser `localStorage` is available and has sufficient quota.
- The app-managed SQLite database is the `tovrika_sqlite_database` localStorage entry, created when app startup initializes SQLite. Removing it clears the app's local cache and pending queue; cached data will need to be downloaded again.
- `TovrikaOfflineDB` is retired app storage; deletion is requested at SQLite initialization. It is separate from Firebase's IndexedDB databases.
- Clearing browser IndexedDB affects Firebase SDK persistence, not the app-managed SQLite database.

## Validation

Run the focused storage specs with:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/services/sqlite-storage.service.spec.ts
```
