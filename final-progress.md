# Final Fixes Progress Log — BPIOLS

Append-only log for the phase defined in `final.md`. Do not rewrite prior
entries — append new ones as each stage completes. This log is separate
from `production-progress.md` (the previous phase's log) — the two must
never be confused with each other.

Stage numbering here follows `final.md` only, starting fresh at Stage 1,
independent of `production.md`'s Stage 1–8 and the original build's
`progress.md` numbering.

No stages completed yet. `final.md` was agreed on 2026-08-24 after a
full item-by-item discussion of Hassan's handwritten notes/screenshots.

**2026-08-25 update:** A separately-triaged document covering the three
originally-deferred items (Exchange process, Offline management overhaul,
Dashboard offline-billing visibility) plus one standalone question was
merged into `final.md` as Stages 12–14. Stages 1–11 untouched; that
document lacked context on the already-resolved product-deletion/
stock-adjustment discussion, so nothing from it overrode Stage 9. All 16
original notebook items are now accounted for across `final.md`'s 14
stages; "Deferred" is empty. No code changed this update — planning only.

**2026-08-25 — Stages 1–6 complete (condensed).** Stage 1: PKR currency via
`formatMoney()` (`Rs 1,234.50`, comma-grouped, `-Rs X.XX` negatives).
Stage 2: sequential `#000N` product IDs server-side (`nextProductId()`/
`models/Counter.js`, atomic, deleted IDs never reissued); ID capped at 4
digits, no overflow guard. Stage 3: `AuditLog.jsx` flattened
before/after diff table (`lib/flattenObject.js`) replacing raw JSON.
Stage 4: PDF export alongside CSV for all 5 report routes
(`lib/pdf.js`'s `sendTablePDF()`, `pdfkit`). Stage 5: toast/confirm
infra (`sonner`, `ConfirmDialog.jsx`'s `useConfirm()`). Stage 6:
migrated all 64 `alert()`/`confirm()` call sites across 6 pages to
toast/`useConfirm()` — zero remain in `pages/`.

**Verified (1–6):** boot-tested each stage; `npm test` 66/66 throughout;
`npm run build` clean; `oxlint` 0 errors (2 pre-existing unrelated
warnings). `lib/pdf.js` also checked via a standalone script (valid PDF,
correct `Content-Type`).

**Known/open (1–6):** no live DB/browser in this sandbox for any stage —
standing constraint, not a defect. Toast/confirm and PDF layout not
visually verified — recommend a manual click-through once merged.

**Stage 7 complete.**

**Stage 7 — Add Product: required cost, real StockBatch (self-buying
only).** `routes/products.js`'s create path now requires `cost` (400 if
missing/non-numeric/negative — update path unaffected). On create: a
`buyingPriceHistory` entry (`supplierID: null`) always recorded; positive
initial `stock` also creates a matching `NoSupplier`-tagged `StockBatch`
in the same transaction (`createBatch()`, shared `generateUniquePurchaseId()`).
Zero initial stock records cost basis but no batch
(`StockBatch.quantityPurchased` requires `min: 1`). `Products.jsx`:
required Cost input on Add mode only; Update mode (incl. its existing
Supplier dropdown, a separate declarative field) untouched.

**Shared-helper extraction (flagged, per `final.md`'s own note):**
`generateUniquePurchaseId()` moved `routes/suppliers.js` →
`lib/costing.js`, now shared by both purchase routes; behavior unchanged.

**Incidental one-line fix:** `routes/suppliers.js` called
`mongoose.startSession()` without ever requiring `mongoose` — pre-existing
bug (would `ReferenceError` on any real purchase). Added the missing
import while in this file for the extraction above.

**Flagged interpretation (for confirmation):** `final.md`'s "no supplier
picker on this form" read literally could mean removing Add Product's
existing Supplier dropdown — but it's shared with Update mode and sets
an unrelated field (`Product.supplierID`). Interpreted as: no *new*
picker needed for the batch/cost path (always `NoSupplier`-tagged); the
pre-existing dropdown left as-is. Confirm this reading, or it's a small
follow-up, not a re-do.

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

**2026-08-25 — Stage 9a complete (Stage 9 split into 9a/9b/9c, flagged and
confirmed before starting; final.md itself suggested this split).**

**Stage 9a — Add Stock + Deduct Stock actions, zero-stock auto-disable.**
- `models/Product.js`: new `disabled` boolean (default false).
- `models/Loss.js` (new): one doc per Deduct Stock write-off whose reason
  isn't `returned_to_supplier` — `productID`, `productName`, `quantity`,
  `costValue` (from FIFO), `reason` (`expired`/`damaged_lost`/
  `discontinued`), `note`, `actor`, `date`. Surfacing it on Dashboard/
  Reports is Stage 9b, not this stage — only written here.
- `lib/costing.js`: new shared `disableIfDepleted(updated, session)` —
  sets `Product.disabled = true` the instant a guarded decrement takes
  `quantity` to 0. Wired into `routes/billing.js` (checkout commit loop)
  and `lib/offlineSync.js` (offline sale commit) — both are genuine sale
  paths that can zero out stock, so both needed it even though only
  `routes/products.js` was in the stage's original affected-areas list;
  flagging this as the "small, clearly-necessary addition the stage's
  own task implies" the project rules allow proceeding on. Order
  edit/refund never decreases a product's quantity (only restores it via
  `applyLineReduction`), so `routes/orders.js` needed no change.
- `routes/billing.js`: `/billing/reserve` now also guards
  `disabled: {$ne:true}` so a disabled product can't be reserved for a
  new cart line; its 409 response now distinguishes "not found" /
  "disabled" / "not enough stock" for a clearer message. Removed the
  dead `POST /billing/update` route — flagged as incidental: it was a
  bare, reason-less quantity setter with no frontend call site
  anywhere (confirmed via grep), and is exactly what Stage 9's own
  completion criteria says must not exist once Deduct Stock ships.
  Its removal also left `requireAdmin` unused in that file's import —
  cleaned up (lint-driven, same file already being edited).
- `routes/products.js`: Update Product's branch no longer touches
  `quantity` at all (`stock`/`already` fully removed from that path);
  `GET /api/products` now returns `disabled`. Two new routes:
  `POST /api/product/:productID/add-stock` (admin, cost+quantity
  required, always `NoSupplier`-tagged batch via the Stage 7 pattern,
  re-enables a disabled product) and
  `POST /api/product/:productID/deduct-stock` (admin, quantity+reason+
  note required; `reason=returned_to_supplier` also requires a real
  `supplierId` and credits that supplier's `creditBalance` with the
  FIFO-recovered cost instead of writing a `Loss`; deduction is capped
  at `quantity - reserved` so it can't pull stock out from under an open
  cart). Both routes are transactional and audit-logged
  (`product.stock_added`/`product.stock_deducted`).
- `routes/suppliers.js`: `POST /supplier/purchase` now always requires a
  real, existing supplier — rejects blank and the `NoSupplier` sentinel;
  removed the entire `isSelfPurchase` branch (batch/audit/response paths
  all simplified to the always-real-supplier case). Self-purchase now
  only exists via Products' Add Stock.
- Frontend: `Products.jsx` — Update Product's stock field/`already`
  state removed entirely; two new dedicated forms (Add Stock, Deduct
  Stock — the latter with a reason dropdown, conditional supplier picker
  when "Returned to Supplier," and a confirm-dialog gate) reachable via
  new ➕/➖ row actions; disabled products render at `opacity-50` with a
  "Disabled" label, still fully clickable for an admin (so Add Stock can
  re-enable them). `Suppliers.jsx` — removed the `NoSupplier` dropdown
  option, the `isSelfPurchase`-related Amount Paid conditional, and the
  dead `NO_SUPPLIER` const/self-purchase toast branch. `api.js` —
  `addStock()`/`deductStock()`.

**Verified:**
- `node -c` on every touched backend file — all pass.
- `npm test` — all 66 existing tests pass unchanged (before and after the
  post-lint `requireAdmin` cleanup in `routes/billing.js`).
- `npx oxlint` on all touched files — 0 errors; 2 pre-existing unrelated
  warnings left alone (`StockBatch` unused in `suppliers.js`,
  `isValidDiscount` unused in `orders.js` — both predate this stage, out
  of scope).
- Backend boot-tested twice with a real `.env`: server starts cleanly;
  `GET /api/products`, both new product routes, `POST /supplier/purchase`,
  and `POST /billing/reserve` all correctly 401 with no token (confirms
  mounting/auth-gating); `POST /billing/update` now correctly 404s
  (route removed).
- `npm run build` (Vite) — clean, no errors.
- Artifacts (`node_modules` both locations, `frontend/dist`, `.env`)
  removed after verification.

**Known/open:**
- No live MongoDB replica set in this sandbox — boot tests confirm
  routing/auth/validation, not full transactional behavior against real
  data (FIFO consumption math, supplier credit increments, Loss writes,
  auto-disable/re-enable end-to-end). Recommend running through Add
  Stock → Deduct Stock (each reason) → re-Add Stock on a real product
  once merged, watching `Product.disabled`, `StockBatch`, `Loss`, and
  `Supplier.creditBalance`.
- No live browser — new Products.jsx forms/row actions and the disabled-
  row styling are code-reviewed only, not visually confirmed.
- Stage 9b (Loss surfaced on Dashboard + a Reports export) and Stage 9c
  (hard-delete rework: only reachable at zero stock, routed through a
  reason form) are still open — do not start either until explicitly
  requested; this entry covers 9a only.
