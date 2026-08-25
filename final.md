# Final Fixes Plan — BPIOLS

Agreed after review of Hassan's handwritten notes and screenshots,
discussed item-by-item in conversation before any code was written. This
plan is independent of `production.md` — stage numbering here starts
fresh at **Stage 1** and has no relation to `production.md`'s Stage 1–8
or the original build's `progress.md` numbering.

Each stage is scoped to be small, self-contained, and safe to verify on
its own. Do not start a stage until the previous one is complete and
validated. Several stages have real dependencies on earlier ones in this
list (noted per stage) — respect that order even though it's not always
the order items were originally raised in.

Some items from Hassan's original notes are **not** in this plan yet —
see "Deferred — not yet scoped" at the end. Do not start those; they will
be added as their own stage(s) once Hassan provides the flow.

---

## Stage 1 — Currency: PKR

**Goal:** replace all `$` display formatting with PKR, with proper
thousands-grouping.

**Issues addressed:** app displays all money as `$X.XX`; Hassan wants
PKR, not USD, and wants thousands separators added (not present today).

**Implementation tasks:**
- Update `frontend/src/lib/money.js`'s `formatMoney()` to output PKR
  (`Rs` prefix) with comma thousands-grouping, e.g. `Rs 1,234.50`.
- No other file should need changes — every money display in the app
  already goes through this one function (`Billing.jsx`, `Orders.jsx`,
  `Customers.jsx`, `Products.jsx`, `Suppliers.jsx`, `Dashboard.jsx`).
  Confirm this during implementation; if any hardcoded `$` is found
  outside `formatMoney()`, fix it here too and note it.

**Affected areas:** `frontend/src/lib/money.js` only (unless a stray
hardcoded `$` is found, per above).

**Testing/validation:** `npm run build` clean. Manual visual check
recommended (no live-browser verification available in the sandbox).

**Completion criteria:** every money value in the UI displays as
`Rs X,XXX.XX`.

---

## Stage 2 — Product ID auto-generation

**Goal:** remove manual Product ID entry from Add Product; auto-generate
sequential IDs server-side.

**Issues addressed:** Product ID is currently a free-text field on Add
Product with no uniqueness check before submit — typing an ID that
matches an existing product silently merges into that product instead of
erroring. Hassan also just doesn't want to type IDs at all.

**Implementation tasks:**
- `POST /api/product` (create path only — the `existingProduct` branch is
  unaffected): when creating a new product, ignore any submitted
  `productId` and instead generate the next sequential `#000N` server-side
  (find the highest existing numeric ID and add 1; do not reuse deleted
  IDs — see Stage 8 for why deletion no longer frees up IDs in the normal
  case).
- Remove the Product ID input field from the Add Product form entirely
  (`frontend/src/pages/Products.jsx`, `mode === 'add'`). Show the
  generated ID to the user after creation (e.g. in a success toast, once
  Stage 5 lands — for now, a plain success message is fine).
- Edit/Update Product: unchanged. ID field stays disabled/display-only,
  keyed off the selected row, never typed.

**Affected areas:** `routes/products.js`, `frontend/src/pages/Products.jsx`.

**Testing/validation:** boot test — create two products back-to-back with
no ID supplied, confirm sequential IDs assigned and no collision;
`npm test`; `npm run build`.

**Completion criteria:** Add Product never asks for or accepts a
Product ID; IDs are sequential and collision-free.

---

## Stage 3 — Audit log: flattened readable table

**Goal:** replace the raw JSON dump in the Audit Log screen with a
human-readable table.

**Issues addressed:** `frontend/src/pages/AuditLog.jsx` currently renders
`entry.before`/`entry.after` as `JSON.stringify(..., null, 2)` inside a
`<pre>` block — raw JSON, unreadable to a non-technical user.

**Implementation tasks:**
- Write a generic flatten helper (new file, e.g.
  `frontend/src/lib/flattenObject.js`): given an object (including nested
  objects/arrays), produce a flat list of `{ path, value }` pairs using
  dot/bracket-path keys (e.g. `items[0].productName`).
- Render each audit entry's detail as a table: **Field | Before | After**,
  one row per flattened path found in either snapshot. For a `create`
  entry (`before === null`), the Before column is blank for every row.
- Highlight rows where Before ≠ After (e.g. background tint or bold) so
  changes are still easy to spot even though nothing is hidden.
