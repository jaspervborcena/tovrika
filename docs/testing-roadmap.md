# Tovrika Testing Roadmap

## Purpose

Use this roadmap to build confidence in Tovrika before expanding pilots or selling to more merchants. It covers the end-to-end business workflows, not only whether individual screens load. This is a plan; unchecked items have not yet been validated by this document.

Track implementation and progress in the root [TODO.md](../TODO.md). Record individual test runs using the result template at the end of this document.

## How to use this roadmap

1. Confirm the expected behavior with the product owner and current business rules before writing assertions. In particular, confirm tax, refund, stock, permissions, and subscription rules.
2. Review the current specs and run the existing test command to establish a baseline.
3. Start with automated tests for calculations and critical services, then add integration and end-to-end coverage for complete workflows.
4. Run manual hardware, offline, and real-store scenarios where browser automation cannot reproduce the environment.
5. Record the build/commit, environment, test data, results, failures, and follow-up issues. Do not mark a group complete until its acceptance criteria pass.

## Test layers

| Layer | Purpose | Examples |
|---|---|---|
| Unit | Verify deterministic business rules in isolation | Cart totals, VAT, discounts, FIFO allocation, subscription limits |
| Service/integration | Verify interactions between services, persistence, and Firebase boundaries | Order processing, SQLite queue, Firestore rules, reconciliation |
| UI/end-to-end | Verify a user can finish a business workflow | Sign in, checkout, return/refund, reports, subscription management |
| Manual/device | Verify hardware and conditions not reliably simulated in unit tests | Offline network interruption, receipt printer, barcode scanner, Android |
| Pilot/operational | Verify real store operations and recoverability | Multi-day store pilot, backup/restore, support and rollback procedures |

Use isolated test projects or emulators for tests that write data. Never run destructive tests against production merchant data.

## Priority and completion criteria

- **P0 — Money, stock, or access:** checkout/payment records, totals/tax, refunds/returns, inventory, offline transaction durability, tenant isolation, and permissions.
- **P1 — Daily operations:** orders, customers, reporting, reconciliation, subscriptions, receipts, store/device setup, and offline recovery.
- **P2 — Usability and maintenance:** responsive layouts, translations, performance, and less frequently used admin functions.

A feature group is complete only when:

- Its expected rules have been agreed and the test cases have explicit pass/fail outcomes.
- Critical happy paths and relevant invalid, boundary, retry, and failure scenarios pass.
- No duplicate or lost business transaction is created during retry/reconnect scenarios.
- Automated tests pass in the project test runner and the production build succeeds.
- Any manual/device tests include the device/browser, environment, tester, date, and evidence or issue link.
- Known failures are recorded as defects; they are not silently treated as passed.

## Feature coverage checklist

### 1. Authentication, users, and access control — P0

- [ ] Registration, sign-in, sign-out, password reset, session expiry, and invalid credentials.
- [ ] Online/offline authentication behavior, including stale cache, unavailable network, and credential changes.
- [ ] Role and permission checks for cashier, manager, and administrator actions.
- [ ] Route guards and direct URL access enforce the same permissions as the UI.
- [ ] User/company/store data remains isolated across accounts and tenants.
- [ ] Firestore rules reject unauthenticated, unauthorized, and cross-tenant reads/writes.
- [ ] User activation/deactivation and permission changes take effect as expected.

### 2. Company, stores, branches, and setup — P1

- [ ] Create, edit, select, and deactivate company/store/branch records.
- [ ] Store selection and active-store filters remain consistent across POS, inventory, and reports.
- [ ] Empty, duplicate, invalid, and incomplete setup states are clear and recoverable.
- [ ] Store-specific settings (timezone, tax/BIR details, invoice series, and printer settings) are applied correctly.
- [ ] Multi-store users can access only assigned stores and see correct store-scoped data.

### 3. Product catalog, pricing, and imports — P1

- [ ] Product create/read/update/archive, SKU/barcode search, categories, tags, variants, and images as supported.
- [ ] Tracked and untracked products behave correctly; zero-stock and inactive products are handled safely.
- [ ] Price, cost, unit, quantity, and invalid input boundaries are validated.
- [ ] Product import/export handles valid files, malformed rows, duplicates, and partial failures without corrupting existing data.
- [ ] Barcode scanning finds the correct product and handles unknown or duplicate codes.

