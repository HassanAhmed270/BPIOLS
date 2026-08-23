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

Added `"test": "node --test tests/**/*.test.js"` to package.json scripts.
No other package.json changes. No production code logic changes anywhere
in the repo this stage.

Verified

- `npm test` (fresh `npm install`, then `npm test`): 46/46 tests pass, 0
  failures.
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
- No CI wiring — `npm test` is a local/manual command only, per this
  stage's scope.