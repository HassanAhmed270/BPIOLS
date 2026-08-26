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
now requires `cost`; positive initial stock creates a matching
`NoSupplier`-tagged `StockBatch` via shared `createBatch()`/
`generateUniquePurchaseId()` (extracted to `lib/costing.js`, now shared
by `routes/suppliers.js` too). `Products.jsx`: required Cost input,
Add mode only. Incidental one-line fix: `routes/suppliers.js` was
missing its `mongoose` import (pre-existing bug). Flagged interpretation
(confirmed): Add Product's pre-existing Supplier dropdown — a separate
declarative field, shared with Update — was left in place; only the
cost/batch path is always `NoSupplier`-tagged. Verified: boot-tested,
`npm test` 66/66, `npm run build` clean, `oxlint` 0 errors.

**Stage 8 complete (2026-08-25, condensed).** `Billing.jsx` only, no
backend changes — `costPrice` already reached the frontend via `GET
/api/products`. Selected product's cost now renders next to selling
price in the item-entry form, gated `isAdmin`. Verified: `npm run build`
clean, `oxlint` 0 errors, boot-tested, `npm test` 66/66.

**Stage 9 complete (2026-08-25, split 9a/9b/9c — flagged, confirmed,
per `final.md`'s own suggestion).**
- **9a** — Add Stock + Deduct Stock actions, zero-stock auto-disable.
  `models/Product.js` gained `disabled`; new `models/Loss.js`.
  `lib/costing.js`'s new `disableIfDepleted()` wired into checkout
  (`routes/billing.js`) and offline sync (`lib/offlineSync.js`) — both
  are genuine sale paths that can zero stock, flagged as a necessary
  small addition beyond the stage's listed areas. `routes/products.js`:
  Update Product no longer touches `quantity`; new
  `POST /api/product/:productID/add-stock` and `.../deduct-stock`
  (reason-coded: `expired`/`returned_to_supplier`/`damaged_lost`/
  `discontinued` + note; `returned_to_supplier` credits a supplier via
  FIFO-recovered cost instead of writing a `Loss`). `routes/suppliers.js`:
  `/supplier/purchase` now always requires a real supplier. Incidental:
  removed the dead, unreachable `POST /billing/update`.
- **9b** — Loss surfaced on Dashboard (`lib/reports.js`'s
  `getDashboardSummary`) + a new 6th Reports export
  (`GET /api/export/losses`).
- **9c** — hard-delete rework. `DELETE /product/:productID` now requires
  `{reason, note}` (shared `DEDUCT_REASONS`), 400s if `quantity > 0`;
  otherwise the same permanent delete, reason/note folded into the audit
  log as an annotation only. Frontend gained a Delete Product panel
  mirroring Add/Deduct Stock's pattern.

Verified (9a–9c): `node -c`/`oxlint` 0 errors throughout; `npm test`
66/66 after every sub-stage; `npm run build` clean after every
sub-stage; boot-tested after each sub-stage. Known/open: no live Mongo
replica set or browser in sandbox — FIFO math, credit increments, Loss
writes, auto-disable/re-enable, and the new UI are code-reviewed only,
not end-to-end verified. Recommended manual flow once merged: create a
product → deduct all stock (any reason) → confirm disabled + Loss (if
not "Returned to Supplier") → re-Add Stock → confirm re-enabled →
deduct to zero with "Returned to Supplier" → confirm supplier credit,
no Loss → delete with a reason → confirm permanent removal; separately,
attempt delete on a product with remaining stock → confirm blocked.

**2026-08-26 — Stage 10 complete.**

**Stage 10 — UI polish: Products form, Billing preview.** Frontend-only,
no backend changes.

`Products.jsx`: Add/Update form header and submit button now match
Customers.jsx's convention exactly — `text-blue-600`/`bg-blue-600` for
Add mode, `text-yellow-600`/`bg-yellow-600` for Update mode (previously
both used green unconditionally). Form restructured into a 2-column
grid: Name+Category paired; Selling Price paired with Cost (Add mode) or
Supplier (Update mode, since Update has no Cost field post-Stage-9); Add
mode gets an extra Stock+Supplier row. Low Stock Threshold stays a
full-width row (has explanatory text beneath it). Supplier field is
still present in both modes, just relocated into the grid rather than
removed — Stage 7's dropdown-retention decision is unaffected by this
stage.

`Billing.jsx`: on-screen cart/bill preview's 8-column table
(`#`/Code/Product/Price/Qty/Total/Save/Net) replaced with a stacked
receipt-line layout — each item now renders as two lines (`#1 #0001
ProductName` then `1 × Rs 500.00 -10% = Rs 450.00`), click-to-remove
behavior preserved on the whole row. Only this on-screen summary
changed; `printReceiptFor` and the Special Bill markup
(`showSpecialPreview` block) are untouched, confirmed separate code
paths before editing.

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