### 4. POS cart, checkout, payments, and invoices — P0

- [ ] Add/remove items, change quantity, apply item/order discounts, and calculate subtotal, VAT, exemptions, and total.
- [ ] Test decimal precision, rounding, large quantities, zero/negative inputs, and mixed tax status.
- [ ] Cash, charge/credit, split payment, change, underpayment, overpayment, and invalid payment scenarios follow confirmed rules.
- [ ] Prevent accidental duplicate submission; recover clearly from timeout, network loss, and retry.
- [ ] A successful payment/order creates exactly one order and expected tracking, ledger, and inventory effects.
- [ ] A failed payment/order does not appear successful or leave inconsistent partial records.
- [ ] Invoice number generation is unique and correct across stores, date/time boundaries, and retries.
- [ ] Receipt contents match persisted invoice/order values, including tax, discounts, customer, and store details.

### 5. Inventory, FIFO, and reconciliation — P0

- [ ] Online completed sales deduct tracked quantities from the oldest eligible batches.
- [ ] Multi-batch allocation, exact batch depletion, insufficient stock, no batches, and concurrent sales are handled correctly.
- [ ] Untracked products do not receive unintended stock deductions.
- [ ] Product totals, batch quantities, `inventoryTracking`, and order reconciliation flags agree after success.
- [ ] Each sale deduction record in `inventoryTracking` includes the originating order-line `itemCode` when available, including deferred/reprocessed deductions.
- [ ] Transaction failure leaves no partial batch/product/tracking writes.
- [ ] Offline sales retain durable pending work and do not falsely report batch-level completion.
- [ ] Reconnect and reconciliation process pending work once, avoid duplicate deductions, and report failures for repair.
- [ ] Store/date filters and summary counts match the underlying scoped records.
- [ ] Manual stock adjustments, receiving, damaged stock, and stocktake workflows preserve audit history.
- [ ] Inventory report shows individual transaction rows, reports the matching transaction count, and paginates exactly 10 rows per page for both API and Firestore results.
- [ ] Inventory summary cards use the full selected-period result set across page changes; SKU count is distinct and quantity, gross, profit, and remaining-stock totals match the displayed transactions.
- [ ] Inventory report UI handles empty results, API failure with Firestore fallback, and page navigation after changing store or period without showing stale rows or totals.

### 6. Returns, refunds, damage, cancellation, and order management — P0

- [ ] Return/refund a full order and a single line; verify quantities, amounts, tax, invoice references, and summaries.
- [ ] Repeated or concurrent adjustment requests cannot refund/return more than the eligible original amount or quantity.
- [ ] Confirm whether return, refund, and damage each affect inventory; verify the intended stock movement exactly once.
- [ ] Cancel unpaid, paid, and partially fulfilled orders according to business rules.
- [ ] Invalid, duplicate, out-of-range, and previously adjusted lines are rejected with a useful explanation.
- [ ] Audit trail identifies the original order, selected line, user, reason, amount/quantity, and timestamp.
- [ ] Dashboard and financial reports reflect adjustments consistently.

### 7. Orders, customers, and sales reports — P1

- [ ] Search, filter, sort, paginate, and open orders; confirm correct store/date/status scoping.
- [ ] Customer create/edit/search and transaction history are consistent with completed orders.
- [ ] Sales summaries reconcile to source orders for daily, weekly, monthly, custom, and timezone-boundary periods.
- [ ] Returns, refunds, discounts, VAT-exempt sales, and cancellations are counted according to agreed formulas.
- [ ] Empty periods, large datasets, API errors, and stale/loading states are handled visibly.
- [ ] Exported reports match on-screen totals and respect the selected store and date range.
- [ ] Sales Summary integration test confirms the summary count and paginated order-details endpoint return matching data for the same store and date range, including the default Today filter.
- [ ] Sales Summary normalizes supported API response wrappers and surfaces malformed responses or endpoint failures instead of silently displaying an empty order list.
- [ ] Sales Summary UI opens order details for an API-returned order and displays its line items; verify the details lookup works by order ID and invoice number where supported.

### 8. Dashboard and analytics — P1

