# Final Fixes Progress Log — BPIOLS

Append-only log for the phase defined in `final.md`. Do not rewrite prior
entries' substance — condense older stages for length only, never change
what they claim. Separate from `production-progress.md` (previous
phase's log) — the two must never be confused.

Stage numbering here follows `final.md` only, starting fresh at Stage 1,
independent of `production.md`'s Stage 1–8 and the original build's
`progress.md` numbering.

`final.md` was agreed 2026-08-24 after a full item-by-item discussion of
Hassan's handwritten notes/screenshots. **2026-08-25:** a second
triage document (Exchange process, Offline management overhaul,
Dashboard offline-billing visibility, plus one standalone question) was
merged in as Stages 12–14; Stages 1–11 untouched. All 16 original
notebook items are accounted for across 14 stages; "Deferred" is empty.

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
was missing its `mongoose` import (pre-existing bug). Verified:
boot-tested, `npm test` 66/66, `npm run build` clean, `oxlint` 0 errors.

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
Verified (9a–9c): `oxlint` 0 errors, `npm test` 66/66, `npm run build`
clean, boot-tested — after every sub-stage. Known/open: FIFO math,
credit increments, Loss writes, auto-disable/re-enable, and the new UI
are code-reviewed only, no live Mongo/browser in sandbox.

**Stage 10 complete (2026-08-26, condensed; see correction below).**
UI polish, frontend-only. `Products.jsx`: Add/Update form colors match
Customers.jsx (blue=Add, yellow=Update, was green); restructured into a
2-column grid (Name+Category, Selling Price+Cost/Supplier, Add mode
gets Stock+Supplier row, Threshold full-width). `Billing.jsx`:
on-screen cart preview's 8-column table replaced with stacked
receipt-lines (`#1 #0001 ProductName` / `1 × Rs 500.00 -10% = Rs
450.00`); `printReceiptFor`/Special Bill untouched.

**Verified:**
- `npm install` + `npm run build` (Vite) — clean, no errors.
- `npx oxlint frontend/src/pages/Products.jsx frontend/src/pages/Billing.jsx`
  — 0 warnings, 0 errors.
- Backend boot-tested with a real `.env` (no backend files touched this
  stage; confirmed server still starts cleanly, `GET /api/products` and
  `POST /billing/reserve` both correctly 401 "Login required." with no
  token).
- `npm test` — all 66 existing tests pass unchanged.
- Build/test artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`) removed after verification, before packaging.

**Known/open:**
- No live browser in this sandbox — the actual rendered spacing/height
  of the 2-column grid and the receipt-line layout were not visually
  verified, only confirmed via code review and a clean Vite build.
  Recommend a manual click-through of Add Product, Update Product, and
  the Billing preview (with a discounted item) once merged.
- Customers/Suppliers pages needed no change per `final.md` (already
  confirmed good in earlier discussion) — untouched this stage.

**2026-08-26 — Stage 11 complete.**

**Stage 11 — Bill preview: customer balance.** `Billing.jsx` only, no
backend changes — `GET /api/customers` already returns
`totalBalanceDue` per customer (`routes/customers.js`). Added
`totalBalanceDue` to what `customerDirectory` stores per customer
(alongside the existing `creditBalance`). A "Customer Balance" line now
renders at the bottom of the on-screen bill preview, after Grand
Total/Paid/Change, whenever a real customer (not walk-in) is selected —
computed as `totalBalanceDue - creditBalance` (positive = owes,
negative = in credit, labeled accordingly), reflecting the customer's
state *before* this sale, separate from the bill currently being built.

**Verified:**
- `npm install` + `npm run build` (Vite) — clean, no errors.
- `npx oxlint frontend/src/pages/Billing.jsx` — 0 warnings, 0 errors.
- Backend boot-tested with a real `.env` (no backend files touched this
  stage; confirmed server still starts cleanly, `GET /api/customers` and
  `POST /billing/orderDetails` both correctly 401 "Login required." with
  no token).
- `npm test` — all 66 existing tests pass unchanged.
- Build/test artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`) removed after verification, before packaging.

**Known/open:**
- No live browser in this sandbox — the actual on-screen placement and
  the owes/credit sign handling were not visually verified against a
  real customer with both a balance due and a credit balance
  simultaneously, only confirmed via code review and a clean build.
  Recommend a manual check once merged: a customer with an outstanding
  balance, a customer in credit, and walk-in (should show nothing).

**2026-08-26 — Stage 10 correction (flagged by Hassan, confirmed).**
Stage 10's 2-column grid paired the Supplier dropdown with Selling
Price in **Update** mode — meaning Update Product could silently
change a product's `supplierID`. Hassan confirmed this was wrong:
supplier is a declarative field that belongs to Add Product only;
restocking (self-buy via Add Stock, or real supplier via Suppliers >
Record a Purchase) is the only place supplier-related state should
change. Fixed both sides:
- `Products.jsx`: Supplier dropdown removed from Update mode entirely
  (still shown in Add mode, paired with Stock). Selling Price's row
  drops to a single column in Update mode since it no longer has a
  pairing partner.
- `routes/products.js`'s `POST /api/product`: `resolveSupplierId()`/
  validation now only runs on the create path; the update branch no
  longer sets `existingProduct.supplierID` at all — whatever the
  product's supplier was stays untouched by Update Product, full stop.
  `/product/undo`'s restore-from-snapshot path is unrelated (it
  replays a full prior snapshot including supplierID) and was not
  touched.

**Verified:** `npm run build` clean; `oxlint` 0 errors on both files;
`node --check routes/products.js` clean; `npm test` 66/66 unchanged;
backend boot-tested (`POST /api/product` still 401s correctly with no
token, confirming the reordered validation doesn't break the auth
gate). Artifacts removed after verification.