- Format money-looking fields (keys containing `price`, `amount`,
  `balance`, `paid`, `due`, `cost`) through `formatMoney()`. Format
  date-looking fields (keys containing `date`, `At`) as a locale string.
  Everything else renders as-is (stringified).

**Affected areas:** `frontend/src/pages/AuditLog.jsx`, new
`frontend/src/lib/flattenObject.js`. No backend changes — `before`/`after`
snapshots already contain everything needed.

**Testing/validation:** `npm run build` clean. Manual check recommended
against a few real audit entries of different action types once merged
(sandbox has no live Mongo to generate real entries against).

**Completion criteria:** Audit Log detail view shows a Field/Before/After
table for every entry, no raw JSON visible anywhere on the page.

---

## Stage 4 — PDF export alongside CSV

**Goal:** add a PDF download option next to each of the 5 existing CSV
export buttons.

**Issues addressed:** `routes/export.js` only produces CSV
(`sales`, `refunds`, `customer-credit`, `supplier-payables`, `summary`).
Hassan wants PDF too, for all 5, as a separate button alongside the
existing CSV button — not replacing it.

**Implementation tasks:**
- Add `pdfkit` as a new backend dependency.
- Add a `POST`/`GET` PDF variant for each of the 5 existing export
  routes (or a `format` query param on the existing routes — implementer's
  choice, whichever keeps `routes/export.js` cleanest), producing a
  formatted table: report title, date range (where applicable), column
  headers, and rows — not a raw data dump.
- `frontend/src/pages/Reports.jsx`: add a second "PDF" button next to each
  existing "CSV" button for all 5 report types.

**Affected areas:** `routes/export.js`, `package.json` (new dependency),
`frontend/src/pages/Reports.jsx`.

**Testing/validation:** boot test — hit each of the 5 PDF endpoints,
confirm a valid PDF is returned (`file` command / header check is enough
given no live Mongo for real data — confirm the route at least generates
a structurally valid empty-data PDF without throwing); `npm run build`.

**Completion criteria:** all 5 reports have a working PDF button
alongside their CSV button.

---

## Stage 5 — Toast & confirm-dialog infrastructure

**Goal:** build the reusable components that Stage 6 will migrate all
`alert()`/`confirm()` call sites onto. No call sites are touched in this
stage.

**Issues addressed:** the app uses browser-native `alert()`/`confirm()`
throughout (64 call sites across 6 files) — jarring, blocks the whole
page, not stylable.

**Implementation tasks:**
- Add `sonner` as a new frontend dependency for toast notifications; wire
  up its provider once at the app root.
- Build a hand-rolled `ConfirmDialog` component (new file, e.g.
  `frontend/src/components/ConfirmDialog.jsx`) for yes/no confirmations,
  reusing the existing fixed-modal Tailwind pattern already used
  elsewhere in the app (e.g. the Add Customer popup) for visual
  consistency. Expose it via a simple hook/context (e.g. `useConfirm()`
  returning a promise) so call sites can do
  `if (await confirm('Delete this?')) { ... }` instead of
  `if (window.confirm('Delete this?')) { ... }`.

**Affected areas:** new `frontend/src/components/ConfirmDialog.jsx` (or
similar), a toast provider wired into the app root (likely `App.jsx` or
`main.jsx`), `package.json` (new dependency). No page files touched yet.

**Testing/validation:** `npm run build` clean. A minimal manual smoke
test of both components (e.g. temporarily wire one into a single button)
is reasonable to prove they render, then removed before calling this
stage done — the real wiring is Stage 6.

**Completion criteria:** both components exist, build clean, ready for
Stage 6 to consume.

---

## Stage 6 — Migrate all alert()/confirm() call sites

**Depends on Stage 5.**

**Goal:** replace all 64 `alert()`/`confirm()` calls across the app with
the Stage 5 components.

**Issues addressed:** see Stage 5.

**Implementation tasks:**
- Replace every `alert()` call with a `sonner` toast (success/error
  styled appropriately based on context).
- Replace every `confirm()` call with the Stage 5 `ConfirmDialog`/
  `useConfirm()`.
- Files affected (call-site counts as of this plan, re-verify at start of
  stage since the repo may have moved on): `Billing.jsx` (23),
  `Orders.jsx` (11), `Suppliers.jsx` (9), `Customers.jsx` (8),
  `Users.jsx` (8), `Products.jsx` (5, plus any new ones this plan's other
  Products-page stages introduce).