- [ ] KPI totals and charts match a known dataset and the documented calculation rules.
- [ ] Date-period presets, custom ranges, timezone boundaries, and active-store selection are consistent.
- [ ] Duplicate/inactive stores do not inflate totals or appear unexpectedly.
- [ ] Loading, no-data, partial-data, and backend error states are clear.

### 9. Offline storage, synchronization, and recovery — P0

- [ ] Create sales and supported changes offline, reload/close the app, and verify queued data survives.
- [ ] Simulate storage quota/serialization errors, interrupted writes, corrupt cache, and schema migration.
- [ ] Verify SQLite initialization, migrations, pending-queue persistence, and restoration behavior.
- [ ] Reconnect after multiple offline actions; ensure ordered, idempotent sync with no missing or duplicate records.
- [ ] Handle conflicting server updates, expired auth, sync rejection, retries, and partial sync visibly.
- [ ] Confirm local data is scoped to the correct user/company and is cleared or protected on sign-out as designed.

### 10. Subscriptions, billing, and limits — P1

- [ ] Plan display, selection, billing periods, promos, enterprise requests, and billing history.
- [ ] Validate payment status transitions, failed/duplicate payments, renewals, expiration, and cancellation.
- [ ] Enforce store/device/feature limits in both UI and server/security boundaries.
- [ ] Confirm subscription changes and billing records are scoped to the correct company/store.
- [ ] Existing [subscription testing guide](./subscription-testing-guide.md) and [feature-specific checklist](./TESTING-CHECKLIST.md) remain useful references; reconcile outdated examples before relying on them.

### 11. Receipts, printing, scanning, and BIR — P1

- [ ] Preview and print correct receipt/invoice data for supported formats and printer types.
- [ ] Test printer unavailable, disconnected, permission denied, paper/communication error, and retry.
- [ ] Barcode/QR scanning permissions, successful scans, invalid codes, and unsupported devices.
- [ ] Store BIR/ATP/OCN fields and invoice serials render correctly; missing configuration is surfaced.
- [ ] Validate BIR-required totals/fields against approved business rules and representative invoices.

### 12. Notifications and integrations — P2

- [ ] Notification creation, display, read/unread state, and navigation target.
- [ ] External API success, authentication failure, timeout, malformed response, and retry behavior.
- [ ] API credentials and sensitive data are not exposed in logs or user-visible errors.

### 13. Responsive UX, accessibility, and localization — P2

- [ ] Core checkout and admin workflows on supported desktop, tablet, and mobile sizes.
- [ ] Keyboard navigation, focus behavior, labels, contrast, and readable validation errors.
- [ ] Translation coverage, long text, currency formatting, and date/time formatting.
- [ ] No blocking layout, scrolling, or interaction regressions on supported browsers/devices.

### 14. Deployment, monitoring, and support readiness — P1

- [ ] Development and production builds use the intended environment/configuration.
- [ ] Deployment checklist, rollback procedure, and post-deployment smoke tests are documented and rehearsed.
- [ ] Errors and sync failures are observable with enough context to support a merchant without exposing sensitive data.
- [ ] Backup/restore and data-recovery procedures are documented and tested.
- [ ] Pilot-store scenarios cover opening/closing sales, offline cash transactions, adjustments, stock reconciliation, multiple stores, and permissions.
- [ ] Support escalation, issue capture, merchant onboarding, and staff training procedures are documented.

## Baseline and implementation order

- [x] Run the existing test suite and production build; record baseline failures without masking them.
- [x] Review existing specs and map them to the feature coverage above; note missing or brittle tests.
- [x] Add P0 unit tests for checkout calculations/payment validation and pure FIFO allocation planning.
- [ ] Add P0 tests for invoice/order transaction outcomes, adjustment rules, and Firestore-backed stock writes.
- [ ] Add P0 service/integration tests for checkout persistence, offline queue/reconnect, idempotency, and tenant isolation.
- [ ] Add end-to-end smoke tests for sign-in, checkout, return/refund, reconciliation, and reporting.
- [ ] Add UI/integration regression coverage for Inventory transaction pagination/totals and Sales Summary summary-to-details consistency.
- [ ] Verify Sales Summary and Inventory report behavior against representative authenticated API responses or an isolated backend/emulator; unit test doubles alone do not verify deployed endpoint contracts.
- [ ] Add P1/P2 coverage and manual device/pilot validation.
- [ ] Establish a repeatable test command and release gate; ensure failures block release rather than being ignored.

