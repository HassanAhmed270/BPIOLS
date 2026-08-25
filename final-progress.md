# Final Fixes Progress Log — BPIOLS

Append-only log for the phase defined in `final.md`. Do not rewrite prior
entries — append new ones as each stage completes. This log is separate
from `production-progress.md` (the previous phase's log) — the two must
never be confused with each other.

Stage numbering here follows `final.md` only, starting fresh at Stage 1,
independent of `production.md`'s Stage 1–8 and the original build's
`progress.md` numbering.

No stages completed yet. `final.md` was agreed on 2026-08-24 after a
full item-by-item discussion of Hassan's handwritten notes and
screenshots. Three items from those notes (Exchange process improvements,
Offline management overhaul, Dashboard offline-billing visibility) were
deliberately left out of the initial `final.md` — see its (now resolved)
"Deferred — not yet scoped" section — pending further detail from
Hassan.

**2026-08-25 update:** Hassan supplied a separately-triaged document
covering exactly those three deferred items (plus the standalone
"where is offline data saved?" question). Merged into `final.md` as
Stage 12 (offline draft persistence), Stage 13 (offline sync reliability
& dashboard visibility), and Stage 14 (exchange process improvements).
Stages 1–11 were not touched — that document's own "not covered" section
noted it lacked context on the already-resolved #4/#7 (product
deletion/stock-adjustment) discussion, so nothing from it was allowed to
override Stage 9. A full coverage audit against all 16 original notebook
items was appended to the end of `final.md`; all 16 are now accounted
for (15 as their own stage/closed-item, #7 folded into Stage 9's scope
rather than kept separate). `final.md` now has 14 stages; the "Deferred"
section is empty. No code changed this update — planning only.

**2026-08-25 — Stages 1–6 complete (condensed).**

**Stage 1 — Currency: PKR.** `frontend/src/lib/money.js`'s `formatMoney()`
outputs `Rs 1,234.50` (comma thousands-grouping, `-Rs X.XX` for
negatives). Confirmed via grep no other file has a hardcoded `$`.

**Stage 2 — Product ID auto-generation.** `POST /api/product` create
path ignores any submitted `productId`, generates sequential `#000N` via
`nextProductId()`, backed by new `models/Counter.js` (atomic `$inc`,
lazily seeded from max existing `productID`) so deleted IDs are never
reissued. Update path unchanged. `Products.jsx`: ID input removed from
Add; Update still shows it disabled/pre-filled.
*Known:* ID capped at 4 digits (`#0001`–`#9999`), no overflow guard.

**Stage 3 — Audit log: flattened readable table.** New
`frontend/src/lib/flattenObject.js` flattens nested `before`/`after`
snapshots into `{ path, value }` rows; `AuditLog.jsx` replaced its raw
`JSON.stringify` dump with a Field/Before/After table, differing rows
highlighted, money/date keys formatted. No backend changes.

**Stage 4 — PDF export alongside CSV.** Added `pdfkit`. New `lib/pdf.js`'s
`sendTablePDF()` streams a landscape A4 table PDF, sharing each route's
`{ key, label }` columns with `lib/csv.js`. `routes/export.js`: all 5
routes gained `?format=pdf` (default CSV) via a shared `sendReport()`
helper. `Reports.jsx` shows CSV + PDF buttons per report card.

