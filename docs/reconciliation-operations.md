# Reconciliation Operations Runbook

## Overview
This document explains how the new reconciliation flow works and how to operate it in development and production.

- POS (recon mode) logs per-line sales to the `ordersSellingTracking` collection and optimistically adjusts `products.totalStock`.
- Cloud Functions (nightly + on-demand) read pending tracking docs, perform FIFO deductions across `productInventory`, write `reconciliationLog`, update tracking status, and recompute product totals from source-of-truth batches.

## Enable recon mode
- Dev default: `src/environments/environment.ts` → `inventory.reconciliationMode = 'recon'`
- Prod default: `src/environments/environment.prod.ts` → `inventory.reconciliationMode = 'legacy'` (flip to `'recon'` per rollout plan)

## Deploy/Run Cloud Functions
1) Install deps inside `functions/`:
   - `npm install firebase-functions firebase-admin node-fetch`
2) Local emulator (optional):
   - `firebase emulators:start --only functions,firestore`
3) Deploy to Cloud (optional):
   - `firebase deploy --only functions`

## On-demand reconciliation
Use the callable function `reconcileOnDemand`.

- From Angular (admin tool), call via `ReconciliationService.reconcileOnDemand({ companyId, storeId?, limit? })`.
- Response: `{ status: 'ok', processed: <count> }`.

## Scheduled reconciliation
- `reconcileDaily` runs at 02:00 Asia/Manila.
- Processes pending tracking docs up to a sensible batch size (configurable via `limit` when using on-demand).

## Data model
- ordersSellingTracking (client-created)
  - Required: `uid` (cashierId), `companyId`, `storeId`, `productId`, `quantity`, `status='pending'`
- productInventory (batches)
  - Fields: `productId`, `quantity`, `status`, `receivedAt`, `unitPrice`
- reconciliationLog (server-only writes)
  - Fields: `trackingId`, `productId`, `quantityProcessed`, `batchesUsed[]`, `action`, `message`, `createdAt`

## Firestore security
- `ordersSellingTracking`:
  - Clients can create only with `uid == request.auth.uid` and `status == 'pending'`.
  - Clients cannot set `status` to `reconciled`/`error`.
- `reconciliationLog`:
  - Read-only to clients. Admin SDK bypasses rules for writing.

## Rollout plan
1) Staging: Enable recon mode; run on-demand reconciliation on small datasets.
2) Limited prod: Flip `reconciliationMode` to `'recon'` for pilot stores/companies.
3) Full prod: Flip across all stores; keep nightly job active.
4) Guardrails: Keep legacy FIFO path behind the feature flag as fallback until confidence is high.

## Migration/backfill
- If historical sales should be reconciled, backfill `ordersSellingTracking` from recent `orders`:
  - Create tracking docs with `status='pending'` for a bounded window (e.g., last 7–30 days).
  - Run `reconcileOnDemand` with a `companyId` scope.
- Idempotency: If a tracking doc is already `reconciled`/`error`, it will be skipped by the processor.

## Monitoring & troubleshooting
- Validate counts: Compare `products.totalStock` with the sum of active `productInventory` batches after reconciliation.
- Investigate `reconciliationLog` entries with `action='partial'` or tracking docs with `status='error'`.
- Common causes:
  - No active inventory batches (restock missing).
  - Batch data missing `receivedAt` or mis-typed quantities.

## Next improvements
- Admin dashboard for reconciliation: pending counts, trigger callable, recent logs.
- Alerts for high error/partial rates per company/store.
- Batch-size configuration and backoff behavior in scheduled job.