Do not treat a feature as tested solely because the app builds or its component renders.

### Existing spec map

At initial mapping, the suite contained **36 cases across 9 spec files**. The current suite has **61 cases across 15 spec files**, including checkout, FIFO utility, inventory-sale-lock, transaction, offline-sync, offline-query guard, Inventory Summary API, report totals/pagination, BigQuery response handling, and no-FIFO sale snapshot coverage. Passing tests do not imply that the related production workflows are fully covered.

| Existing spec | Current coverage | Roadmap areas | Assessment |
|---|---|---|---|
| [sanity.spec.ts](../src/app/sanity.spec.ts) | One assertion that the test runner can execute a test. | None | Infrastructure smoke check only; no product behavior coverage. |
| [product.service.spec.ts](../src/app/services/product.service.spec.ts) | Product VAT/discount normalization and cart-line storage normalization. | Product catalog; POS calculations | Useful pure-function coverage, but does not test full cart totals, rounding, discounts, tax calculations, or product CRUD. |
| [pos-checkout.utils.spec.ts](../src/app/services/pos-checkout.utils.spec.ts) | Cart totals across taxable/exempt lines, product/order discounts, cache lookup fallback, and exact/insufficient/invalid payment amounts. | POS calculations and payment validation | New P0 unit coverage. Does not exercise invoice transactions, UI payment workflow, or persisted payment records. |
| [inventory-fifo.utils.spec.ts](../src/app/services/inventory-fifo.utils.spec.ts) | Oldest-first multi-batch allocation, exact per-batch costs/COGS, pending batch reservations, planned deductions, depleted status, and insufficient batch quantity. | Inventory FIFO | New P0 unit coverage of allocation planning. Does not exercise Firestore transaction atomicity, concurrent checkout, or reconciliation writes. |
| [inventory-sale-lock.interface.spec.ts](../src/app/interfaces/inventory-sale-lock.interface.spec.ts) | Stable lock IDs for retries and distinct IDs for repeated products across order lines/orders. | Inventory FIFO; idempotency | Pure identity-helper coverage only; does not test transaction contention or persistence. |
| [inventory.service.spec.ts](../src/app/services/inventory.service.spec.ts) | Inventory Summary API request/auth/date formatting, API row mapping, 10-row API/Firestore pagination, full-result counts, distinct-SKU/report totals, short-period fallback, and direct Firestore reads for other periods. | Inventory reports; API fallback | Uses API and Firestore test doubles; does not validate the deployed endpoint, report UI filter transitions, or production Firestore indexes. |
| [orders-selling-tracking.inventory.spec.ts](../src/app/services/orders-selling-tracking.inventory.spec.ts) | Transaction-level write planning for FIFO splits, product stock deductions for tracked and untracked sales, sale-line locks, movement audits, and rollback when FIFO batches cannot fulfill the line. | Inventory FIFO; audit; atomicity | Runs the real service transaction callback against a transaction test double; does not use Firestore emulator or validate production transaction contention. |
| [offline-document.inventory-sync.spec.ts](../src/app/core/services/offline-document.inventory-sync.spec.ts) | Queued sale-line sync after offline order-ID remapping and invocation of the inventory processor for a completed tracked line. | Offline storage/sync; Inventory FIFO | Uses in-memory SQLite/Firestore test doubles; does not test browser restart durability or Firestore connectivity. |
| [bigquery.service.spec.ts](../src/app/services/bigquery.service.spec.ts) | Sales API date normalization, request parameters/auth header, summary/order scope consistency, nested order response parsing, malformed payload handling, order-detail parsing, and summary/status parsing. | Orders/reports; dashboard | Strong reporting-focused service coverage using mocked endpoints. Does not verify deployed API responses, report UI behavior, aggregation against source records, or reconciliation API. |
| [sales-summary-period.spec.ts](../src/app/pages/dashboard/sales/sales-summary/sales-summary-period.spec.ts) | Period defaults, today/week/custom date range resolution, and API date parameters. | Orders/reports; dashboard | Date helper coverage only; limited boundary coverage for yesterday, previous periods, timezone transitions, malformed ranges, and UI filter synchronization. |
| [sqlite-storage.service.spec.ts](../src/app/core/services/sqlite-storage.service.spec.ts) | Settings/user persistence, active-user changes, notification/product-batch cache, offline order document queue restore, and legacy queue migration. | Offline storage/sync; users; inventory cache | Good persistence unit coverage. Does not test quota/write interruption/corruption, complete order replay, sync ordering/idempotency, conflict handling, or user-data cleanup/isolation. |
| [store-display.util.spec.ts](../src/app/store-display.util.spec.ts) | Store label formatting and dropdown deduplication. | Company/stores; dashboard filters | Small utility coverage; no store authorization, selection synchronization, or multi-store data isolation. |
| [company-profile.component.spec.ts](../src/app/pages/dashboard/company-profile/company-profile.component.spec.ts) | Company QR payload validity and generation decision. | Company setup | Pure helper only; no company profile workflows or permissions. |
| [qr-scan.utils.spec.ts](../src/app/pages/dashboard/pos/qr-scan.utils.spec.ts) | Customer identifier extraction from URL/plain/blank QR values. | Product/POS scanning; customers | Parsing helper only; no scanner/device permission or customer lookup flow. |
| [company-qr.component.spec.ts](../src/app/pages/qr/company-qr.component.spec.ts) | APK storage path and download URL construction. | Notifications/integrations; QR | URL helper coverage only; no download/API failure or QR UI flow. |

