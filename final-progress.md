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

**2026-08-26 — Stage 12 complete.** Offline: continuous draft
persistence. `frontend/src/lib/offlineQueue.js` and
`frontend/src/pages/Billing.jsx` only, no backend changes. New
IndexedDB store `drafts` (`pos-offline-queue` DB, `DB_VERSION` 1→2,
upgrade path additive, existing `sales` store untouched), single fixed
record (`id: 'current'`, single-shop/single-cart app) —
`saveLocalDraft()`/`getLocalDraft()`/`clearLocalDraft()`. `withStore()`
generalized to take a store-name param, both stores share the same
open/transaction plumbing. `Billing.jsx`: a new, non-debounced
`useEffect` writes cart state to `saveLocalDraft()` on every item/qty/
discount/customer/paid change — separate from the existing 7s-debounced
*server*-side autosave (unchanged, still silently fails offline). On
mount, a local draft is checked first (same resume/discard
`useConfirm()` pattern); if none, the pre-existing server-draft flow
runs as before. `resetBill()` now also clears the local draft after
live checkout, offline-queued checkout, and Cancel. Per `final.md`:
stays local until "Generate Bill" — no automatic handoff to the live
`PendingBill` flow even if connectivity returns mid-edit. Verified:
`npm install` + `npm run build` (root + `frontend/`) clean, `oxlint` 0
errors, boot-tested (`GET /api/products`/`POST /billing/orderDetails`
401 with no token), `npm test` 66/66. Known/open: no live
browser/IndexedDB — store creation, restore-on-reload, clear-on-
finalize are code-reviewed only; recommend a manual reload check (both
online and devtools-Offline) once merged. DB version bump runs
`onupgradeneeded` once automatically for returning users; no migration
of existing `sales` entries needed.

**2026-08-26 — Stage 12 follow-up: unit tests (Hassan-flagged).**
`offlineQueue.js` had zero test coverage (true of the whole `frontend/`
tree, no test runner before this). Added `fake-indexeddb` as a
`frontend/` devDependency and `frontend/src/lib/offlineQueue.test.js`
(10 cases, `node:test`, new `npm test` script in
`frontend/package.json`) covering the pre-existing `sales`-queue
functions plus the new draft functions, and store-isolation. Root `npm
test` unchanged (backend-only); run frontend tests via `npm --prefix
frontend test`. Writing these surfaced a real bug: `withStore()` opened
a new IndexedDB connection per call and never closed it, hanging
`indexedDB.deleteDatabase()` between test runs — fixed by closing the
connection in `tx.oncomplete`/`tx.onerror` (same function this stage
already touched, folded in rather than flagged separately). Verified:
`frontend npm test` 10/10, `npm run build` clean, `oxlint` 0 errors,
root `npm test` 66/66 unchanged. Known/open: unit tests run against
`fake-indexeddb`, not a real browser — not a substitute for the manual
reload/offline check already recommended above.

**2026-08-26 — Stage 13 complete.** Offline: sync reliability &
dashboard visibility. Depended on Stage 12 (same `lib/offlineSync.js`
surface), sequenced after it as planned. Sync commit/transaction/replay
logic itself is unchanged — additive reliability/visibility only.

- **Reconnect delay** (`frontend/src/lib/offlineSync.js`): the `online`
  event now calls `scheduleReconnectFlush()`, which waits ~60s
  (`RECONNECT_DELAY_MS`, debounced — repeated online/offline flapping
  resets the timer rather than stacking flushes) before flushing,
  instead of firing instantly.
- **Sync UX overlay**: new `frontend/src/components/SyncOverlay.jsx`,
  mounted in `App.jsx`. `offlineSync.js` exposes a small pub-sub
  (`subscribeAutoSync`/`isAutoSyncing`), set only around *automatic*
  flushes (interval tick, reconnect, initial mount via a new
  `autoFlush()` wrapper) — Reports.jsx's manual "Sync Now" button still
  calls `flushQueue()` directly, bypassing the flag, and keeps its
  existing per-button "Syncing…" state untouched.
- **Post-sync verification**: `flushOne()` now calls a new
  `verifyOrderExists()` (uses the existing `api.getOrder()`) after a
  `synced` result, before trusting it. Three outcomes: `ok` → mark
  synced as before; `not-found` (a genuine non-network error — the
  server said synced but the order isn't there) → mark `conflict` with
  a clear message; `unverified` (network/timeout on all 3 attempts,
  500ms/1s exponential backoff) → leave the entry `pending` so the next
  flush retries the whole commit+verify cycle (safe, since
  `POST /api/sync/commit` is idempotent).
- **`offlineOrigin` marker**: `models/Order.js` gets `offlineOrigin`
  (Boolean, default `false`); `lib/offlineSync.js`'s `syncOfflineSale()`
  sets it `true` at order creation.
- **Dashboard visibility**, folded in per `final.md`'s allowance since
  it's a one-line addition: `lib/reports.js`'s `getDashboardSummary`
  gets an `offlineOrders` facet/field; `Dashboard.jsx` gets one more
  `StatCard` ("Offline Sales"). Flagged: this makes the second stat-card
  row 6 cards instead of 5, wrapping slightly asymmetrically on `md`
  screens — cosmetic only, grid columns not touched to stay minimal.
- **Incidental (Hassan-authorized, not silently folded in)**: removed a
  leftover multi-line debug `console.log('OFFLINE CUSTOMER DEBUG:', …)`
  in `lib/offlineSync.js` predating this stage — logged customer names
  server-side on every sync attempt, no functional effect, just log
  noise. Flagged first, removed only after Hassan confirmed it was safe
  to drop.

**Affected files:** `frontend/src/lib/offlineSync.js`,
`frontend/src/components/SyncOverlay.jsx` (new), `frontend/src/App.jsx`,
`lib/offlineSync.js`, `models/Order.js`, `lib/reports.js`,
`frontend/src/pages/Dashboard.jsx`.

**Verified:**
- Root: `npm install` + `npm test` — 66/66 pass, before and after the
  debug-log removal.
- Backend boot-tested with a real `.env` (no live Mongo in sandbox —
  standing constraint): `GET /api/products`, `GET /api/orders/:id`,
  `GET /dashboard/load` all correctly 401 with no token.
- `frontend`: `npm install` + `npm run build` (Vite) clean; `npm test`
  (Stage 12's `fake-indexeddb` suite) 10/10 pass, unaffected by this
  stage's changes.
- `npx oxlint` on all seven touched/added files — 0 warnings, 0 errors.
- Build/test artifacts (`node_modules` both places, `frontend/dist`,
  `.env`) removed after verification, before packaging.

**Known/open:**
- No live browser in this sandbox — the 60s reconnect delay, the
  overlay's show/hide timing, and the verification retry/backoff path
  are code-reviewed only, not exercised end-to-end. Recommend a manual
  check once merged: go offline, queue a sale, go back online, confirm
  the overlay appears ~60s later (not instantly) and clears when the
  flush finishes; simulate a slow/flaky connection during that window
  if possible.
- The `offlineOrigin` field and the Dashboard/Reports "Offline Sales"
  figure are code-reviewed/schema-checked only — no live Mongo to
  generate a real synced offline order against.
- `unverified` (network failure during verification) intentionally
  leaves a sale `pending` rather than `conflict` — this means a sale
  that server-side actually synced successfully but couldn't be
  locally confirmed will silently retry via the idempotent commit path
  next cycle; this is by design (per `final.md`) but means such a sale
  won't show as needing attention if the device stays offline
  indefinitely afterward. Not expected to be a real-world issue given
  the reconnect delay and interval retry, flagging for awareness only.