**Known/open:** no live DB/browser — the actual "supplier field
persists unchanged after an Update Product save" behavior is
code-reviewed only, not exercised end-to-end. Recommend confirming
once merged: update a product's name/price only, then check its
Supplier value is exactly what it was before the edit.

**2026-08-26 — Stage 12 complete.**

**Stage 12 — Offline: continuous draft persistence.**
`frontend/src/lib/offlineQueue.js` and `frontend/src/pages/Billing.jsx`
only, no backend changes. Added a new IndexedDB object store, `drafts`
(`pos-offline-queue` DB, `DB_VERSION` bumped 1→2, upgrade path adds it
alongside the existing `sales` store without touching that store's
data), keyed by a single fixed record (`id: 'current'`) since this is a
single-shop/single-cart app — `saveLocalDraft()`/`getLocalDraft()`/
`clearLocalDraft()` exported. `withStore()` was generalized to take a
store name param (previously hardcoded to `sales`) so both stores share
the same open/transaction plumbing; every existing call site updated
accordingly, `sales`-store behavior otherwise unchanged.

`Billing.jsx`: a new, non-debounced `useEffect` writes
`{ billingItems, customer, billId, paid, paymentMethod }` to
`saveLocalDraft()` on every change to any of those (item add/remove,
qty/discount edit, customer switch, amount-paid edit all funnel through
one or more of these state values) — separate from and in addition to
the existing 7s-debounced *server*-side autosave (`saveDraftNow`/
`api.saveDraft`), which still runs unchanged but silently fails offline
(caught, logged, not surfaced) exactly as before. On mount, a local
draft is checked *first*, ahead of the existing server-draft check —
same resume/discard confirm-dialog pattern, reusing `useConfirm()`. If
a local draft exists (with or without connectivity) the person is
offered to resume it and the server-draft check is skipped entirely for
that load; if none exists, the pre-existing server-draft flow runs
exactly as before. `resetBill()` — called after a successful live
checkout, a successful offline-queued checkout (`enqueueSale` path),
and Cancel — now also clears the local draft, so it never resurfaces
after the cart it described has actually been queued/completed/
discarded. Per `final.md`: stays local until "Generate Bill" is
pressed even if connectivity returns mid-edit — no automatic handoff to
the live `PendingBill` flow; that handoff (`saveDraftNow`/
`api.saveOrder`) is unchanged and still only fires at that explicit
button press.

**Verified:**
- `npm install` + `npm run build` (Vite, both root and `frontend/`) —
  clean, no errors.
- `npx oxlint frontend/src/pages/Billing.jsx frontend/src/lib/offlineQueue.js`
  — 0 warnings, 0 errors.
- Backend boot-tested with a real `.env` (no backend files touched this
  stage; confirmed server still starts cleanly, `GET /api/products` and
  `POST /billing/orderDetails` both correctly 401 with no token).
- `npm test` — all 66 existing tests pass unchanged.
- Build/test artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`) removed after verification, before packaging.

**Known/open:**
- No live browser/IndexedDB in this sandbox — the actual store
  creation on upgrade, restore-on-reload, and clear-on-finalize
  behavior are code-reviewed only, not exercised end-to-end (same
  standing constraint as Stages 5–11's UI work). Recommend a manual
  check once merged: build a cart, reload before pressing "Generate
  Bill" (both online and with devtools set to Offline), confirm the
  resume prompt restores it; confirm the prompt does *not* reappear
  after finalizing or cancelling a bill.
- Existing-user note: the DB version bump (1→2) means a returning
  user's browser runs the `onupgradeneeded` path once, automatically,
  the next time the app opens IndexedDB — no migration of existing
  `sales` entries is needed or performed, since that store's schema is
  untouched.

**2026-08-26 — Stage 12 follow-up: unit tests (Hassan-flagged).**
Hassan flagged that `offlineQueue.js`'s functions had zero test
coverage — true of the whole `frontend/` tree, which had no test
runner at all before this. Small, scoped addition: `fake-indexeddb`
added as a `frontend/` devDependency (simulates IndexedDB in Node);
`frontend/src/lib/offlineQueue.test.js` added (10 cases, `node:test`,
run via new `npm test` script in `frontend/package.json`) covering
`enqueueSale`/`listQueue`/`updateSale`/`clearSynced` (the pre-existing
`sales`-queue functions, also previously untested) and the new
`saveLocalDraft`/`getLocalDraft`/`clearLocalDraft`, plus one test
confirming the `drafts` and `sales` stores don't interfere with each
other. Root `npm test` is unchanged (backend-only, per its existing
script) — run frontend tests separately via
`npm --prefix frontend test`.

Writing these surfaced a real bug in the code from earlier this stage:
`withStore()` opened a new IndexedDB connection on every call and
never closed it — harmless-ish in a browser tab that eventually
closes, but it meant `indexedDB.deleteDatabase()` (used to reset state
between tests) hung waiting for a stale connection to release. Fixed
by closing the connection in `tx.oncomplete`/`tx.onerror` — same
function this stage already touched, so folded in rather than flagged
separately.

**Verified:** `frontend`: `npm test` 10/10 pass; `npm run build` clean;
`oxlint` 0 errors on `offlineQueue.js`, `offlineQueue.test.js`,
`Billing.jsx`. Root: `npm test` 66/66 unchanged. Artifacts
(`node_modules` both places, `frontend/dist`, `.env`) removed after
verification.

**Known/open:** these are unit tests against `fake-indexeddb`, not a
real browser's IndexedDB — a reasonable stand-in but not a substitute
for the manual reload/offline check already recommended above.
