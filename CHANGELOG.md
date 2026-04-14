# Changelog — Tovrika POS

All notable changes to this project are documented in this file.

---

## [1.0.1] — 2026-04-08

### Overview
Version 1.0.1 is a data integrity and auditability release. The primary focus is stamping every Firestore document with the app version that created it, adding critical missing fields to `ordersSellingTracking` and `orders` documents, and tightening the inventory reporting pipeline. No breaking changes — all existing documents remain valid.

---

### Commits in this Release

#### `latest` — fix: export to Excel filters completed orders only *(Apr 8, 2026)*
- **Sales Summary export** (`exportSalesSummaryToExcel`) now filters to `status === 'completed'` orders before building the Excel file
- Fixes mismatch where UI showed **Total Orders: 123 / Total Items: 205** but exported file showed **124 orders / 180 items**
- Root cause: `filteredOrders()` included all statuses (cancelled, returned, etc.) while the UI `totalOrders` card already filtered to `completed` only
- Export now matches the dashboard numbers exactly

#### `f12cc71` — update version *(Apr 8, 2026)*
- Added `version: environment.version` stamp to **all 8 document-creation paths** across `ordersSellingTracking`:
  - `returned` documents (`markOrderTrackingReturned`)
  - `refunded` documents (`markOrderTrackingRefunded`)
  - status-change documents (`updateOrderTrackingStatus` — damage, partial damage, etc.)
  - `damaged` documents (`markOrderTrackingDamaged`)
  - `unpaid` documents from order (`createUnpaidTrackingFromOrder`)
  - `unpaid` documents from tracking (`markOrderTrackingUnpaid`)
  - `recovered` documents (`markOrderTrackingRecovered`)
  - backfill documents (`backfillOrdersSellingTrackingFromOrders`)
- Version value is sourced from `environment.version` so it updates automatically with each release bump

#### `714cc6e` — feat: add invoiceNumber, version, costPrice, skuId, tags, tagLabels to ordersSellingTracking and orders docs *(Apr 7, 2026)*
- **`ordersSellingTracking` documents** now include:
  - `invoiceNumber` — links each tracking item back to the printed invoice
  - `version` — app version at time of write (`'1.0.1'`)
  - `costPrice` — unit cost at time of sale for profit tracking
  - `skuId` — product SKU for cross-referencing inventory and reporting
  - `tags` — product tags carried through from the product catalog
  - `tagLabels` — human-readable tag labels for filtering and exports
- **`orders` documents** now include:
  - `version` — app version at time of order creation
- **Interface updated** (`orders-selling-tracking.interface.ts`) — all new fields added with proper TypeScript types
- **Inventory report** (`inventory.service.ts`) — grouping logic updated to use `skuId` for accurate per-SKU aggregation
- **POS service** (`pos.service.ts`) — cart items now carry `tags`, `tagLabels`, `skuId`, and `costPrice` through to tracking
- **Print services** (`print.service.android.ts`, `print.service.web.ts`, `thermal-printer.service.ts`) — receipt data enriched with `invoiceNumber` and `skuId`

---

### Full Feature Set — v1.0.1

#### 🏪 Core POS Operations
- Multi-store, multi-branch point-of-sale with real-time transaction processing
- Cart & checkout with VAT calculations, VAT-exempt support, and discount handling
- Cash and charge payment types with change calculation
- Item-level order actions: `completed`, `returned`, `refunded`, `damaged`, `unpaid`, `recovered`, `cancelled`
- Offline-first operation — all transactions queue locally and sync when online

#### 📦 Inventory & Stock Management
- **FIFO batch inventory** — stock deducted in order of receipt date
- Per-batch cost price tracking (`costPrice`) carried through to all tracking documents
- `runningBalanceTotalStock` captured at transaction time for point-in-time stock balances
- Inventory tracking events: `restock`, `completed` (sale deduction), `update`, `remove`
- `inventoryTracking` collection records every stock change with `eventType`, `batchId`, `skuId`, `storeId`, `companyId`
- Low-stock and out-of-stock signals computed in real time

#### 🧾 Sales & Order Tracking
- `ordersSellingTracking` collection records one document per product per order
- Each document stamped with: `invoiceNumber`, `version`, `costPrice`, `skuId`, `tags`, `tagLabels`, `cashierId`, `companyId`, `storeId`, `batchNumber`, `itemIndex`
- Status lifecycle: `pending` → `processing` → `completed` / `cancelled` / `returned` / `refunded` / `damaged` / `unpaid` / `recovered`
- Ledger events recorded once per order for financial accuracy
- Backfill utility to migrate historical orders into `ordersSellingTracking`

#### 📊 Sales Summary & Reporting
- Date-range sales summary with per-product, per-SKU, and per-store breakdowns
- Inventory ledger view combining `inventoryTracking` (restocks/deductions) and `ordersSellingTracking` (sales)
- CSV export for sales summary and billing history
- `orderAccountingLedger` used as authoritative source for items count in overview and summary

#### 🖨️ Receipt & Printing
- BIR-compliant thermal receipt with sequential invoice numbering
- USB and network thermal printer support (ESC/POS)
- Browser print fallback
- Receipt includes `invoiceNumber`, store TIN, VAT breakdown, payment method indicator

#### 🇵🇭 BIR Compliance
- Sales invoice template meeting Philippine BIR requirements
- Device/terminal registration workflow with admin approval
- Sequential invoice series with locked BIR fields after approval
- VAT and VAT-exempt line-item handling

#### 👥 Users, Roles & Security
- Roles: Creator, Store Manager, Cashier — each with granular Firestore security rule enforcement
- UID-based data isolation — users and tenants cannot access each other's data
- Offline authentication fallback using SHA-256 hashed credentials in IndexedDB
- All documents carry `createdBy`, `updatedBy`, `storeId`, `companyId` for full audit trail

#### 💳 Subscriptions & Billing
- Subscription tiers: Freemium, Standard, Premium, Enterprise
- Billing cycles: monthly, quarterly, yearly
- Payment methods: GCash, PayMaya, bank transfer, credit card
- Promo code system with validation
- Billing history with CSV export
- Enterprise plan request submission

#### 📱 Interfaces
- Desktop POS interface (`/pos`)
- Mobile cashier interface
- Customer-facing display
- Responsive design — desktop, tablet, smartphone

#### 🔄 Offline-First Architecture
- Firestore offline persistence enabled — all writes queue automatically when offline
- IndexedDB stores pending documents with `_offlineCreated` flags
- Offline reconciliation service syncs and deduplicates documents on reconnect
- IndexedDB corruption detection with graceful degradation (`isPermanentlyBroken` flag)

#### 🔍 Data Monitoring Fields (v1.0.1+)
All documents written to `orders` and `ordersSellingTracking` now include:

| Field | Value | Purpose |
|---|---|---|
| `version` | `'1.0.1'` | Filter documents by app version in Firestore console |
| `invoiceNumber` | e.g. `'INV-0001'` | Link tracking docs back to printed receipts |
| `skuId` | product SKU | Group inventory and sales by SKU across batches |
| `costPrice` | unit cost at write time | Compute gross profit per transaction |
| `tags` / `tagLabels` | product tags | Filter/segment sales by product category |

To monitor in Firestore console: filter `version == "1.0.1"` on either collection to see all documents created by this release.

---

## [1.0.0] — Initial Release

- Initial production deployment of Tovrika POS
- Core POS, inventory, subscriptions, BIR compliance, offline-first architecture
