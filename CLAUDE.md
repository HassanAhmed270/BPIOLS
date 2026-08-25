# CLAUDE.md — BPIOLS Final Fixes

The `production.md` phase (Stage 1–8) is complete and merged. This
repository is now in a new, separate **final-fixes phase**, defined by
`final.md`. The MERN billing/POS application remains feature-complete;
current work is a further round of correctness, UX, and workflow fixes
Hassan identified after the production-hardening phase closed.

## Document authority

- `final.md` is the authoritative plan for this phase.
- `CLAUDE.md` (this file) contains current architecture and working
  rules.
- `final-progress.md` is the append-only log for this phase.
- `production.md` / `production-progress.md` are the previous phase's
  plan and log — complete, historical, do not use their Stage numbering
  here.
- `progress.md` is the original feature-build's historical log — also
  not this phase's numbering.

Final-fixes stages start at **Stage 1** and follow `final.md` only. Do
not confuse this numbering with `production.md`'s Stage 1–8 or the
original build's stage numbering — three completely independent
sequences exist in this repo's history.

## Start every task by syncing

Before planning or changing code:

1. Clone `https://github.com/HassanAhmed270/BPIOLS.git` into a scratch
   directory, or, if already cloned in this session:
   `git fetch origin main && git reset --hard origin/main`
2. Read `final.md` in full.
3. Read this `CLAUDE.md`.
4. Read `final-progress.md` in full if it exists.
5. Identify the next incomplete `final.md` stage and work only on it.

Never trust a local clone from an earlier session. The repository may
have changed since the previous task.

## Scope rules

- Work one `final.md` stage at a time and in `final.md` order — several
  stages have real dependencies on earlier ones (noted per stage in
  `final.md`; e.g. Stage 6 depends on Stage 5, Stage 9 depends on
  Stage 7).
- Touch only the stage's listed **Affected areas**.
- If proper completion requires an out-of-scope change, stop and flag it.
- An unrelated one-line, obviously-correct fix may be made inline, but
  state that it was incidental. Otherwise flag unrelated issues instead.
- Do not refactor or "improve while you're here."
- Prefer small, reversible commits. If a stage becomes too large (Stage 9
  is flagged in `final.md` itself as the likeliest candidate), flag it
  and split rather than push through oversized.
- `final.md`'s "Deferred — not yet scoped" section lists items Hassan
  raised but hasn't specified yet (Exchange process improvements, the
  offline-management overhaul, dashboard offline-billing visibility). Do
  not start these. They'll be appended as new stage(s) once Hassan
  provides the flow — do not renumber the existing 11 stages when that
  happens.

## Existing conventions

Check for an existing helper before creating new logic.

