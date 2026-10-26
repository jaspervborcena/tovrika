# Project TODO

This file tracks recently completed work and the next development tasks. Update the checkboxes as items are verified.

## Done

- [x] Persist completed sale lines in `ordersSellingTracking` before attempting inventory processing.
- [x] Deduct stock-tracked sales from oldest eligible batches (FIFO); write one `inventoryTracking` allocation per batch.
- [x] Use deterministic per-sale-line `inventorySaleLocks` as the idempotency marker, written atomically with batch and audit updates.
- [x] Save offline sale lines in the SQLite document queue, sync them when online, and retry inventory processing without a separate request collection or sale-line inventory status.
- [x] Skip inventory deductions and inventory locks for products with `isStockTracked` set to `false`.
- [x] Reconcile completed tracked sale lines that lack their processing lock.
- [x] Load authenticated reconciliation summaries for the selected store and date range.
- [x] Align dashboard and sales summary date periods and active-store filters.
- [x] Remove the separate mobile POS route and components; keep the responsive POS at `/pos`.

## To do

### Next up

- [ ] Validate return and refund adjustments across invoices and summary reports.
- [ ] Harden damage and cancellation handling so inventory, tracking, and accounting stay consistent through the full adjustment lifecycle.

### Reliability and coverage

- [ ] Harden SQLite offline persistence; review durability and storage limits instead of relying on a serialized database blob in `localStorage`.
- [x] Create a cross-feature testing roadmap before implementing tests: [Testing roadmap](docs/testing-roadmap.md).
- [x] Run and record the current automated test/build baseline: 36 existing specs passed and the production build succeeded.
- [ ] Fix or explain why the Karma process does not exit after reporting all tests passed.
- [x] Map the 36 existing specs to the roadmap and identify missing or brittle coverage: [Existing spec map](docs/testing-roadmap.md#existing-spec-map).
- [x] Add unit tests for checkout totals/payment validation and FIFO allocation planning.
- [x] Test FIFO transaction callback writes, repeated-processing locks, insufficient stock, offline reconnect ID remapping, and untracked sale price snapshots without stock movement.
- [x] Bound online checkout inventory waits and add an inventory-only retry notice; keep offline checkout to local sale-line queueing without inventory queries.
- [ ] Test checkout/invoice transaction outcomes and emulator-backed Firestore writes/concurrency.
- [ ] Add P0 tests for adjustments, offline durability/sync, and tenant isolation.
- [ ] Add end-to-end coverage for the critical merchant workflows, then cover remaining P1/P2 features and manual hardware/pilot scenarios.
- [ ] Establish a repeatable test/release gate so regressions block release.

### Admin and maintenance

- [ ] Finish placeholder work in the branches, inventory, and products admin screens.
- [ ] Investigate the `jsbarcode` CommonJS build warning and address it if practical.
- [ ] Reduce noisy debug logging where practical without hiding actionable errors.

## Notes

- The “To do” items are carried forward from the project’s immediate next-sprint list in [README.md](./README.md).
- The completed items above summarize the dashboard and inventory updates documented in the [changelog](./CHANGELOG.md).
