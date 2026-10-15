# SQLite Offline Storage

The app-managed offline cache uses `SqliteStorageService` and `sql.js`. `sql.js` runs SQLite in WebAssembly; this is not a native SQLite plugin. In the browser build, the service serializes the database to the `localStorage` key `tovrika_sqlite_database` after writes.

## Stored Data

The current database schema contains:

- `settings` for app settings, offline credentials, and sync markers
- `users` for cached user profiles and permissions
- `products`, `orders`, `companies`, and `stores` for offline snapshots
- `notifications` for cached notifications
- `product_inventory` for cached inventory batches
- `offline_documents` for pending Firestore create, update, and delete operations

## Legacy Queue Migration

On initialization, the service imports valid entries from the legacy `pendingDocuments` localStorage key into `offline_documents`, persists the SQLite database, and removes the old queue key after migration. This migration covers the pending-document queue only. It does not migrate records from the retired app-owned IndexedDB database.

## Separate Firebase Persistence

Firebase Auth and Firestore maintain their own browser persistence. Firestore is configured with `persistentLocalCache` and `persistentMultipleTabManager`; this SDK-managed persistence is separate from `SqliteStorageService` and may use browser IndexedDB internally.

## Troubleshooting

- Confirm `/assets/sql-wasm.wasm` loads successfully.
- Check that browser `localStorage` is available and has sufficient quota.
- The app-managed SQLite database is the `tovrika_sqlite_database` localStorage entry. Removing it clears the app's local cache and pending queue; cached data will need to be downloaded again.
- Clearing browser IndexedDB affects Firebase SDK persistence, not the app-managed SQLite database.

## Validation

Run the focused storage specs with:

```powershell
npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/services/sqlite-storage.service.spec.ts
```
