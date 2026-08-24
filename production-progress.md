BPIOLS — Production Readiness Progress

Append-only fast-reference log for the production-hardening phase.
Separate from the historical feature-development progress.md. Compacted
periodically (stage entries condensed to essentials) to stay under
~250 lines — see "Compaction note" at the bottom for what was trimmed.

Phase rules

- Production stage numbering starts at Stage 1; production.md is the
  authoritative stage list; CLAUDE.md holds architecture/working rules.
- Historical stages in progress.md are not production stages.
- Append new entries; never rewrite previous production entries (a
  compaction pass may condense old entries' prose but must not change
  their facts).

---

Stage 1 — Automated Test Foundation — DONE

Added a dependency-free `node:test` harness (`tests/money.test.js`,
`pricing.test.js`, `validators.test.js`, `costing.test.js`,
`orderMath.test.js`) and an explicit-file-list `test` script in
`package.json` (glob/bare-discovery forms were tried and failed on the
person's Windows machine). `orderMath.test.js` reimplements main.js's
inline formulas (not exported) as a pinned regression net.
Verified: 46/46 passing, confirmed independently on the person's Windows
machine. No production code changed. `consumeFIFO`/`restoreConsumption`
remain untested (need a live Mongo session).

---

Stage 2 — Security & Config Hardening — DONE

Replaced `.env.example`'s functional-looking `JWT_SECRET` with an
obviously-fake placeholder; `middleware/auth.js` now refuses to boot if
`JWT_SECRET` matches it. Added `User.passwordChangedAt`, embedded as a
`pwdTs` JWT claim; `requireAuth` (now async) re-reads it from the DB per
request and rejects stale tokens. Incidental fix: `scripts/
createUser.js`'s upsert now also sets `passwordChangedAt` (otherwise the
whole mechanism could never actually fire). Added `tests/auth.test.js`.
Verified: boot-refusal confirmed; 5 new unit tests exercise the real
`requireAuth`/token logic (DB call stubbed); 51/51 passing. Not
exercised against a live Mongo end-to-end (none available in this
sandbox) — recommended manual check documented in the original entry.

---

Stage 3 — Structural Cleanup: Route Module Split + Indexes — DONE

Split all 28 inline route handlers out of `main.js` (1,638 → 160 lines)
into `routes/products.js`, `customers.js`, `billing.js`, `suppliers.js`,
`orders.js` (incl. `recomputeOrderTotals`/`applyLineReduction`, and
`GET /dashboard/load` — a judgment-call placement, flagged), `audit.js`
— moved by exact line-range extraction, zero logic changes, same paths.
Added indexes: `Order.orderDate`, `Order.customerName`,
`Product.category`; `Supplier.supplierName` left alone (already
indexed via `unique: true`).
Verified: side-by-side pre/post boot test hit all 28 routes + login +
an unmatched path — identical status codes on every one; 51/51 tests
still passing (untouched by this stage). Not exercised against a live
Mongo (none available). Flagged: `recomputeOrderTotals`/
`applyLineReduction` still aren't exported for direct testing.

---

Stage 4 — Customer Data Integrity & Access Control — DONE

`routes/customers.js`'s `POST /customer/deleteCustomer`: added
`requireAdmin`; added an outstanding-balance guard (409 +
`requiresForce: true` if any `orders[].balanceDue > 0`, unless
`force: true` is sent). Reviewed every route writing
`Order.amountPaid`/`balanceDue` and confirmed each already syncs the
matching `Customer.orders[]` entry in the same transaction — a
verification finding, not a code change. Added
`tests/customerBalance.test.js`.
Verified: static middleware-chain check confirms `requireAdmin` wiring;
boot test (worker/no-token get 401 pre-auth, as expected given no live
Mongo); 56/56 passing. Frontend has no "force delete" UI — **decided**:
intentional, stays API-only, no further action.

---

Stage 5 — Refund & Edit Financial Correctness — DONE

Scope note: two backend files outside production.md's listed Affected
areas (`routes/billing.js`, `routes/customers.js`) were touched, with
the person's explicit go-ahead given mid-stage — the auto-apply-credit-
at-checkout requirement genuinely can't work without touching checkout,
and the credit ledger needs to be visible via the customers list
endpoint. Recorded here per the project's scope-flagging rule.

