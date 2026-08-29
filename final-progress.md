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

**2026-08-26 — Stage 14 complete (condensed).** Exchange process
improvements. Confirmed pre-existing and untouched: store-credit-only
on edit, the "Revised" receipt's full edit-history table. New:
`applyLineAddition()` (`routes/orders.js`) adds a new line during an
exchange via checkout's own FIFO/price logic, `editHistory.action`
gains `'add'`; `POST /customer/create` (upsert-style) +
`POST /api/order/:orderID/convert-customer` reattach a walk-in order to
a real customer; `Orders.jsx` gained "Convert to customer" and "Add a
new item" panels. Incidental: removed an unused `isValidDiscount`
import in `routes/orders.js`. Verified: `npm test` 66/66, boot-tested,
`frontend` build clean, `oxlint` 0 errors on all five touched files.
Known/open: no live Mongo/browser — FIFO on an added line and the
walk-in→customer credit landing are code-reviewed only; added lines
never apply a discount (out of scope, not requested).

**2026-08-29 — Stage 16 complete.** Raised directly by Hassan (not
pre-staged in `final.md` beforehand — added retroactively per the
project's own "newly raised items get promoted to a numbered stage"
convention), frontend-only, three parts. **16a:** `Suppliers.jsx`'s
purchase-history `Balance` column (color+sign plus a small "credit
used" note folded in underneath) split into a `Status` column (`Due Rs
X` / `Credit +Rs X` / `Settled`) and a separate `Credit Used` column —
same `balanceDue`/`creditGenerated`/`creditApplied` fields, relabeled/
split only, no calculation touched. **16b:** `Orders.jsx`'s "Refund
items" (individual item checkboxes + editable quantities, duplicating
the edit form above it) replaced with a single **Refund Full Order
(Cash Back)** action — full order, all lines at full quantity,
`settlement: 'cash'` (unchanged, already hardcoded). "Edit a line item"
→ **Exchange — reduce a line item (Store Credit)**; "Add a new item" →
**Exchange — add a replacement item (Store Credit)** — labels only,
both already settle credit-only (backend already ignores any
`settlement` sent on `/api/order/:orderID/edit`). Printed "Revised
Receipt" edit-history rows previously always said `Store Credit: Rs X`
regardless of actual settlement — now conditionally labels `Exchange —
Store Credit: Rs X` / `Cash Back: Rs X` / `—`, matching the on-screen
Edit History. **16c:** `Billing.jsx`'s "🧾 Special Bill" button, preview
modal, `showSpecialPreview` state, and `printSpecialReceiptFor` removed
entirely; `handleGenerateBill` no longer takes a `special` param.
`customerDirectory` kept (still backs Customer Balance). Incidental:
removed a leftover debug `console.log('REFUND RESPONSE:', data)` in
`Orders.jsx`'s refund handler. **Affected files:** `Suppliers.jsx`,
`Orders.jsx`, `Billing.jsx` — no backend routes touched, confirmed
first against `routes/suppliers.js`/`routes/orders.js` that no
calculation needed to change. Verified: `frontend` build clean, `oxlint`
0 errors on all three files, boot-tested (`GET /api/orders`, `GET
/api/products`, `POST /supplier/purchase`, `POST /api/order/:id/refund`,
`POST /api/order/:id/edit` all 401 with no token), root `npm test`
66/66, `frontend npm test` 10/10 (both unaffected, no backend/offline
files touched). Known/open: no live browser — the new Supplier columns,
full-refund-only flow, and Special Bill's removal are code-reviewed
only; recommend a manual check of each once merged.
