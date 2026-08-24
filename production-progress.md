BPIOLS — Production Readiness Progress

This file is the append-only fast-reference log for the production-hardening
phase. It is separate from the historical feature-development
progress.md.

Phase rules

Production stage numbering starts at Stage 1.

The authoritative stage list is production.md.

CLAUDE.md contains architecture and working rules.

Historical stages in progress.md are not production stages.

Append new entries; never rewrite previous production entries.

Current status

Production-readiness work has not yet been recorded in this log.

Before starting a stage, sync the repository and read:

production.md

CLAUDE.md

this file

Then work only on the next incomplete stage in production.md.

Entry format

Stage N — <production.md stage name>

Changed

<files/areas changed and what was done>

Verified

<tests, builds, boot tests, route checks, browser/DB checks actually run>

Open / known limitations

<anything not verified, deferred, or intentionally limited>

Historical phase boundary

The original application was built in earlier feature-development stages and
is already feature-complete. Its detailed history remains in progress.md.
That file documents items such as React migration, authentication, inventory
reservation, draft bills, credit, discounts, refunds, reporting, export,
offline sync, EJS removal, audit logging, responsive UI, worker permissions,
supplier references, selling-price restocking, supplier overpayment credit,
and FIFO batch costing. It is historical context only.

Do not append new production-hardening work to progress.md.

Production stage checklist

For every completed stage, confirm:

Scope stayed within production.md.

Required code verification was performed.

Existing tests/builds were run as required.

Known limitations are recorded honestly.

This file was appended.

CLAUDE.md was updated if required.

Code changes were packaged for manual integration.

Exact integration commands were provided.

Notes

A production stage is complete only after its production.md completion
criteria and the delivery requirements in CLAUDE.md are satisfied.

---

Stage 1 — Automated Test Foundation

Changed

