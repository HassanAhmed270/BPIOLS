# CLAUDE.md — BPIOLS Final Fixes

The `production.md` phase (Stage 1–8) is complete and merged. This repo
is now in a separate **final-fixes phase**, defined by `final.md`. The
app remains feature-complete; current work is further correctness/UX/
workflow fixes identified after production-hardening closed.

## Document authority

- `final.md` — authoritative plan. `CLAUDE.md` — architecture/working
  rules. `final-progress.md` — append-only log for this phase.
- `production.md` / `production-progress.md` — previous phase's plan/log,
  complete and historical; do not use its Stage numbering here.
- `progress.md` — original feature-build's historical log; also not this
  phase's numbering.

Final-fixes stages start at **Stage 1** and follow `final.md` only (three
independent stage-numbering sequences exist in this repo: this phase,
`production.md`, and the original build).

## Start every task by syncing

1. Clone `https://github.com/HassanAhmed270/BPIOLS.git`, or
   `git fetch origin main && git reset --hard origin/main` if already
   cloned this session. Never trust an earlier session's clone.
2. Read `final.md`, this `CLAUDE.md`, and `final-progress.md` (if it
   exists) in full.
3. Identify the next incomplete `final.md` stage and work only on it.

## Scope rules

- Work one `final.md` stage at a time, in order — several stages depend
  on earlier ones (noted per stage in `final.md`; e.g. Stage 6 depends on
  5, Stage 9 on 7, Stage 13 on 12).
- Touch only the stage's listed **Affected areas**. If proper completion
  needs an out-of-scope change, stop and flag it — a small, clearly-
  necessary addition a stage's own task list implies may proceed but must
  be called out in `final-progress.md`.
- An unrelated one-line, obviously-correct fix may be made inline, stated
  as incidental. Otherwise flag unrelated issues instead of fixing them.
- Do not refactor or "improve while you're here."
- If a stage becomes too large, flag it and split rather than push
  through oversized. Stage 9 did this: **9a** (Add/Deduct Stock,
  zero-stock auto-disable), **9b** (Loss on Dashboard/Reports), **9c**
  (hard-delete rework) — all three now done.
- `final.md`'s "Deferred" section is currently empty — all originally-
  deferred items are now scoped as Stages 12–14. Newly raised items go
  there first, then get promoted to a numbered stage.

## Existing conventions

Check for an existing helper before creating new logic.

- Money: `lib/money.js` → `roundMoney()`; frontend mirror at
  `frontend/src/lib/money.js` → `roundMoney()` / `formatMoney()`.
  `formatMoney()` outputs PKR as of Stage 1 (`Rs 1,234.50`, comma
  thousands-grouping, `-Rs X.XX` for negatives) — see `final-progress.md`.
- Prices: `lib/pricing.js` (`getLatestSellingPrice`/`getLatestBuyingPrice`).
- Validation: `lib/validators.js`.
- Pagination/sorting: `lib/query.js`.
- Errors: `lib/errors.js` → `AppError` + `asyncHandler`.
- Audit logging: `lib/auditLog.js` → `logAudit()`.
- FIFO costing: `lib/costing.js` (`createBatch`, `consumeFIFO`,
  `restoreConsumption`, `generateUniquePurchaseId` — shared by
  `routes/suppliers.js` and `routes/products.js`'s create path as of
  Stage 7), `models/StockBatch.js`.
- Sequential ID generation: `models/Counter.js` (added Stage 2) — a
  generic `{ _id, seq }` doc per counter key, incremented atomically via
  `findOneAndUpdate($inc)`. `routes/products.js`'s `nextProductId()` is
  the first consumer; reuse this model rather than adding another
  ad-hoc counter if a later stage needs one (e.g. Order IDs).
- Frontend API calls: `frontend/src/lib/api.js`.
- Toasts/confirms (Stage 5, migrated Stage 6): `sonner`'s `<Toaster>`
  mounted in `App.jsx`, use `toast()`/`.success()`/`.error()`;
  `frontend/src/components/ConfirmDialog.jsx` exports `ConfirmProvider`
  (mounted in `App.jsx`) and `useConfirm()` — `if (await confirm('Delete
  this?')) { ... }`. Zero `alert()`/`confirm()` remain in `pages/`.

When inside an existing MongoDB transaction, pass its session to helpers
that support sessions.

### Code style

No comments, no extra blank-line padding, in new code and in any existing
function/file directly touched for a fix (strip comments there too). Do
not separately strip comments from files a stage doesn't otherwise touch.

## Verification

- Backend change: boot-test before calling it done — install deps, start
  the server with a real `.env`, hit relevant routes with `curl`, all in
  one shell/tool call. No live MongoDB replica set exists in the sandbox,
  so boot tests confirm the route mounts and pre-DB validation/auth logic
  behaves correctly, not full end-to-end behavior against real data.