**Stage 5 — Toast & confirm-dialog infrastructure.** Added `sonner`. New
`frontend/src/components/ConfirmDialog.jsx` exports `ConfirmProvider` and
`useConfirm()` — resolves a promise `true`/`false`, single-pending-dialog
design, reuses the app's existing fixed-modal Tailwind pattern. `App.jsx`
mounts `<Toaster>` and `<ConfirmProvider>` once at the root. No page call
sites touched yet (that's Stage 6) — smoke-tested via a temporary wiring
into `Dashboard.jsx`, then reverted byte-identical before completion.

**Stage 6 — Migrate all alert()/confirm() call sites.** All 64 call
sites across `Billing.jsx` (23), `Orders.jsx` (11), `Suppliers.jsx` (9),
`Customers.jsx` (8), `Users.jsx` (8), `Products.jsx` (6) now use
`toast.success()`/`toast.error()` (by message intent) and
`await confirm(...)`. Incidental fix: added `confirm` to a `useEffect`
dependency array in `Billing.jsx` (safe — `useConfirm()`'s return is a
stable `useCallback`). Confirmed via `grep` zero raw `alert()`/`confirm()`
remain in `frontend/src/pages/`.

**Verified (Stages 1–6, combined):** backend boot-tested with a real
`.env` each stage; `npm test` — all 66 tests pass unchanged throughout;
`npm install` + `npm run build` (Vite) clean each stage; `npm run lint`
(`oxlint`) 0 errors throughout, only 2 pre-existing `react/only-export-
components` warnings (`useAuth`, `useConfirm`), not regressions.
`lib/pdf.js` additionally verified via a standalone script (valid PDF,
correct `Content-Type`). Build/test artifacts removed before packaging
each stage.

**Known/open (Stages 1–6, combined):** no live MongoDB replica set or
live browser in this sandbox for any stage — all live-data/visual checks
noted per-stage as not performable, a standing constraint across the
whole project, not a defect. `lib/pdf.js`'s table layout is simple
(fixed-width columns, ellipsis truncation, no wrapping). Toast/confirm
UI's real rendered appearance and `useConfirm()`'s single-pending-dialog
behavior against real overlapping-confirm scenarios were not visually/
live verified — recommend a manual click-through once merged.

**2026-08-25 — Stage 7 complete.**

**Stage 7 — Add Product: required cost, real StockBatch (self-buying
only).** `routes/products.js`'s `POST /api/product` create path now
requires `cost` (400 "Cost is required." if missing/non-numeric/negative
— update path unaffected). On create: a `buyingPriceHistory` entry
(`supplierID: null`) is always recorded, and if the submitted initial
`stock` is positive, a matching `NoSupplier`-tagged `StockBatch` is
created in the same transaction as the product save (via `createBatch()`
from `lib/costing.js`, purchase ID from the newly-shared
`generateUniquePurchaseId()`). Zero initial stock still records the cost
basis but creates no batch — `StockBatch.quantityPurchased` requires
`min: 1`, and there's nothing yet to batch. `frontend/src/pages/Products.jsx`:
added a required Cost input to Add mode only (validated client-side
before submit); Update mode is untouched, including its existing
Supplier dropdown (that field sets `Product.supplierID`, a separate
declarative "currently sourced from" field unrelated to purchase-batch
creation — see Known/open below).

**Shared-helper extraction (flagged, per `final.md`'s own "possibly...if
extracting" note):** `generateUniquePurchaseId()` moved from
`routes/suppliers.js` into `lib/costing.js` (now exported alongside
`createBatch`/`consumeFIFO`/`restoreConsumption`) since both
`routes/suppliers.js` and `routes/products.js` now need it; behavior is
unchanged, still checks `Supplier.purchases` for collisions.

**Incidental one-line fix:** `routes/suppliers.js` called
`mongoose.startSession()` in `POST /supplier/purchase` without ever
`require('mongoose')`-ing it — a pre-existing bug (would throw
`ReferenceError` on every real purchase against a live DB, self-purchase
or supplier). Added the missing import while touching this file for the
shared-helper extraction above. Stated here as incidental per the
project's own rule for one-line, obviously-correct fixes — not part of
Stage 7's own scope, but directly adjacent to code this stage had to
touch anyway.

**Flagged interpretation (not a code change, for confirmation):**
`final.md`'s Stage 7 text says "There is intentionally no supplier
picker on this form." Read literally this could mean removing the
existing Supplier dropdown from Add Product entirely — but that dropdown
is shared with Update mode (same form, same field), Stage 7's own scope
says "Edit is unaffected," and the dropdown sets an unrelated field
(`Product.supplierID`, the product's declared current source) rather
than anything to do with the new cost/StockBatch logic. Interpreted this
as: no *new* picker is needed for the batch/cost path specifically (the
batch is always `NoSupplier`-tagged regardless of what's selected there)
— the pre-existing dropdown was left exactly as-is. Please confirm this
reading is correct; if Hassan actually wants the Supplier field removed
from Add Product specifically (but kept on Update), that's a small
follow-up, not a re-do of this stage.

**Verified:**
- Backend boot-tested with a real `.env` (server starts cleanly, both
  `routes/products.js` and `routes/suppliers.js` mount without error —
  this also confirms the missing-`mongoose`-import fix doesn't break
  anything). `POST /api/product` and `POST /supplier/purchase` both
  correctly return 401 "Login required." with no token, confirming the
  route chain is intact pre-DB.
- `npm test` — all 66 existing tests pass unchanged; no new pure-math
  logic was added that warranted its own test (the new logic is
  transactional DB writes, same category as `consumeFIFO`/
  `restoreConsumption`, which `tests/costing.test.js` already documents
  as not exercised without a live Mongo session).
- `npm install` + `npm run build` (Vite) — clean, no errors.
- `npm run lint` (`oxlint`) — same 2 pre-existing warnings as every prior
  stage (`useAuth`, `useConfirm` fast-refresh notices), 0 errors, no new
  warnings introduced.
- Test/build artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`) removed after verification, before packaging.

**Known/open:**
- No live MongoDB replica set in this sandbox — the actual cost-required
  validation (400 path) and the transactional product-save +
  `StockBatch`-creation logic could not be exercised end-to-end, only
  confirmed via code review and the route-mounting/pre-DB-auth boot test
  above. Same standing constraint as every prior stage.
- The Supplier-dropdown interpretation above is a flagged, not fully
  confirmed, reading of `final.md`'s wording — see that section.
- `models/StockBatch.js`'s header comment updated to reflect Stage 7
  superseding the old Stage-22 "Product-form stock is never batched"
  note for the Add Product path specifically; Update Product still has
  no cost input and still doesn't batch (unchanged, and explicitly
  Stage 9's job to address).

**2026-08-25 — Stage 8 complete.**

**Stage 8 — Billing: show last-purchased cost (admin-only).**
`frontend/src/pages/Billing.jsx` only, no backend changes — `GET
/api/products` already returns `costPrice` per product (via
`getLatestBuyingPrice()`). `handleSelectProduct` now also stores the
selected product's `costPrice` on `itemForm`; a disabled "Cost Price"
field (formatted via `formatMoney()`) renders next to the existing
disabled "Unit Price" field in the item-entry form, gated behind
`isAdmin` from `useAuth()` (same admin pattern used elsewhere in the
app, e.g. `Users.jsx`/`AdminRoute`). Added `costPrice` to `itemForm`'s
initial `useState` and both post-add/reset call sites for consistency,
even though the display only reads it while a product is selected.

**Verified:**
- `npm install` + `npm run build` (Vite) — clean, no errors.
- `npx oxlint frontend/src/pages/Billing.jsx` — 0 warnings, 0 errors.
- Backend boot-tested with a real `.env` (no backend files touched this
  stage; confirmed server still starts cleanly and
  `POST /billing/orderDetails` still correctly returns 401 "Login
  required." with no token).
- `npm test` — all 66 existing tests pass unchanged.
- Build/test artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`) removed after verification, before packaging.

**Known/open:**
- No live browser in this sandbox — the actual on-screen placement/
  styling of the new Cost Price field, and that it only appears for an
  admin-role login, were not visually verified, only confirmed via code
  review (`isAdmin` comes from `AuthContext`'s `role === 'admin'` check,
  the same source every other admin-gated UI element in the app uses).
  Recommend a manual click-through as admin and as a non-admin role once
  merged.
