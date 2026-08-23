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