Added `tests/` directory with `node:test`-based unit tests (dependency-free,
uses Node 22's built-in test runner, no new npm dependency):
- tests/money.test.js — roundMoney: 2dp rounding, floating-point drift,
  negative values, zero/integers, non-numeric input, Infinity, numeric
  strings (parseFloat behavior).
- tests/pricing.test.js — getLatestSellingPrice/getLatestBuyingPrice:
  empty/missing history, single-entry, multi-entry picking most-recent-by-
  date (not array order), non-mutation of the source array, independence
  of the two histories.
- tests/validators.test.js — every exported validator (isValidEmail,
  isValidPhone, isValidProductId, isValidOrderId, isValidDiscount,
  isPositiveInt), valid and invalid inputs for each.
- tests/costing.test.js — deriveCostSource, the one pure-math path in
  lib/costing.js (unknown/batch/partial classification, zero/negative
  quantity edge cases). consumeFIFO() and restoreConsumption() are not
  exercised — both require a live Mongo session/transaction against
  StockBatch and are explicitly out of this stage's scope per
  production.md ("otherwise test deriveCostSource directly and document
  what still needs a live DB").
- tests/orderMath.test.js — discount/total calculation logic used in order
  commit and refund/edit. recomputeOrderTotals, the checkout per-line
  amount/discountAmount calc, and applyLineReduction's proportional-
  reduction math are local, un-exported functions inside main.js (some
  also touch the DB inside a transaction session), and Stage 1's Affected
  areas is "new tests/, package.json only — no production code logic
  changes," so main.js was not modified to export them. Instead this file
  reimplements each formula exactly as it reads in main.js today (with
  line references in a comment) and pins that math down as a regression
  net: no-discount/percentage-discount/100%-discount/fractional-cent
  rounding for the checkout line calc; unpaid/partial/paid/overpayment/
  empty-cart for recomputeOrderTotals; partial-reduction/reduce-to-zero/
  no-discount-line for applyLineReduction's math.

Added `"test"` to package.json scripts, listing each test file explicitly
(`node --test tests/money.test.js tests/pricing.test.js
tests/validators.test.js tests/costing.test.js tests/orderMath.test.js`).
No other package.json changes. No production code logic changes anywhere
in the repo this stage.

Note: two earlier forms of this script were tried and abandoned before
delivery:
1. `"node --test tests/**/*.test.js"` — worked in bash but failed on
   Windows PowerShell, which doesn't expand `**` the way bash does, so
   npm passed the literal glob string through and Node errored with
   "Could not find ...tests\**\*.test.js".
2. `"node --test"` (bare, relying on Node's built-in recursive test-file
   discovery) — passed in this Linux sandbox, but the person reported it
   aborting on their machine, while calling a single test file explicitly
   (`node --test tests/money.test.js`) worked fine for them. That points
   to a Node-version-dependent difference in how bare `--test` discovery
   behaves, not a shell issue.
Explicitly listing every file sidesteps both: no shell glob expansion is
needed, and no reliance on directory/bare-arg discovery behavior that
varies by Node version. The tradeoff is that a new test file added to
tests/ later needs to be added to this list by hand — flagged as a known
limitation below.

Verified

- `npm test` (fresh `npm install`, then `npm test`): 46/46 tests pass, 0
  failures, using the explicit-file-list invocation (verified in this
  Linux sandbox; two earlier glob/discovery-based forms were reported
  failing in the person's Windows environment and were replaced before
  delivery — see note above).
- `git diff --stat` against origin/main confirms only package.json (1 line
  added) and the new tests/ directory changed — no other files touched.
- No frontend files touched this stage (confirmed via `git diff --
  frontend/` — empty), so no frontend build was required or run.
- node_modules removed after verification, before packaging.

Open / known limitations

- The orderMath.test.js tests are formula-level, not integration-level:
  they test faithful reimplementations of main.js's inline logic, not
  main.js's actual functions directly (those aren't exported/importable
  today). Stage 3 (route module split into routes/orders.js) is a natural
  point to export recomputeOrderTotals/applyLineReduction for direct
  import and replace/supplement these with true integration tests against
  the real functions — flagged for consideration at that stage, not
  actioned now (out of Stage 1 scope).
- consumeFIFO() and restoreConsumption() in lib/costing.js remain
  untested by this stage; they need a live MongoDB replica-set session to
  exercise meaningfully. Not covered by "dependency-free-of-a-live-
  database" per production.md's own Stage 1 goal.
- Stage 5's refund/edit reconciliation math (the "mirror the 7-scenario
  supplier-credit verification" requirement) is explicitly Stage 5's own
  job per production.md, not Stage 1's — the applyLineReduction math
  tested here covers the existing proportional-reduction formula only, not
  the store-credit/cash-back logic Stage 5 will add.
- The `test` script lists each test file by hand rather than using a glob
  or directory pattern. A new test file added under tests/ later must
  also be added to the `test` script in package.json, or it silently
  won't run. This tradeoff was chosen deliberately, over two glob/
  discovery-based forms, to get something that works reliably across
  the person's Windows/PowerShell environment and this sandbox's Linux/
  Node 22 environment alike.
- No CI wiring — `npm test` is a local/manual command only, per this
  stage's scope.
- This third fix (explicit file list) was independently confirmed by the
  person on their own Windows machine: `npm test` now reports 46/46
  passing there. Stage 1 is considered fully confirmed as of this
  confirmation.

---

Stage 2 — Security & Config Hardening

Changed

- `.env.example` — replaced the functional-looking `JWT_SECRET` example
  value with an obviously non-functional placeholder:
  `REPLACE_THIS_INSECURE_EXAMPLE_VALUE_DO_NOT_USE_IN_PRODUCTION`.
- `middleware/auth.js` — added a boot-time check comparing `JWT_SECRET`
  against that exact placeholder string and throwing (refusing to start)
  if it matches. Added a `passwordChangedAt` ("pwdTs", stored as epoch ms)
  claim to every JWT issued by `signToken`. `requireAuth` is now `async`:
  after verifying the JWT signature/expiry, it re-reads the user's current
  `passwordChangedAt` from the DB (`User.findById(...).select('passwordChangedAt')`)
  and rejects the token (401) if the DB value is newer than the token's
  `pwdTs`, or if the user no longer exists. This adds one DB read per
  authenticated request, which is the mechanism production.md calls for
  and is acceptable at this app's single-shop scale.
- `models/user.js` — added `passwordChangedAt: { type: Date, default:
  Date.now }` to the `User` schema.
- `routes/auth.js` — no changes were needed. Both `/auth/login` and
  `/auth/refresh` already fetch a fresh `User` document from the DB before
  calling `signToken`, so `passwordChangedAt` is embedded automatically.

Incidental one-line fix (flagged, not silently bundled in): `scripts/
createUser.js` is currently the *only* existing code path that sets or
changes a user's `passwordHash` (it upserts, so re-running it against an
existing username is today's de facto "change a worker's password" flow
until Stage 6 adds real in-app user management). Without also setting
`passwordChangedAt: new Date()` on that same upsert, the field would never
actually change through any existing mechanism, silently defeating this
stage's entire purpose. This was a one-line, obviously-necessary change
directly tied to Stage 2's own goal, not an unrelated improvement, so it
was made inline rather than deferred.