Design decision (person's call, mid-stage): an **edit** is treated as a
correction/exchange, not a cash event — any overpayment an edit-down
frees up is always converted to store credit, never handed back as
cash. A **refund** is an explicit choice per request, defaulting to
cash-back (matches prior behavior when nothing is specified).

Changed

- `models/Order.js` — added `creditApplied` (credit used at checkout for
  this order). `editHistory` entries gained `settlement`
  ('none'/'cash'/'credit') and `creditAmount`.
- `models/Customers.js` — added top-level `creditBalance` (mirrors
  `Supplier.creditBalance`); per-order `creditApplied`/`creditGenerated`
  (mirrors `Supplier.purchases`).
- `models/Refunds.js` — added `settlement` and `creditGenerated`.
- `routes/orders.js` — `recomputeOrderTotals` now caps `amountPaid` down
  to the (possibly smaller) new total and *returns* the freed-up
  overpayment ("settlement") instead of letting it silently vanish
  behind `balanceDue`'s clamp-to-zero, as it did before this stage.
  - Edit route: settlement is always converted to customer credit
    (`Customer.creditBalance` incremented, `orders.$.creditGenerated`
    set, `editHistory` entries stamped `settlement: 'credit'`).
  - Refund route: accepts `settlement: 'cash'|'credit'` in the request
    body (default `'cash'`); only converts to credit if the admin chose
    `'credit'` *and* there was actually an overpayment to settle
    (`disposition` is `'none'` otherwise, even if items were refunded).
    `Refund` record and `editHistory` entries both stamped with the
    actual disposition.
  - `/api/orders` list mapping now includes `creditApplied`.
  - Incidental one-line fixes (pre-existing bugs in a file already being
    edited, not part of the ask): `Customer` and `isValidProductId` were
    used in this file but never `require`d — both edit and refund would
    have thrown `ReferenceError` at runtime the moment either was hit.
    Both imports added.
- `routes/billing.js` (scope extended, see note above) — checkout now
  re-reads the customer's current `creditBalance` inside the commit
  transaction, applies `min(existingCredit, verifiedTotal)` against the
  order before computing `amountPaid`/`balanceDue` (mirrors the
  supplier-credit auto-apply already in `routes/suppliers.js`), and
  decrements the customer's balance by what was applied. `Order.create`
  and the `Customer.orders` push both record `creditApplied`.
  `paymentStatus`'s `amountPaid <= 0` branch was also corrected to check
  `balanceDue` (an order fully covered by credit, with $0 paid, is
  `'paid'`, not `'unpaid'`).
- `routes/customers.js` (scope extended, see note above) — `GET
  /api/customers` now also returns `creditBalance` per customer.
- Frontend: `Orders.jsx` — refund form gained a Cash back / Store credit
  radio choice; order detail now shows `creditApplied`; edit-history and
  refund lists show the settlement outcome inline. `Customers.jsx` — new
  "Store Credit" column, matching the Balance Due column's styling
  convention. `Billing.jsx` — shows the selected customer's available
  store credit above the Paid field, labeled "auto-applied at checkout".
- Added `tests/refundSettlement.test.js`: mirrors
  `recomputeOrderTotals` and the checkout credit-apply math. Covers the
  five production.md scenarios (full refund of paid-in-full, partial
  refund of paid-in-full, partial refund of a still-partially-paid
  order, edit-down, edit-down-then-later-refund) plus a zero-amount edge
  case, fractional-cent rounding, and three checkout-side credit-apply
  cases (fully covers, partially covers, no credit). Added to
  `package.json`'s explicit test-file list.

Verified

- `node --check` clean on all 6 changed backend files.
- `npm test`: 66/66 passing (56 from Stage 1-4 + 10 new), fresh
  `npm install`.
- Boot test (single `bash_tool` call, no live Mongo — none available in
  this sandbox): booted with a real `.env` (proper non-placeholder
  `JWT_SECRET`), hit `/api/order/:id/edit`, `/api/order/:id/refund`,
  `/api/customers`, `/billing/orderDetails` with no token (all 401,
  confirming the modules load without throwing — the missing-`Customer`-
  import bug above would have surfaced here) and an unmatched `/api/*`
  path (404).
- `npm run build` (frontend, fresh `npm install`): clean, no errors.
- `git status --short` / `git diff --stat` confirm exactly the 10
  intended files changed (6 backend, 3 frontend, `package.json`) plus
  the 1 new test file — nothing else.
- `node_modules` (both root and frontend), `frontend/dist`, and the
  scratch `.env` removed after verification, before packaging.

Open / known limitations

- No live MongoDB available in this sandbox (same gap as every prior
  stage) — none of the money math above was exercised against a real
  transaction. The unit tests pin down the arithmetic exactly as it
  reads in the real route code; a manual live-DB pass is recommended
  before relying on this: (a) fully pay an order, edit a line down,
  confirm `amountPaid` drops and the customer's `creditBalance`
  increases by the freed amount; (b) refund the same reduced order and
  choose cash-back, confirm no credit is added; (c) refund another paid
  order choosing store credit, confirm the `Refund` record and
  `Customer.creditBalance` agree; (d) place a new order for a customer
  with existing credit, confirm it's applied and the balance drops;
  (e) edit-down then later refund the same order, confirm both events'
  math composes correctly (this exact sequence is unit-tested, but not
  against a live transaction).
- `routes/billing.js` and `routes/customers.js` were touched outside
  production.md's listed Stage 5 Affected areas, with the person's
  explicit approval mid-stage (see Scope note above) — production.md
  itself has not been edited to reflect this; worth updating the plan
  document directly if this pattern (checkout needing to know about
  customer credit) comes up again in a later stage.
- Frontend credit UI is intentionally minimal (a label, a column, a
  radio choice) — no dedicated "credit history" view was built; not
  called for by production.md's Stage 5 scope.
- `GET /api/orders/:orderID` (single-order detail) already returns the
  full `Order` document unmodified, so `creditApplied` and the new
  `editHistory` fields are already present there with no route change
  needed — only the `/api/orders` *list* mapping needed an explicit add.

---

Compaction note (this pass)

Stages 1-4 were condensed from their original multi-page entries (full
verification narratives, every flagged nuance) down to short summaries
above, to bring this file back under ~250 lines. No facts were changed
or removed — only shortened. If the full original wording for any prior
stage is needed again, it exists in this file's git history
(`production-progress.md` at the commit just before this compaction).
