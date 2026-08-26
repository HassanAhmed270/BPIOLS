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

**2026-08-25 — Stage 9 complete (split into 9a/9b/9c, flagged and
confirmed before starting; final.md itself suggested this split).**

**9a — Add Stock + Deduct Stock actions, zero-stock auto-disable.**
`models/Product.js`: new `disabled` boolean. `models/Loss.js` (new): one
doc per Deduct Stock write-off whose reason isn't `returned_to_supplier`
(`productID`, `productName`, `quantity`, `costValue` from FIFO, `reason`,
`note`, `actor`, `date`). `lib/costing.js`: new shared
`disableIfDepleted(updated, session)`, wired into `routes/billing.js`
(checkout) and `lib/offlineSync.js` (offline sale) — both are genuine
sale paths that can zero out stock, so both needed it beyond the
stage's listed affected areas; flagged as the "small, clearly-necessary
addition" the project rules allow. `routes/billing.js`: `/billing/
reserve` guards `disabled:{$ne:true}`; removed the dead, unreachable
`POST /billing/update` (incidental — exactly what Stage 9's completion
criteria says must not exist). `routes/products.js`: Update Product no
longer touches `quantity`; `GET /api/products` returns `disabled`; two
new routes, `POST /api/product/:productID/add-stock` (cost+quantity,
always `NoSupplier`-tagged, re-enables) and `.../deduct-stock`
(quantity+reason+note; `returned_to_supplier` credits a chosen
supplier via FIFO-recovered cost instead of writing a `Loss`; capped at
`quantity - reserved`). `routes/suppliers.js`: `/supplier/purchase` now
always requires a real supplier, `isSelfPurchase` branch removed.
Frontend: `Products.jsx` gained Add Stock/Deduct Stock forms + ➕/➖ row
actions, disabled rows render greyed; `Suppliers.jsx` lost the
`NoSupplier` option; `api.js` gained `addStock()`/`deductStock()`.

**9b — Loss surfaced on Dashboard + a new 6th Reports export.**
`lib/reports.js`: `getDashboardSummary` gained a `lossAgg` →
`totalLosses`/`totalLossValue`; new `getLossRows(range)`.
`routes/export.js`: new `GET /api/export/losses` (6th type, per
`final.md`'s own "flag if this needs a 6th" note); `summary` export
gained the two new columns. `Dashboard.jsx` gained a "Losses" StatCard;
`Reports.jsx`'s `EXPORTS` array gained a `losses` entry (data-driven).

**9c — hard-delete rework.** `routes/products.js`'s
`DELETE /product/:productID` now requires `{reason, note}` (shared
`DEDUCT_REASONS` const with Deduct Stock); 400s with the remaining
quantity if `product.quantity > 0`; otherwise the same permanent
`findOneAndDelete`, with `reason`/`note` folded into the audit log's
`before` as an annotation only (no Loss/credit side effects fire here).
Frontend: 🗑️ now calls `handleDeleteClick` — blocks with a toast if
stock remains, else opens a new Delete Product panel (reason + note,
warning banner, confirm gate); Undo snapshot now always records
`stock: 0`. `api.js`'s `deleteProduct()` takes a payload.

**Verified (9a–9c, combined):** `node -c`/`oxlint` clean across every
touched file (0 errors throughout; a handful of pre-existing unrelated
warnings confirmed via diff, not regressions); `npm test` 66/66 pass
unchanged after every sub-stage; `npm run build` clean after every
sub-stage; backend boot-tested after each sub-stage (new/changed routes
correctly 401 with no token; removed `/billing/update` 404s). Artifacts
removed after each verification pass.

**Known/open:** no live MongoDB replica set or browser in this sandbox
for any of 9a/9b/9c — boot tests confirm routing/auth/validation only,
not full transactional behavior (FIFO math, credit increments, Loss
writes, auto-disable/re-enable, hard-delete's quantity gate) or any new
UI, which are code-reviewed only. Recommend once merged: create a
product → deduct all stock (any reason) → confirm disabled + (if not
"Returned to Supplier") a Loss entry, appearing on the Dashboard/in the
new Losses export → re-Add Stock → confirm re-enabled → deduct to zero
again with reason "Returned to Supplier" → confirm supplier credit
adjusted, no Loss entry → delete with a reason → confirm permanent
removal; separately, attempt delete on a product with remaining stock →
confirm blocked. Stage 9 (9a+9b+9c) is fully complete as of this entry.

**Stage 9c complete — hard-delete rework. Stage 9 now fully done
(9a+9b+9c).** `routes/products.js`'s `DELETE /product/:productID` now
requires `{reason, note}` from the same reason set Deduct Stock uses
(factored into a shared `DEDUCT_REASONS` const); 400s with the remaining
quantity if `product.quantity > 0` ("deduct all remaining stock first");
otherwise performs the same permanent `findOneAndDelete` as before, with
`reason`/`note` folded into the audit log's `before` snapshot as an
annotation (no Loss/credit side effects here — those already fired, if
relevant, when Deduct Stock brought quantity to 0). Frontend:
`Products.jsx`'s 🗑️ button now calls `handleDeleteClick`, which blocks
with a toast if stock remains, else opens a new "Delete Product" panel
(reason dropdown + required note, red warning banner, confirm-dialog
gate) mirroring Add/Deduct Stock's pattern; Undo snapshot now always
records `stock: 0` (the only value reachable pre-delete now).
`api.js`'s `deleteProduct()` takes a payload, sent as the DELETE body.

**Verified:** `node -c`/`oxlint` (0 errors) on all 3 touched files;
`npm test` 66/66 unchanged; backend boot-tested (`DELETE
/product/:productID` and `POST .../deduct-stock` both correctly 401
with no token); `npm run build` clean. Artifacts removed.

**Known/open:** no live DB/browser — the quantity>0 block, the
reason-logged delete, and the new panel are code-reviewed only.
Recommend the exact flow `final.md` calls out: create → deduct all
stock (any reason) → confirm disabled — delete now unblocked → delete
with a reason → confirm permanent removal; separately, attempt delete
on a product with remaining stock → confirm blocked. All three Stage 9
sub-stages (9a/9b/9c) are complete as of this entry.
