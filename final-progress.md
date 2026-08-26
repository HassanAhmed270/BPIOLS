# Final Fixes Progress Log — BPIOLS

Append-only log for the phase defined in `final.md`. Do not rewrite prior
entries' substance — condense older stages for length only, never change
what they claim. Separate from `production-progress.md` (previous
phase's log) — the two must never be confused.

Stage numbering here follows `final.md` only, starting fresh at Stage 1,
independent of `production.md`'s Stage 1–8 and the original build's
`progress.md` numbering.

`final.md` was agreed 2026-08-24 after a full item-by-item discussion of
Hassan's handwritten notes/screenshots. **2026-08-25:** a second triage
document (Exchange process, Offline management overhaul, Dashboard
offline-billing visibility, plus one standalone question) was merged in
as Stages 12–14; Stages 1–11 untouched. All 16 original notebook items
are accounted for across 14 stages; "Deferred" is empty.

**Stages 1–6 complete (2026-08-25, condensed).** Stage 1: PKR currency
via `formatMoney()` (`Rs 1,234.50`, comma-grouped). Stage 2: sequential
`#000N` product IDs server-side (`nextProductId()`/`models/Counter.js`,
atomic, deleted IDs never reissued). Stage 3: `AuditLog.jsx` flattened
before/after diff table (`lib/flattenObject.js`) replacing raw JSON.
Stage 4: PDF export alongside CSV for all 5 report routes (`lib/pdf.js`'s
`sendTablePDF()`, `pdfkit`). Stage 5: toast/confirm infra (`sonner`,
`ConfirmDialog.jsx`'s `useConfirm()`). Stage 6: migrated all 64
`alert()`/`confirm()` call sites across 6 pages — zero remain in
`pages/`. Verified throughout: boot-tested, `npm test` 66/66, `npm run
build` clean, `oxlint` 0 errors. No live DB/browser in sandbox for any
stage — standing constraint, not a defect.

**Stage 7 complete (2026-08-25, condensed).** Add Product's create path
requires `cost`; positive initial stock creates a matching
`NoSupplier`-tagged `StockBatch` via shared `createBatch()`/
`generateUniquePurchaseId()` (extracted to `lib/costing.js`, shared
by `routes/suppliers.js`). Incidental one-line fix: `routes/suppliers.js`
was missing its `mongoose` import (pre-existing bug). Verified as above.

**Stage 8 complete (2026-08-25, condensed).** `Billing.jsx` only, no
backend changes. Selected product's cost renders next to selling price
in the item-entry form, gated `isAdmin`. Verified as above.

**Stage 9 complete (2026-08-25, split 9a/9b/9c per `final.md`'s own
suggestion).** 9a: Add Stock + Deduct Stock actions
(`POST /api/product/:productID/add-stock`/`.../deduct-stock`,
reason-coded), zero-stock auto-disable (`Product.disabled`,
`lib/costing.js`'s `disableIfDepleted()`, wired into checkout and
offline sync — flagged, necessary), `returned_to_supplier` credits a
supplier via FIFO-recovered cost instead of writing a `Loss`, every
other reason writes one `Loss`; `/supplier/purchase` now requires a
real supplier; removed the dead `POST /billing/update`. 9b: Loss
surfaced on Dashboard + 6th Reports export (`/api/export/losses`). 9c:
hard-delete now requires `{reason, note}`, 400s if `quantity > 0`.
Verified (9a–9c) as above each sub-stage. Known/open: FIFO math, credit
increments, Loss writes, auto-disable/re-enable, and the new UI are
code-reviewed only, no live Mongo/browser in sandbox.

**Stage 10 complete (2026-08-26, condensed; see correction below).**
UI polish, frontend-only. `Products.jsx`: Add/Update form colors match
Customers.jsx (blue=Add, yellow=Update, was green); restructured into a
2-column grid. `Billing.jsx`: on-screen cart preview replaced with
stacked receipt-lines; `printReceiptFor`/Special Bill untouched.
Verified: `npm run build` clean, `oxlint` 0 errors, boot-tested (`GET
/api/products`/`POST /billing/reserve` 401 with no token), `npm test`
66/66. Known/open: no live browser — layout code-reviewed only.
Customers/Suppliers needed no change (confirmed good earlier).

**2026-08-26 — Stage 10 correction (flagged by Hassan, confirmed).**
Stage 10's 2-column grid paired the Supplier dropdown with Selling
Price in **Update** mode — meaning Update Product could silently
change a product's `supplierID`. Fixed both sides: `Products.jsx`'s
Supplier dropdown removed from Update mode entirely (Add mode only,
paired with Stock); `routes/products.js`'s `POST /api/product` update
branch no longer touches `existingProduct.supplierID` at all.
`/product/undo`'s restore-from-snapshot path is unrelated, not touched.
Verified: `npm run build` clean, `oxlint` 0 errors, `node --check
routes/products.js` clean, `npm test` 66/66, boot-tested. Known/open:
code-reviewed only — recommend confirming a supplier value survives an
Update Product save unchanged, once merged.

**2026-08-26 — Stage 11 complete.** Bill preview: customer balance.
`Billing.jsx` only, no backend changes — `GET /api/customers` already
returns `totalBalanceDue`. A "Customer Balance" line renders at the
bottom of the on-screen bill preview (after Grand Total/Paid/Change)
whenever a real customer is selected, computed as `totalBalanceDue -
creditBalance` (positive = owes, negative = in credit), reflecting
pre-sale state. Verified: `npm run build` clean, `oxlint` 0 errors,
boot-tested (`GET /api/customers`/`POST /billing/orderDetails` 401 with
no token), `npm test` 66/66. Known/open: no live browser — owes/credit
sign handling code-reviewed only; recommend a manual check (balance-due
customer, in-credit customer, walk-in shows nothing) once merged.

**Stage 12 complete (2026-08-26, condensed).** Offline: continuous draft
persistence. `frontend/src/lib/offlineQueue.js`/`Billing.jsx` only, no
backend changes. New IndexedDB `drafts` store (`DB_VERSION` 1→2,
additive, `sales` store untouched), single fixed record —
`saveLocalDraft()`/`getLocalDraft()`/`clearLocalDraft()`. `withStore()`
generalized to take a store-name param. `Billing.jsx`: a new
non-debounced `useEffect` writes cart state on every change, separate
from the existing 7s-debounced *server*-side autosave (unchanged, still
fails silently offline). Local draft checked first on mount, same
resume/discard pattern; `resetBill()` clears both. Stays local until
"Generate Bill" per `final.md` — no auto-handoff to `PendingBill`.
Follow-up same day (Hassan-flagged): added `fake-indexeddb` +
`offlineQueue.test.js` (10 cases, `frontend`'s first test coverage);
surfaced and fixed a real bug — `withStore()` never closed its IndexedDB
connection, hanging `deleteDatabase()` between test runs. Verified both
passes: `npm run build` clean, `oxlint` 0 errors, boot-tested, `npm test`
66/66 (root) + 10/10 (`frontend`). Known/open: no live browser/IndexedDB
— store creation, restore-on-reload, clear-on-finalize code-reviewed
only; recommend a manual reload check (online + devtools-Offline).

**2026-08-26 — Stage 13 complete.** Offline: sync reliability &
dashboard visibility (depended on Stage 12). Sync commit/transaction/
replay logic unchanged — additive reliability/visibility only.
`offlineSync.js`: `online` event now waits ~60s (`RECONNECT_DELAY_MS`,
debounced) before flushing instead of firing instantly. New
`SyncOverlay.jsx` (mounted in `App.jsx`) driven by a small pub-sub
(`subscribeAutoSync`/`isAutoSyncing`) set only around *automatic*
flushes — Reports.jsx's manual "Sync Now" bypasses it, unchanged.
`flushOne()` now calls new `verifyOrderExists()` after a `synced`
result before trusting it: `ok` → synced as before; `not-found` (genuine
non-network error) → `conflict`; `unverified` (network/timeout, 3
attempts w/ backoff) → left `pending`, retries next cycle (commit is
idempotent). `models/Order.js` gains `offlineOrigin` (Boolean), set by
`syncOfflineSale()`. Folded in per `final.md`'s allowance:
`getDashboardSummary` gets `offlineOrders`; `Dashboard.jsx` gets one more
`StatCard` — flagged, makes that stat row 6 cards not 5, cosmetic only.
Incidental (Hassan-authorized): removed a leftover debug
`console.log('OFFLINE CUSTOMER DEBUG:', …)` in `lib/offlineSync.js`,
pre-existing, no functional effect. Verified: root `npm test` 66/66
before/after; boot-tested (`GET /api/products`, `GET /api/orders/:id`,
`GET /dashboard/load` 401 with no token); `frontend` `npm run build`
clean, `npm test` 10/10 unaffected; `oxlint` 0 errors on all seven
touched/added files. Known/open: no live browser — the 60s delay,
overlay timing, and verify/backoff path are code-reviewed only, not
exercised end-to-end; recommend a manual offline→online check once
merged. `offlineOrigin`/"Offline Sales" figure are schema-checked only,
no live Mongo. `unverified` intentionally leaves a sale `pending` rather
than `conflict` (by design) — flagging for awareness, not a defect.

**2026-08-26 — Stage 14 complete.** Exchange process improvements.

Confirmed in code before starting (`final.md`'s "Already working today"
claims): store-credit-only on edit (`recomputeOrderTotals` in
`routes/orders.js` unconditionally converts freed overpayment to
`Customer.creditBalance`, no cash-back path) and the "Revised" receipt
(`Orders.jsx`'s Print button already builds a full edit-history table)
— both already correct, untouched.

- **Add a new item during an exchange.** `models/Order.js`:
  `editHistory.action` enum gained `'add'`. `routes/orders.js`: new
  `applyLineAddition()` mirrors checkout's own line-creation
  (`getLatestSellingPrice`, atomic guarded stock decrement,
  `consumeFIFO` for cost basis, `disableIfDepleted`) instead of
  reinventing it; rejects a `productID` the order already has a line
  for (points to the existing reduction form instead — quantity changes
  on an existing line stay `applyLineReduction`'s job, so the two paths
  never fight over one line's fields). `POST /api/order/:orderID/edit`
  now branches on `action: 'add'` vs the original reduction behavior;
  existing calls (no `action` field) are unaffected. No discount
  support on an added line — out of scope, not requested.
- **Net balance** — no new logic, per `final.md`: `recomputeOrderTotals`
  already handles both directions (credit if the swap frees money,
  `balanceDue` increase if it doesn't).
- **Walk-in → customer conversion.** `routes/customers.js`: new
  `POST /customer/create`, upsert-style — creates if the name doesn't
  exist, returns as-is if it does (never overwrites existing details).
  `routes/orders.js`: new `POST /api/order/:orderID/convert-customer`
  reattaches a `WALKIN_CUSTOMER`-sentinel order to a real (already-
  created) customer — sets `order.customerName`, pushes the order's
  summary onto `Customer.orders` (same shape checkout's own push uses),
  400s if the order isn't actually a walk-in or the customer doesn't
  exist yet. Two separate calls, not one combined endpoint — frontend
  calls `createCustomer` then `convertWalkInOrder` in sequence.
- **Frontend** (`Orders.jsx`): "Convert to customer" panel (only shown
  for a walk-in order, same 72h edit window gate) above "Edit a line
  item"; new "Add a new item" panel below it — product dropdown
  excludes products already on the order, quantity, required reason.
  `allProducts` loaded once on mount (`api.getProducts({limit: 1000})`).
  `api.js` gained `convertWalkInOrder`/`createCustomer`.
- **Incidental (one-line, obviously correct):** removed an unused
  `isValidDiscount` import in `routes/orders.js`, pre-existing, not
  introduced by this stage — flagged, not silently dropped.

**Affected files:** `models/Order.js`, `routes/orders.js`,
`routes/customers.js`, `frontend/src/pages/Orders.jsx`,
`frontend/src/lib/api.js`.

**Verified:**
- `npm install` + `npm test` — 66/66 pass.
- Backend boot-tested with a real `.env`: `POST /api/order/:id/edit`
  (both `add` and reduction bodies), `POST /api/order/:id/convert-
  customer`, `POST /customer/create`, `GET /api/orders` all correctly
  401 with no token.
- `frontend`: `npm install` + `npm run build` (Vite) clean.
- `npx oxlint` on all five touched files — 0 warnings, 0 errors.
- Build/test artifacts (`node_modules` both places, `frontend/dist`,
  `.env`) removed after verification, before packaging.

**Known/open:**
- No live Mongo replica set or browser in this sandbox — FIFO
  consumption on an added line, the walk-in→customer credit landing,
  and the new panels' actual rendering/spacing are code-reviewed only.
  Recommend once merged: exchange an order to add a new item, confirm
  stock decrements and `editHistory` shows the `add` action with
  correct FIFO cost; convert a walk-in order to a new customer, confirm
  `customerName` updates and a subsequent reduction's freed credit
  lands on that customer, not lost.
- Adding a line never applies a discount — if a promotional/matching
  discount is expected on a swapped-in item, that's not covered here
  and would need a follow-up decision, not assumed.