- Money: `lib/money.js` → `roundMoney()`; frontend mirror at
  `frontend/src/lib/money.js` → `roundMoney()` / `formatMoney()` (Stage 1
  of this phase changes `formatMoney()`'s output format — see `final.md`).
- Prices: `lib/pricing.js` (`getLatestSellingPrice`/`getLatestBuyingPrice`).
- Validation: `lib/validators.js`.
- Pagination/sorting: `lib/query.js`.
- Errors: `lib/errors.js` → `AppError` + `asyncHandler`.
- Audit logging: `lib/auditLog.js` → `logAudit()`.
- FIFO costing: `lib/costing.js`, `models/StockBatch.js`.
- Frontend API calls: `frontend/src/lib/api.js`.

When inside an existing MongoDB transaction, pass its session to helpers
that support sessions.

### Code style

No comments, no extra blank-line padding, in new code and in any existing
function/file directly touched for a fix (strip comments there too). Do
not do a separate dedicated pass to strip comments from files a stage
doesn't otherwise need to touch.

## Verification

- Every backend change: boot-test before calling it done — install deps,
  start the server with a real `.env`, hit the relevant routes with
  `curl`, all within one shell/tool call (background processes don't
  persist across separate calls in this environment). No live MongoDB
  replica set exists in the sandbox — routes requiring a DB write will
  fail past the auth/validation layer; boot tests here confirm the route
  mounts and loads without throwing and that pre-DB validation/auth logic
  behaves correctly, not full end-to-end behavior against real data.
- Every frontend change: `npm run build` (Vite) before calling it done.
- `npm test` before calling any stage done — a stage that breaks an
  existing test is not complete.
- Clean up test artifacts (`node_modules`, `.env`, `dist/`, log files)
  after verifying, before packaging deliverables.
- No push credentials exist for this repo. Never claim to have pushed or
  imply a change is live on GitHub — it isn't until Hassan merges it
  himself.

## End-of-stage requirements

A stage is not complete until:

1. `final-progress.md` is appended with: changes made; verification
   performed; open/known limitations.
2. `CLAUDE.md` is updated if architecture, routing, conventions, or other
   context here changed.
3. The updated documentation files are delivered.
4. Code changes are packaged, preferably:
   `git bundle create output.bundle main`
   or, if necessary, a `.patch` file.
5. Exact commands for pulling/merging the changes are provided.
6. Verified and unverified items are stated plainly.

Do not begin the next stage until the current stage is complete.

## Project architecture

BPIOLS is a single-shop MERN POS/billing system intended for one desktop.

- Backend: Express + Mongoose at repository root, entry point `main.js`.
- All domain routes live under `routes/`: `auth.js`, `export.js`,
  `sync.js`, `products.js`, `customers.js`, `billing.js` (incl.
  `orderDetails` checkout), `suppliers.js` (incl. `supplier/purchase`),
  `orders.js` (incl. edit/refund, `recomputeOrderTotals`/
  `applyLineReduction`, and `GET /dashboard/load`), `audit.js`, and
  `users.js` (`/api/users*`, admin-only account management plus the
  self-service `/api/users/me/password`). Each mounts at
  `app.use('/', ...)` since routes keep their original full paths rather
  than one prefix per file. `main.js` itself only does app setup, DB
  connection, middleware, route mounting, static frontend serving, the
  error handler, and the draft-sweep interval.
- Frontend: React + Vite + Tailwind under `frontend/`. Current pages:
  `Billing.jsx`, `Products.jsx`, `Customers.jsx`, `Suppliers.jsx`,
  `Orders.jsx`, `Reports.jsx`, `Dashboard.jsx`, `AuditLog.jsx`,
  `Users.jsx`, `Login.jsx`. No UI component libraries beyond Tailwind are
  installed as of the start of this phase — `final.md` Stage 5 adds the
  first one (`sonner`, for toasts).
- Production backend serves `frontend/dist`.
- MongoDB **must run as a replica set** because checkout and other
  inventory mutations use multi-document transactions.
- `.env` is required; `JWT_SECRET` is required for boot, and the server
  also refuses to boot if `JWT_SECRET` still matches the placeholder
  value shipped in `.env.example` (checked in `middleware/auth.js`).
- `User.passwordChangedAt` is embedded into every issued JWT (`pwdTs`
  claim). `requireAuth` re-reads the user's current `passwordChangedAt`
  from the DB on every request and rejects the token if it's older than
  the current value — so a password change invalidates all previously
  issued tokens for that account. Any code path that changes a user's
  password must update `passwordChangedAt` to a fresh `Date` for this to
  take effect.

Core models include `Product`, `Customer`, `Order`, `Supplier`, `Refund`,
`PendingBill`, `OfflineSale`, `AuditLog`, `StockBatch`, and `User`.
`final.md` Stage 9 adds a new Loss-tracking model/collection (exact shape
left to implementation).

Important invariants (as of the start of this phase — several are
expected to change under specific `final.md` stages; check `final.md`
and `final-progress.md` for the current state of each before relying on
the description below):

- Product/order business IDs use `#0000`-style identifiers; do not
  confuse them with Mongo `_id`. **`final.md` Stage 2** makes Product IDs
  server-generated/sequential on create — no longer user-typed on Add.
- Product prices are history arrays; read them through `lib/pricing.js`.
- Stock availability accounts for `reserved`.
- Checkout uses persisted `PendingBill` data and server-side price/
  discount verification.
- Walk-in sales use the existing `Walk-in / Unknown` sentinel and remain
  real audited orders without a customer credit record.
- `Product.supplierID` is an optional `Supplier` ObjectId; `NoSupplier`
  is the self-purchase sentinel. **`final.md` Stage 9** removes
  `NoSupplier` as a selectable option on Supplier Purchase specifically —
  self-purchase still exists, but only via the new dedicated Add Stock /
  Add Product flows on the Products page, never through the Suppliers
  page.
- Restocking and checkout use transactions.
- FIFO stock costing is handled through `StockBatch` and `lib/costing.js`.
  Historically (pre-this-phase), plain Product-form stock additions were
  deliberately left un-batched (no cost input existed on that form).
  **`final.md` Stage 7** ends that exception for Add Product (cost
  becomes required, a real batch is created); **Stage 9** does the same
  for restocking an existing product via the new dedicated Add Stock
  action. After Stage 9, Update Product no longer has a stock field at
  all, so there is no remaining un-batched stock-addition path.
- Audit records are written through `logAudit()`.
- CSV export and offline sync are optional feature-flagged modules.
  `final.md` Stage 4 adds a PDF variant alongside each of the 5 existing
  CSV export types.
- Indexed fields: `Order.orderDate`, `Order.customerName`,
  `Product.category`. `Supplier.supplierName` relies on its existing
  `unique: true` index; no separate index was added.
- Customer store credit: `Customer.creditBalance` mirrors
  `Supplier.creditBalance` — a running total the customer is owed from a
  past refund/edit-down settled as credit rather than cash. An **edit**
  always settles any freed-up overpayment as credit (an edit is a
  correction/exchange, not a cash event); a **refund** takes an explicit
  `settlement: 'cash'|'credit'` choice in the request body, defaulting to
  `'cash'`. `POST /billing/orderDetails` auto-applies existing credit
  against a new order's total before computing `amountPaid`/`balanceDue`,
  mirroring the supplier-credit auto-apply in `POST /supplier/purchase`.
  `Order.creditApplied` records how much credit covered a given order;
  `Customer.orders[].creditApplied`/`creditGenerated` and
  `Order.editHistory[].settlement`/`creditAmount` and
  `Refund.settlement`/`creditGenerated` carry the same information at
  their respective levels. `recomputeOrderTotals` (`routes/orders.js`)
  returns the "settlement" amount it freed up, instead of letting an
  overpayment silently vanish behind `balanceDue`'s clamp-to-zero.
  `final.md` Stage 9 adds a second, distinct credit-adjustment path — a
  Deduct Stock action with reason "Returned to Supplier" adjusts
  *supplier* credit, not customer credit; keep these two mechanisms
  clearly separate.
- In-app user management: `routes/users.js` covers admin create/delete/
  reset-password (`/api/users*`) and self-service password change
  (`/api/users/me/password`, any role). Every password write sets
  `passwordChangedAt`, invalidating prior tokens via the mechanism above.
  Deleting your own account or the last remaining admin is blocked.
  Frontend: `Users.jsx` at `/workers` (admin-only, `AdminRoute`) is the
  only UI surface — there is currently no self-service "change my own
  password" UI, only the working endpoint. This admin-only gating
  (Workers tab hidden from non-admins client-side, `/workers` guarded by
  `AdminRoute`, every `/api/users` route requiring
  `requireAuth + requireAdmin` server-side) was reviewed at the start of
  this phase and confirmed already sufficient — no `final.md` stage
  exists for it.
- Offline sync: `lib/offlineSync.js`'s `syncOfflineSale()` mirrors
  `routes/billing.js`'s `isWalkIn` skip — a queued offline sale for
  `WALKIN_CUSTOMER` ("Walk-in / Unknown") skips the `Customer` lookup/409
  and the customer order-history push, same as the live checkout path.
  `WALKIN_CUSTOMER` is duplicated as a local const in
  `lib/offlineSync.js` rather than imported (not exported from
  `routes/billing.js`) — keep both in sync if the sentinel value ever
  changes. Offline sync does not apply customer credit; that auto-apply
  only exists in the live checkout path. **This system is the likely
  starting point** for the deferred offline-management overhaul in
  `final.md`'s "Deferred" section, once Hassan specifies that flow — do
  not assume a from-scratch rebuild is wanted without checking against
  what's already here first.
- `POST /product/undo` validates `productId` with `isValidProductId()`
  the same way `POST /api/product` does.
- `loginLimiter` (`middleware/rateLimit.js`) is `max: 20` per 15-minute
  window with `skipSuccessfulRequests: true` — tuned for a single shared
  shop IP where multiple workers' successful logins shouldn't eat into
  the failed-attempt budget.
- Billing's cart summary and standard receipt printout (`printReceiptFor`,
  not the Special Bill) show a "Discount" line (sum of each line's $
  discount) above Grand Total whenever it's greater than zero. `final.md`
  Stage 10 changes the on-screen cart summary's item table specifically
  (stacked lines instead of an 8-column table) — the Discount line itself
  isn't removed, just the surrounding item-list layout.
- `lib/reports.js`'s `getDashboardSummary` derives both `refundedOrders`
  and `refundedAmount` from the same `Refund.aggregate` call scoped by
  `refundDate` (`refundedOrders` via `$addToSet` on `orderID`), so the
  two numbers always agree on the same date range.

## Request flow

1. `/auth/*` → `routes/auth.js`.
2. `/api/export/*` and `/api/sync/*` → optional modules when enabled.
3. Other `/api`, `/billing`, `/product`, `/customer`, `/supplier`, and
   `/dashboard/load` paths → the domain route files under `routes/`.
4. Other GET requests serve the built React SPA.
5. Unmatched `/api/*` and `/auth/*` requests return JSON 404s.

Backend authorization is the real security boundary; frontend admin
gating is UX only.

## Working principles

Preserve existing behavior unless the current `final.md` stage explicitly
requires changing it. Do not add features simply because they appear
useful. When a change conflicts with historical assumptions, follow the
current repository plus `final.md`, then document the change in
`final-progress.md`.