#### Highest-priority untested areas

1. **Checkout and payment consistency (P0):** pure cart calculations and payment amount validation are now covered, but no tests exercise the POS checkout flow, invoice transaction, exactly-once order creation, or failure/retry behavior.
2. **Inventory FIFO and reconciliation (P0):** allocation planning, sale-line lock identity, transaction write shape, insufficient stock, lock retries, offline ID remapping, and offline query bypass have unit coverage. Firestore emulator transaction contention, full UI timeout/manual retry, and idempotent reconciliation still need tests.
3. **Returns, refunds, damage, and cancellation (P0):** no specs exercise adjustment rules, repeated/over-limit adjustments, stock movements, audit records, or financial report consistency.
4. **Authentication, permissions, and tenant isolation (P0):** the SQLite user test checks local active-user state, but no tests cover authentication workflows, role enforcement, route guards, or Firestore tenant boundaries.
5. **Offline reliability (P0):** queued-document persistence and legacy migration have basic coverage, but no tests cover interrupted writes, quota/corruption, reconnect retries, ordering, duplicate prevention, or partial sync recovery.
6. **End-to-end and operational validation (P1):** no automated end-to-end specs are present for checkout, reporting, subscription/billing, receipt printing, hardware, or pilot-store operations.

#### Brittle or incomplete coverage to improve

- Several tests set private dependencies directly or use `as any`; prefer public behavior and typed test doubles when expanding those suites.
- The reporting specs assert mocked API responses and request strings; they do not validate API failure, malformed payload, timeout, or agreement with known source records.
- The latest full-suite run reported completion but Karma did not exit cleanly; make clean process exit part of runner reliability follow-up.

**Next implementation slice:** add tests for invoice/order transaction outcomes and Firestore-backed inventory writes, then adjustment behavior and offline reconciliation. Confirm business rules (especially payment acceptance, tax rounding, and stock behavior) before encoding expected results.

### Inventory and Sales Summary reporting tests — 2026-10-27

- Inventory service tests: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/services/inventory.service.spec.ts` — **6/6 passing**.
- BigQuery/Sales Summary service tests: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/services/bigquery.service.spec.ts` — **11/11 passing**.
- Full suite: `npx ng test --watch=false --browsers=ChromeHeadless --progress=false` — **61/61 passing**; process exited successfully.
- Production build: `npm run build:prod` — succeeded.
- `git diff --check` — passed.
- Added coverage for Inventory API and Firestore 10-row pagination, complete result counts, distinct SKU and full-result totals, plus Sales Summary totals/order page store/date consistency and supported/malformed API payloads.
- The endpoints are mocked in these tests. Live backend contract, Sales Summary UI rendering/line-item details, and filter-transition smoke tests remain unverified.

### Baseline run — 2026-10-26