Also added `tests/auth.test.js` (Stage 1's `node:test` harness) and added
it to the explicit file list in `package.json`'s `test` script, per Stage
1's own noted limitation that new test files must be added by hand.

Verified

- Boot check (manual, via `bash_tool`, matching production.md's own
  suggested validation method for this item): loading `middleware/auth.js`
  with `JWT_SECRET` set to the exact `.env.example` placeholder throws
  `Error: JWT_SECRET is still set to the placeholder value from
  .env.example. Set a real secret before starting the server.` and the
  process exits non-zero. Loading it with a freshly generated random
  secret succeeds (`auth.js loaded OK with real secret`). This check fires
  at module-require time, before Mongo connects and before `app.listen`,
  so it is a true boot-time refusal.
- `tests/auth.test.js` — 5 new unit tests against the real `requireAuth`/
  `signToken` functions, with `User.findById` monkey-patched per-test
  (same approach Stage 1 used for dependency-free unit tests; no live
  Mongo needed since `requireAuth`'s only DB dependency is a single
  `findById().select()` call): token accepted when DB `passwordChangedAt`
  still matches what was embedded at signing; token rejected when DB
  `passwordChangedAt` is newer (the actual "password change invalidates
  old tokens" scenario); token rejected when the user no longer exists;
  missing/malformed Authorization header rejected; garbage token
  rejected.
- `npm test`: 51/51 passing (46 from Stage 1 + 5 new), run from a fresh
  `npm install`.
- No frontend files touched this stage; no frontend build was required or
  run (confirmed via `git diff -- frontend/` — empty).
- `node --check` clean on every changed `.js` file.
- `node_modules` and the scratch `.env` used for the boot check removed
  after verification, before packaging.

Open / known limitations

- The full login to token issuance to password change to old-token-rejected
  flow was **not** exercised end-to-end against a live MongoDB replica set
  in this sandbox — no `mongod` binary is available here and the network
  egress list doesn't include a domain to fetch one from. The unit test
  above exercises the real `requireAuth`/`signToken` code paths directly
  (only the DB call itself is stubbed), which is the strongest
  verification available without a live database, but it is not a
  substitute for one manual live-DB check before this is relied on in
  production. Recommended manual check: log in, note the token, run
  `node scripts/createUser.js <same-username> <new-password> <same-role>`,
  then confirm the old token now gets a 401 on any authenticated route.
- The extra DB read `requireAuth` now performs on every authenticated
  request is a deliberate accuracy-over-throughput tradeoff per
  production.md's own stated mechanism; not a concern at this app's
  single-shop/single-desktop scale, but worth knowing about if traffic
  patterns ever change.
- `scripts/createUser.js`'s upsert-as-password-change behavior is
  unchanged otherwise; Stage 6 is where a real in-app password-change
  flow (self-service and admin-reset) gets built, wired into this same
  `passwordChangedAt` mechanism.

---

Stage 3 — Structural Cleanup: Route Module Split + Indexes

Changed

- Split all 28 inline route handlers out of `main.js` (1,638 lines) into
  six new domain files, moved by exact line-range extraction (not
  retyped) to guarantee a verbatim, zero-logic-change move: `routes/
  products.js` (5 routes + `parseThreshold`/`resolveSupplierId`
  helpers), `routes/customers.js` (4), `routes/billing.js` (9, incl.
  `orderDetails`), `routes/suppliers.js` (4 + `generateUniquePurchaseId`),
  `routes/orders.js` (5, incl. `recomputeOrderTotals`/
  `applyLineReduction`, and `GET /dashboard/load`), `routes/audit.js` (1).
- Flagged decision: `GET /dashboard/load` isn't named in production.md's
  Stage 3 file list (products/customers/billing/suppliers/orders/audit).
  Placed it in `routes/orders.js` since it reads sales data via
  `lib/reports.js`'s `getDashboardSummary` — closest domain fit. No new
  file was created for it.
- Every router mounts at `app.use('/', ...)` in `main.js`; every route
  keeps its exact original path (`/api/products`, `/product/:productID`,
  `/customer/*`, `/billing/*`, `/supplier/*`, `/api/orders`,
  `/api/order/*`, `/api/audit-log`) — no path changed.
- `main.js` reduced to 160 lines: app setup, DB connection, middleware,
  route mounting, static frontend serving, error handler, draft-sweep
  interval. Sweep still needs `Product`/`PendingBill` directly, kept.
- Indexes added: `Order.orderDate`, `Order.customerName` (range-queried/
  searched in `lib/reports.js` and `/api/orders`), `Product.category`
  (searched in `/api/products`). `Supplier.supplierName` evaluated and
  left alone — its existing `unique: true` already creates a standard
  index, so a second one would be redundant; documented inline in
  `models/Supplier.js`.

Verified

- `node --check` clean on `main.js` and all 6 new route files.
- Route-inventory boot test (single `bash_tool` call, no live Mongo —
  none available in this sandbox, same limitation as Stage 2): booted
  the pre-split repo (commit `a5a4274`, port 4001) and the post-split
  repo (port 4002) side by side, hit all 28 moved routes plus `/auth/
  login` and an unmatched `/api/*` path with the same requests against
  both. Status codes matched exactly on every route (401 for every
  authenticated route with no token, 500 for the one public DB-touching
  route with no Mongo, 400/404 for login/unmatched) — only difference in
  output was the port number in the echoed URL.
- `npm test`: 51/51 passing, unchanged from Stage 2 (all tests target
  `lib/`, untouched this stage).
- `git status --short` confirms only `main.js`, `models/Order.js`,
  `models/Product.js`, `models/Supplier.js` modified and the 6 new
  `routes/*.js` files added — nothing else, including `frontend/`
  (`git diff --stat -- frontend/` empty).
- `node_modules` and the scratch `.env`/comparison repo removed after
  verification, before packaging.

Open / known limitations

- No live MongoDB (replica set or standalone) is available in this
  sandbox and none is fetchable from the allowed network domains — same
  gap noted in Stage 2. The boot test above confirms every route is
  mounted at the right path with identical auth-gating to before the
  split; it does not exercise any route's actual DB-backed business
  logic post-split. A manual live-DB smoke pass (log in, add a product,
  place an order, run a restock, edit/refund, check the dashboard) is
  recommended before this is relied on in production.
- `recomputeOrderTotals`/`applyLineReduction` are still not exported from
  `routes/orders.js` (only the router is) — Stage 1's flagged opportunity
  to replace `tests/orderMath.test.js`'s reimplemented-formula tests with
  direct imports of the real functions remains open, not actioned this
  stage (out of Stage 3's own scope; `tests/` isn't in its Affected
  areas).
- `GET /dashboard/load`'s placement in `routes/orders.js` was a judgment
  call, not called for explicitly in production.md — flagged above,
  worth confirming it's the intended home.

---

Stage 4 — Customer Data Integrity & Access Control

Changed

- `routes/customers.js`'s `POST /customer/deleteCustomer`:
  - Added `requireAdmin` (alongside the existing `requireAuth`), closing
    the access-control gap — a worker token now gets rejected before the
    handler runs at all.
  - Added an outstanding-balance check: the route now looks up the
    customer first, sums `orders[].balanceDue`, and if that total is
    greater than 0, returns `409` with `{ success: false, totalBalanceDue,
    requiresForce: true, message }` instead of deleting — unless the
    request body includes `force: true`, in which case deletion proceeds
    as an explicit, deliberate override. A zero-balance customer deletes
    normally with no change in behavior from before this stage.
  - The audit log entry for `customer.deleted` already captures the full
    customer document (including `orders[]` with each `balanceDue`) in
    its `before` snapshot, so a forced deletion's outstanding balance is
    already on the audit trail with no schema change needed.
- `models/Customers.js`: no changes were needed. The `orders[].balanceDue`
  field and the `totalBalanceDue` virtual this stage relies on already
  existed (added ahead of schedule during Stage 3/5-prep, per that file's
  own comments), and production.md's third task (reconciliation) turned
  out to be a verification task rather than a code-change task — see
  below.
- Reconciliation check (production.md's third implementation task):
  reviewed every code path that writes `Order.amountPaid`/`balanceDue`
  (`routes/billing.js`'s `orderDetails` commit, `routes/orders.js`'s
  `edit` and `refund`) and confirmed each one already updates the
  matching `Customer.orders[]` entry in the same DB transaction
  (`routes/orders.js` lines ~202-206 and ~304-308, `routes/billing.js`
  lines ~360-376). No route exists that mutates an Order's money fields
  without also syncing the Customer-side copy — verified by full route
  inventory (`routes/orders.js` and `routes/billing.js` route lists),
  not just spot-checking. This is a verification finding, not a code
  change; documented here per this stage's own completion criteria
  rather than left unstated.
- Added `tests/customerBalance.test.js` (Stage 1's harness): mirrors the
  outstanding-balance `reduce()` used by the new delete-block logic (zero
  orders, all-paid, multiple outstanding balances, a missing
  `balanceDue` field, fractional-cent rounding). Added to package.json's
  explicit test-file list per Stage 1's own noted convention.

Flagged, not actioned (outside this stage's Affected areas): implementing
the "explicit forced confirmation" override means the API can now return
`409`/`requiresForce: true`, but `frontend/src/pages/Customers.jsx`'s
`handleDelete` only does `alert(data.message)` on any non-success
response — there is currently no UI path for an admin to send
`force: true`. The backend correctly blocks the deletion either way (an
admin without the override literally cannot delete a customer with a
balance through today's UI, which satisfies "cannot be deleted without an
explicit, deliberate override" defensively), but the override itself is
only reachable via a direct API call (curl/Postman) right now, not through
the app. production.md's Stage 4 Affected areas lists only
`routes/customers.js` and `models/Customers.js`, not frontend, so this was
not fixed here — flagged for a decision rather than silently expanding
scope into frontend/.

Verified

- `node --check routes/customers.js`: clean.
- Static middleware-chain check (no live Mongo needed): required
  `routes/customers.js` directly and inspected the Express route stack
  for `/customer/deleteCustomer` — confirmed the middleware order is
  exactly `requireAuth`, `requireAdmin`, handler.
- Boot test (single `bash_tool` call): booted the server with a real
  `.env` (JWT_SECRET set, no live Mongo — same limitation as Stages 2/3,
  no `mongod` available in this sandbox) and hit the route with curl. A
  request with no `Authorization` header correctly gets `401` before
  reaching any handler code. A request with a valid worker-role JWT also
  came back `401` rather than the expected `403` — but this is because
  `requireAuth` itself now does a DB read (`User.findById`, added in
  Stage 2) that hangs and times out against the connection-less DB
  before ever reaching `requireAdmin`, not a Stage 4 regression; the
  static middleware-chain check above is the reliable confirmation that
  `requireAdmin` is correctly wired in after `requireAuth`. A full live
  role-gating and balance-block test (worker→403, admin+balance→409,
  admin+force→200, admin+zero-balance→200, each confirmed against a real
  DB) is recommended manually and listed below.
- `npm test`: 56/56 passing (51 from Stage 1-3 + 5 new), run from a fresh
  `npm install`.
- No frontend files touched this stage (confirmed via `git diff --stat --
  frontend/` — empty), so no frontend build was required or run — this is
  also why the frontend gap above was flagged rather than silently fixed.
- `git status --short` / `git diff --stat` confirm only `routes/
  customers.js`, `package.json`, and the new `tests/customerBalance.test.js`
  changed — `models/Customers.js` was reviewed but needed no edit.
- `node_modules` and the scratch `.env` removed after verification, before
  packaging.

Open / known limitations

- No live MongoDB available in this sandbox (same gap as Stages 2-3) —
  the role-gating and balance-block logic could not be exercised
  end-to-end against a real database. Recommended manual check: as a
  worker, attempt `POST /customer/deleteCustomer` → expect `403`; as an
  admin, attempt it on a customer with `orders[].balanceDue > 0` → expect
  `409` with `requiresForce: true`; retry with `force: true` in the body →
  expect `200` and an audit-log entry whose `before` snapshot shows the
  outstanding balance at time of deletion; attempt it on a zero-balance
  customer as admin with no `force` → expect `200`, unchanged from
  pre-Stage-4 behavior.
- Frontend force-flow gap: **decided.** The person confirmed leaving this
  as-is — the override stays API-only, with no "force delete" button
  added to `Customers.jsx`. This is intentional, not an oversight: it
  makes deleting a customer with an outstanding balance deliberately
  hard to do by accident from the app. No further action needed here
  unless revisited in a later stage.
- The reconciliation review above is current as of Stage 4 — it covers
  every route that exists today. Stage 5 (refund & edit financial
  correctness overhaul) explicitly changes `amountPaid`/`balanceDue`
  math further and will need to preserve this same sync-in-the-same-
  transaction pattern; production.md already calls this out as Stage 5's
  own concern.