**Affected areas:** `frontend/src/pages/Billing.jsx`, `Orders.jsx`,
`Suppliers.jsx`, `Customers.jsx`, `Users.jsx`, `Products.jsx`. No backend
changes.

**Testing/validation:** `npm run build` clean; grep for `alert(`/
`confirm(` across `frontend/src/pages/` to confirm zero remaining
call sites (excluding any intentionally left `window.confirm` if a case
is found where it's genuinely appropriate — flag any such case rather
than silently leaving it).

**Completion criteria:** zero `alert()`/`confirm()` calls remain in
`frontend/src/pages/`; all replaced with the Stage 5 components.

---

## Stage 7 — Add Product: required cost, real StockBatch (self-buying only)

**Depends on:** none directly, but sets the pattern Stage 9 extends.

**Goal:** close the gap where a product added via Add Product has no
cost basis at all until a separate supplier purchase is recorded against
it.

**Issues addressed:** `models/StockBatch.js`'s existing Stage-22 design
intentionally leaves plain Product-form stock additions un-batched (no
cost input existed on that form). Hassan wants Add Product to always
capture a real cost and be properly FIFO/profit-tracked from day one —
not just record a `buyingPriceHistory` entry with no batch backing it.

**Implementation tasks:**
- Add a **required** Cost field to the Add Product form
  (`frontend/src/pages/Products.jsx`, `mode === 'add'` only — Edit is
  unaffected).
- `POST /api/product` (create path): route the submitted cost through the
  same batch-creation logic `POST /supplier/purchase` already uses for a
  self-purchase (`NoSupplier`) — i.e. Add Product's cost entry always
  creates a `NoSupplier`-tagged `StockBatch`, never a real-supplier one.
  There is intentionally no supplier picker on this form (see Stage 9's
  "self-buying only" rule, which this stage establishes for Add Product
  specifically).