- Frontend change: `npm run build` (Vite) before calling it done.
- `npm test` before calling any stage done — a stage that breaks an
  existing test is not complete.
- Clean up test artifacts (`node_modules`, `.env`, `dist/`, logs) before
  packaging deliverables.
- No push credentials exist for this repo — never claim a change is
  pushed/live on GitHub; it isn't until Hassan merges it.

## End-of-stage requirements

A stage is not complete until: `final-progress.md` is appended; `CLAUDE.md`
is updated if architecture/conventions changed; both docs are delivered;
code is packaged (`git bundle create output.bundle main`, or a `.patch`
file) with exact pull/merge commands; verified vs. unverified items are
stated plainly.

Do not begin the next stage until the current stage is complete.

## Project architecture

BPIOLS is a single-shop MERN POS/billing system intended for one desktop.

- Backend: Express + Mongoose at repository root, entry point `main.js`.
- All domain routes live under `routes/`: `auth.js`, `export.js`,
  `sync.js`, `products.js`, `customers.js`, `billing.js` (incl.
  `orderDetails` checkout), `suppliers.js` (incl. `supplier/purchase`),
  `orders.js` (incl. edit/refund, `recomputeOrderTotals`/
  `applyLineReduction`, `GET /dashboard/load`), `audit.js`, `users.js`
  (`/api/users*`, admin account mgmt plus self-service
  `/api/users/me/password`). Each mounts at `app.use('/', ...)` since
  routes keep their original full paths. `main.js` itself only does app
  setup, DB connection, middleware, route mounting, static frontend
  serving, the error handler, and the draft-sweep interval.
- Frontend: React + Vite + Tailwind under `frontend/`. Pages: `Billing.jsx`,
  `Products.jsx`, `Customers.jsx`, `Suppliers.jsx`, `Orders.jsx`,
  `Reports.jsx`, `Dashboard.jsx`, `AuditLog.jsx`, `Users.jsx`, `Login.jsx`.
  `sonner` (toasts) and a hand-rolled `ConfirmDialog` are the only UI
  libs/components beyond Tailwind (Stage 5) — see "Existing conventions".
- Production backend serves `frontend/dist`.
- MongoDB **must run as a replica set** because checkout and other
  inventory mutations use multi-document transactions.
- `.env` is required; `JWT_SECRET` is required for boot and the server
  refuses to boot if it still matches the placeholder in `.env.example`
  (checked in `middleware/auth.js`).
- `User.passwordChangedAt` is embedded into every issued JWT (`pwdTs`
  claim). `requireAuth` re-reads it from the DB on every request and
  rejects the token if it's older than the current value — a password
  change invalidates all previously issued tokens. Any code path that
  changes a password must refresh `passwordChangedAt`.

Core models: `Product`, `Customer`, `Order`, `Supplier`, `Refund`,
`PendingBill`, `OfflineSale`, `AuditLog`, `StockBatch`, `User`,
`Counter` (Stage 2), `Loss` (Stage 9).

Important invariants (check `final.md`/`final-progress.md` for the
current state of any item flagged as changing under a specific stage):
- Product/order business IDs use `#0000`-style identifiers, distinct
  from Mongo `_id`. Add Product generates `#000N` server-side via
  `nextProductId()`/`models/Counter.js` (deleted IDs never reissued).
- Product prices are history arrays; read them through `lib/pricing.js`.
- Stock availability accounts for `reserved`.
- Checkout uses persisted `PendingBill` data and server-side price/
  discount verification. Walk-in sales use the `Walk-in / Unknown`
  sentinel and remain real audited orders without a customer credit
  record.
- `Product.supplierID` is an optional `Supplier` ObjectId; `NoSupplier`
  is the self-purchase sentinel. Stage 9a removed it as a selectable
  option on Supplier Purchase (`POST /supplier/purchase` now always
  requires a real supplier) — self-purchase now lives only on Add Stock.
- Restocking/checkout use transactions; FIFO costing via `StockBatch`/
  `lib/costing.js`. Stage 7 made Cost required on Add Product's create
  path. Stage 9a: Update Product has no stock field (name/price/
  category/supplier/threshold only); restocking goes through **Add
  Stock** (`POST /api/product/:productID/add-stock`, admin-only,
  cost+quantity, always self-buying/`NoSupplier`). **Deduct Stock**
  (`.../deduct-stock`) removes stock with a required reason
  (`expired`/`returned_to_supplier`/`damaged_lost`/`discontinued`) +
  note, drawing down FIFO batches via `consumeFIFO()`. `returned_to_
  supplier` credits the chosen supplier's `creditBalance`, no `Loss`;
  every other reason writes one `Loss` doc. The dead `POST
  /billing/update` was removed here (unreachable from any frontend call).