- Automated tests: `npm test -- --watch=false --browsers=ChromeHeadless` reported **36/36 passing** in Chrome 155 on Windows.
- Runner behavior: Karma did not exit after printing `TOTAL: 36 SUCCESS`; the lingering process was stopped after the completed summary. A clean process exit still needs verification.
- Production build: `npm run build:prod` completed successfully.
- Test failures: none reported in the 36 completed specs.
- Coverage: not measured. Passing the existing suite does not imply that the P0/P1/P2 business workflows are covered.

### Checkout and FIFO unit tests — 2026-10-26

- Focused run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/services/pos-checkout.utils.spec.ts --include=src/app/services/inventory-fifo.utils.spec.ts` — **7/7 passing**.
- Full suite: `npx ng test --watch=false --browsers=ChromeHeadless` — **43/43 passing**; process exited successfully.
- Production build: `npm run build:prod` — succeeded.
- Coverage remains unmeasured. These tests verify deterministic calculations and FIFO allocation planning, not full Firestore transactions or checkout integration.

### FIFO batch-cost example — 2026-10-26

- Focused FIFO run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/services/inventory-fifo.utils.spec.ts` — **4/4 passing**.
- Full suite: `npx ng test --watch=false --browsers=ChromeHeadless` — **44/44 passing**; process exited successfully.
- Production build: `npm run build:prod` — succeeded.
- The FIFO example verifies 2 units at $30 plus 1 unit at $25 produce separate allocations and $85 total COGS. Firestore transaction behavior and offline durability remain untested.

### Sale-line inventory queue implementation — 2026-10-26

- Full suite: `npm test -- --watch=false --browsers=ChromeHeadless` — **46/46 passing** in Chrome 155 on Windows. Karma reported success but remained active; the process was stopped after the completed result.
- Production build: `npm run build:prod` — succeeded.
- `git diff --check` — passed.
- At this implementation checkpoint, tests covered FIFO allocation planning and deterministic lock identity; the follow-up transaction and offline-sync tests are recorded below.

### Inventory transaction and offline reconnect tests — 2026-10-26

- Focused run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/services/orders-selling-tracking.inventory.spec.ts --include=src/app/core/services/offline-document.inventory-sync.spec.ts` — **5/5 passing**.
- Full suite: `npm test -- --watch=false --browsers=ChromeHeadless` — **50/50 passing**. Chrome briefly disconnected during the run and reconnected; Karma reported the completed result but stayed active and was stopped afterward.
- Production build: `npm run build:prod` — succeeded.
- `git diff --check` — passed.
- Added transaction callback tests that assert FIFO split allocations, audit rows, lock creation, and no writes on insufficient batch stock.
- Added offline sync coverage for order-ID remapping, stable sale-line document ID generation, and triggering tracked-line inventory processing.
- These tests use test doubles, not the Firestore emulator; real transaction contention and security rules remain unverified.

### Checkout hang safeguards — 2026-10-26

- Online checkout now waits at most 15 seconds for FIFO; an overrun keeps payment/order final and offers an inventory-only manual retry.
- Offline checkout persists completed sale lines from the local product cache without querying inventory or running FIFO; reconnect sync starts inventory processing.
- Offline tracking completion now updates only SQLite-queued open lines and skips Firestore queries.
- Order-level `inventoryStatus` is set to `applied` only after all sale lines finish without errors.
- Added a unit test for the offline tracking-query bypass. The full suite/build must be rerun after these safeguards; the checkout timeout and dialog remain candidates for UI integration testing.

### Stock deductions for non-stock-tracked products — 2026-10-26

- Focused inventory transaction suite — **5/5 passing**.
- Production build: `npm run build` — succeeded.
- `git diff --check` — passed.
- Verified completed untracked sales decrement product `totalStock`, write an idempotent `eventType: 'sale'` audit using product pricing, and skip FIFO batch queries/updates. Inventory history suppresses duplicate sale-line rows already represented by inventory audit entries.

## Test run record

Copy this block for each meaningful test run:

```text
Date/time:
Tester:
Commit/branch:
Environment (emulator/staging/pilot; never production unless explicitly approved):
Browser/device:
Feature group and case IDs:
Test command or manual steps:
Result (PASS / FAIL / BLOCKED):
Evidence or issue link:
Known risks / follow-up:
```