- Update `lib/costing.js`/`StockBatch` model comments if this changes the
  documented Stage-22 invariant about plain-form additions never being
  batched — this stage supersedes that specific note for the Add Product
  path only (Update Product still has no stock field after Stage 9, so
  there's nothing left there to reconcile).

**Affected areas:** `routes/products.js`, `frontend/src/pages/Products.jsx`,
possibly `routes/suppliers.js` if the self-purchase batch-creation logic
needs extracting into a shared helper rather than duplicating it.
`models/StockBatch.js` / `lib/costing.js` comments if the Stage-22 note
needs updating.

**Testing/validation:** boot test — create a product with a cost, confirm
a `StockBatch` exists for it tagged `NoSupplier`; `npm test`; `npm run
build`.

**Completion criteria:** every product created via Add Product has a real
cost basis and a matching `StockBatch` from the moment it's created.

---

## Stage 8 — Billing: show last-purchased cost (admin-only)

**Goal:** show a product's last-purchased cost next to its selling price
when adding it to a bill, visible to admins only.

**Issues addressed:** cashiers/admins currently have no visibility into
cost while deciding whether a discount makes sense on that line.
`lib/pricing.js`'s `getLatestBuyingPrice()` already exists and
`GET /api/products` already returns `costPrice` per product — this data
already reaches the frontend, it's just never displayed.

**Implementation tasks:**
- In `frontend/src/pages/Billing.jsx`'s `handleSelectProduct` / item-entry
  form, display the selected product's `costPrice` next to its selling
  price.
- Gate this display to admin role only (the app's existing `isAdmin`
  pattern, same as elsewhere).

**Affected areas:** `frontend/src/pages/Billing.jsx` only. No backend
changes — the data already exists in the API response.

**Testing/validation:** `npm run build` clean.

**Completion criteria:** cost shows next to selling price when a product
is selected on Billing, visible only when logged in as admin.

---

## Stage 9 — Product stock management redesign (add/deduct, reason-coded)

**Depends on Stage 7** (establishes the self-buying-only batch-creation
pattern this stage extends to a second, dedicated flow).

**Goal:** replace the current silent, reason-less stock editing with
three clearly separated actions — a name/price-only Update form, a
dedicated Add Stock action, and a dedicated Deduct Stock action — plus
require a real supplier on Supplier Purchase (remove self-buying from
there, since it now lives on the two new Products-page actions instead).

**Issues addressed:** today, Update Product's stock field can only ever
*add* to quantity, with no cost captured and no `StockBatch` created;
there is no way to deduct/write off stock at all, so no reason is ever
captured for shrinkage, damage, expiry, or supplier returns; Supplier
Purchase's dropdown currently offers a `NoSupplier`/self-buying option
that Hassan wants moved out of that flow entirely.

**Implementation tasks:**
- **Update Product form**: trim to **name and price only**. Remove the
  stock/quantity field entirely from this form and its submit handler.
- **New "Add Stock" action** (dedicated button/form on the Products page,
  separate from Update Product): requires cost, self-buying only (same
  `NoSupplier`-tagged `StockBatch` pattern Stage 7 established for Add
  Product) — no supplier picker here at all.
- **New "Deduct Stock" action** (dedicated button/form on the Products
  page): opens a reason form —
  - Fixed reason categories: Expired / Returned to Supplier /
    Damaged-Lost / Discontinued, each with a required free-text note.
  - If reason is **Returned to Supplier**: adjust that supplier's credit
    balance to reflect cost recovered; **no Loss entry is created** in
    this case (cost was recovered, not written off).
  - If reason is anything else (Expired / Damaged-Lost / Discontinued):
    record a **Loss** entry — a new small model/collection (or an
    extension of an existing one, implementer's judgment during
    implementation) capturing product, quantity, cost value, reason,
    note, actor, timestamp. Surface this as a new "Losses" figure on the
    Dashboard and as a line item in Reports (new export type or folded
    into an existing one — flag if this needs a 6th CSV/PDF export type,
    which would be a small addition to Stage 4's work if that stage is
    already done, or scoped into this stage if not).
- **Zero-stock auto-disable**: whenever a product's `quantity` reaches
  zero (via any path — sale, deduction, etc.), mark it disabled. Disabled
  products remain visible in the Products list (grayed out,
  non-interactive) and remain fully intact in historical order data, but
  cannot be selected for billing, refund, or exchange going forward.
- **Auto-restore on restock**: adding stock to a disabled product (via
  the new Add Stock action) automatically re-enables it. No separate
  restore button.
- **Hard delete** (existing `DELETE /product/:productID`, admin-only):
  becomes reachable only once a product's stock is fully accounted for
  (zero remaining, via the Deduct Stock reason flow above for any
  residual quantity). Opens the same reason form as Deduct Stock. Once
  confirmed, performs a true, permanent removal from the database — this
  is genuinely destructive and only reachable via this explicit,
  reason-logged path.
- **Supplier Purchase form** (`frontend/src/pages/Suppliers.jsx` /
  `routes/suppliers.js`): remove the `NoSupplier`/"Buy Myself / Self
  Purchased" option from the supplier dropdown. This form now requires
  selecting a real, existing supplier.

**Affected areas:** `routes/products.js`, `frontend/src/pages/Products.jsx`,
`routes/suppliers.js`, `frontend/src/pages/Suppliers.jsx`,
`models/Product.js` (disabled flag), possibly a new `models/Loss.js` (or
similar), `frontend/src/pages/Dashboard.jsx` (Losses figure),
`lib/reports.js` (Losses in reports, if folded into an existing report
rather than a new export type).

**Testing/validation:** boot test covering: create product → deduct all
stock with reason "Damaged-Lost" → confirm disabled + Loss entry created;
restock same product → confirm re-enabled; deduct with reason "Returned
to Supplier" → confirm supplier credit adjusted, no Loss entry; hard
delete a zero-stock product → confirm permanent removal; attempt hard
delete on a product with remaining stock → confirm blocked. `npm test`;
`npm run build`.

**Completion criteria:** all of the above flows work as described; no
plain quantity field exists anywhere that bypasses the reason
requirement; Supplier Purchase no longer offers self-buying.

**Note:** this is the largest stage in this plan. If it proves too large
once implementation starts, flag it and we'll split it (e.g. Add Stock +
Deduct Stock as one stage, Loss/Dashboard/Reports surfacing as a second,
hard-delete rework as a third) rather than pushing through oversized.

---

## Stage 10 — UI polish: Products form, Billing preview

**Goal:** fix the two concrete visual issues Hassan flagged from
screenshots — Products' form color/height, Billing's cramped preview
table. Customers/Suppliers pages need no change (already confirmed good).

**Issues addressed:**
- Products' Add/Update form header and submit button use
  `text-green-600`/`bg-green-600`, inconsistent with the blue
  (`text-blue-600`) used for the same "Add" state on Customers and
  Suppliers.
- Products' Add/Update form is a single stacked column of 7+ fields
  inside a `1/3`-width sidebar, tall enough to force an internal scroll.