- **Zero-stock auto-disable** (Stage 9a): `lib/costing.js`'s
  `disableIfDepleted()` sets `Product.disabled` true the instant
  `quantity` hits 0 — called after checkout, offline sync, and Deduct
  Stock decrements. Only Add Stock clears it. Disabled products stay
  visible (greyed out) but `POST /billing/reserve` won't reserve one.
- **Hard delete** (Stage 9c): `DELETE /product/:productID` requires
  `{reason, note}` (same set as Deduct Stock), 400s if `quantity > 0`
  (deduct remaining stock first); reason/note is an audit annotation
  only — no Loss/credit side effects fire here.
- **UI polish** (Stage 10): Products form matches Customers.jsx's color
  convention (blue=Add, yellow=Update), 2-column grid. Billing's
  on-screen cart preview (not `printReceiptFor`/Special Bill) is
  stacked receipt-lines. Stage 11 added a "Customer Balance" line
  (`totalBalanceDue - creditBalance`, pre-sale) at its bottom.
- Audit records are written through `logAudit()`. CSV export and offline
  sync are optional feature-flagged modules. Stage 3 replaced
  `AuditLog.jsx`'s raw JSON dump with a flattened table
  (`lib/flattenObject.js`). Stage 4 added `?format=pdf` to every
  `routes/export.js` route (default CSV) via a shared `sendReport()` →
  `lib/pdf.js`'s `sendTablePDF()` (`pdfkit`), reusing each route's
  `{ key, label }` columns. Stage 9b added a 6th route,
  `/api/export/losses`. `Reports.jsx`'s `EXPORTS` array drives the cards
  generically; `api.js`'s `downloadExport()` takes a `format` arg.
- Indexed fields: `Order.orderDate`, `Order.customerName`,
  `Product.category`. `Supplier.supplierName` relies on `unique: true`.- Customer store credit: `Customer.creditBalance` mirrors
  `Supplier.creditBalance` — money owed to the customer from a past
  refund/edit-down settled as credit. An **edit** always settles freed-up
  overpayment as credit; a **refund** takes an explicit
  `settlement: 'cash'|'credit'` (default `'cash'`).
  `POST /billing/orderDetails` auto-applies existing credit against a new
  order's total before computing `amountPaid`/`balanceDue`, mirroring the
  supplier-credit auto-apply in `POST /supplier/purchase`.
  `Order.creditApplied`, `Customer.orders[].creditApplied`/
  `creditGenerated`, `Order.editHistory[].settlement`/`creditAmount`, and
  `Refund.settlement`/`creditGenerated` carry this at each level.
  `recomputeOrderTotals` returns the settlement amount freed up rather
  than letting it vanish behind `balanceDue`'s clamp-to-zero. Stage 9a
  adds a second, distinct credit path — Deduct Stock's
  `returned_to_supplier` reason adjusts *supplier* credit, not customer —
  keep the two separate.
- User management: `routes/users.js` covers admin create/delete/
  reset-password (`/api/users*`) and self-service password change
  (`/api/users/me/password`, any role); every password write refreshes
  `passwordChangedAt`. Deleting your own account or the last admin is
  blocked. `Users.jsx` at `/workers` (admin-only, `AdminRoute`) is the
  only UI surface; this gating was reviewed and confirmed sufficient.
- Offline sync: `lib/offlineSync.js`'s `syncOfflineSale()` mirrors
  `routes/billing.js`'s `isWalkIn` skip for `WALKIN_CUSTOMER` and its
  zero-stock auto-disable (Stage 9a's `disableIfDepleted()`) — keep in
  sync if either changes. Does not apply customer credit. `final.md`
  Stages 12–13 (pending) add offline-queue UX only, not commit logic.
- `POST /product/undo` validates `productId` with `isValidProductId()`
  the same way `POST /api/product`'s update path does.
- `loginLimiter` (`middleware/rateLimit.js`): `max: 20`/15min,
  `skipSuccessfulRequests: true` — tuned for a single shared shop IP.
- `lib/reports.js`'s `getDashboardSummary` derives `refundedOrders`/
  `refundedAmount` from one `Refund.aggregate` scoped by `refundDate`.

## Request flow

`/auth/*` → `routes/auth.js`. `/api/export/*`/`/api/sync/*` → optional
feature-flagged modules. Other `/api`, `/billing`, `/product`,
`/customer`, `/supplier`, `/dashboard/load` → domain route files. Other
GET → built React SPA. Unmatched `/api/*`/`/auth/*` → JSON 404.

Backend authorization is the real security boundary; frontend admin
gating is UX only.

## Working principles

Preserve existing behavior unless the current `final.md` stage explicitly
requires changing it. Do not add features simply because they appear
useful. When a change conflicts with historical assumptions, follow the
current repository plus `final.md`, then document it in
`final-progress.md`.