- Billing's on-screen cart/bill preview renders an 8-column table
  (`#`, Code, Product, Price, Qty, Total, Save, Net) inside a `max-w-md`
  panel, causing horizontal overflow and overlapping text.

**Implementation tasks:**
- `frontend/src/pages/Products.jsx`: change `text-green-600`/
  `bg-green-600` to the blue used elsewhere for Add mode.
- `frontend/src/pages/Products.jsx`: restructure the Add/Update form into
  a 2-column grid within the existing sidebar panel (stays a sidebar
  panel, not a modal) to reduce vertical height. Field pairing is
  implementer's judgment (e.g. Category+Selling Price, Stock+Threshold —
  noting Stage 9 removes Stock from this form, so re-derive sensible
  pairings against the post-Stage-9 field list).
- `frontend/src/pages/Billing.jsx`: replace the 8-column on-screen
  cart/bill preview table with a stacked receipt-line layout — each item
  becomes two lines (e.g. `#1  #0001  PowerSocket` then
  `1 × Rs 500.00   -0%   = Rs 500.00`) instead of one row across 8
  columns, so it fits the panel width without horizontal scroll. Only the
  **on-screen** preview changes — the printed receipt and the Special
  Bill layout are explicitly out of scope for this stage.

**Affected areas:** `frontend/src/pages/Products.jsx`,
`frontend/src/pages/Billing.jsx` (on-screen cart summary only, not
`printReceiptFor` or the Special Bill markup).

**Testing/validation:** `npm run build` clean.

**Completion criteria:** Products' Add/Update form uses blue consistently
and fits without an internal scrollbar in normal use; Billing's on-screen
preview shows items as stacked lines with no horizontal overflow.

---

## Stage 11 — Bill preview: customer balance

**Goal:** show the selected customer's pre-sale balance in the bill
preview.

**Issues addressed:** the bill preview shows store credit available but
not the customer's outstanding balance owed (or vice versa) from before
this sale — Hassan wants this visible so it can be discussed with the
customer at time of billing.

**Implementation tasks:**
- `GET /api/customers` already returns `totalBalanceDue` per customer;
  `frontend/src/pages/Billing.jsx`'s `customerDirectory` currently only
  pulls in `creditBalance` — add `totalBalanceDue` to what's stored per
  customer.
- Display a single "Customer Balance" line (positive = owes, negative =
  in credit) reflecting the customer's balance **before this sale** (not
  mixed with the bill currently being built) — placed **after** all
  calculation fields (Grand Total, Paid, Change/Balance Due), at the
  bottom of the preview.

**Affected areas:** `frontend/src/pages/Billing.jsx` only. No backend
changes — the data already exists in the API response.

**Testing/validation:** `npm run build` clean.

**Completion criteria:** customer's pre-sale balance is visible at the
bottom of the bill preview whenever a customer (not walk-in) is selected.

---

## Deferred — not yet scoped

These were raised in Hassan's original notes but not yet discussed in
enough detail to plan. **Do not start these.** They'll be appended as
their own numbered stage(s) once Hassan provides the flow — do not
renumber the stages above when that happens, just append.

- **Exchange process improvements** — "exchange process should be
  better." No specifics gathered yet.
- **Offline management overhaul** — tracking every entry while offline
  (product quantity, customer records, exchanges, refunds) with an
  "offline" marker, syncing to the database once back online, visible
  across screens as reconciled once synced, persisting up to ~72 hours.
  Storage approach undecided between Hassan's two suggestions (Excel-file
  based vs. Redux Toolkit state) — and needs to be reconciled against the
  existing `lib/offlineSync.js` / `OfflineSale` system already in the
  codebase (built in the original feature-development phase) rather than
  assumed to be a from-scratch build. Also covers: "where is offline data
  saved on-device?" (this part may just be a question to answer from the
  existing code once we get here, not necessarily a fix).
- **Dashboard offline-billing visibility** — offline sales should show up
  in the dashboard as identifiable "offline billing" entries, for
  persistence/efficiency tracking. Likely resolved together with the item
  above once that flow is settled.

## Already covered, no work needed

- **Admin-only version** — reviewed against the existing codebase:
  Workers tab is already hidden from non-admins (`Sidebar.jsx`'s
  `adminOnlyLinks`), `/workers` is already guarded by `AdminRoute.jsx`
  client-side, and every `/api/users` route already requires
  `requireAuth + requireAdmin` server-side. Hassan confirmed this already
  satisfies the original ask. No stage needed.
