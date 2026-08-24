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

`routes/billing.js`/`routes/customers.js` touched outside listed scope
(person's explicit go-ahead mid-stage — checkout needed to know about
customer credit). Design decision: an **edit**'s freed-up overpayment
always becomes store credit (correction, not a cash event); a
**refund** takes an explicit `settlement: 'cash'|'credit'` choice,
defaulting to cash-back.

Added `Order.creditApplied`, `editHistory[].settlement`/`creditAmount`,
`Customer.creditBalance` + per-order `creditApplied`/`creditGenerated`
(mirrors `Supplier.creditBalance`), `Refund.settlement`/
`creditGenerated`. `recomputeOrderTotals` now returns the freed-up
"settlement" instead of losing it behind `balanceDue`'s clamp-to-zero.
Checkout (`routes/billing.js`) auto-applies existing customer credit
before computing `amountPaid`/`balanceDue`, mirroring supplier-credit
auto-apply; also fixed `paymentStatus`'s `amountPaid <= 0` branch to
check `balanceDue` instead (credit-covered $0-paid orders are `'paid'`).
Incidental fixes: `Customer` and `isValidProductId` were used in
`routes/orders.js` but never `require`d (would throw at runtime).
Frontend: cash/credit radio on refund, credit columns/labels on
Orders/Customers/Billing. Added `tests/refundSettlement.test.js`
(11 cases: the 5 production.md scenarios + edge cases).

Verified: `node --check` clean; 66/66 tests passing; boot test (no
token → 401 on all money routes, confirms no load-time errors); `npm
run build` clean; diff confirmed to exactly the 10 intended files.

Open: no live MongoDB in this sandbox — money math is unit-tested
against the real route code but not exercised against a real
transaction; manual pass recommended (edit-down → credit increases;
refund cash vs credit; credit auto-applies on next order; edit-then-
refund composes correctly). `production.md` itself not yet amended to
reflect the billing.js/customers.js scope extension.

---

Stage 6 — In-App User & Worker Management — DONE

New `routes/users.js` (admin-only unless noted): `GET/POST /api/users`
(list, create — role must be `admin`/`cashier`, password min 8 chars),
`DELETE /api/users/:username` (blocks self-delete and deleting the last
remaining admin), `POST /api/users/:username/reset-password`
(admin-initiated reset), `POST /api/users/me/password` (self-service,
any logged-in role — verifies current password via bcrypt, returns a
fresh token like `/auth/refresh` so the caller isn't logged out by their
own action). All four mutating actions call `logAudit()`
(`user.created`/`user.deleted`/`user.password_reset`/
`user.password_changed`) with `targetType: 'user'`. Every password write
sets `passwordChangedAt`, reusing Stage 2's revocation mechanism as-is —
no changes needed to `middleware/auth.js` or `models/user.js`.

Frontend: new `Users.jsx` (admin-only, `/workers` route, same
`AdminRoute` pattern as Audit Log) — worker table with role/added-date,
delete, and a reset-password modal; an "Add Worker" form alongside it,
matching `Suppliers.jsx`'s table+form layout. `App.jsx` and
`Sidebar.jsx` wired (`Workers` link un-disabled — it already existed as
a disabled placeholder pointing at `/workers`). `AuditLog.jsx` gained
labels/badges for the four new action types. `api.js` gained
`getUsers`/`createUser`/`deleteUser`/`resetUserPassword`/
`changeOwnPassword`.

**Deliberate scope decision:** no self-service "change my own password"
UI was built. `production.md`'s Stage 6 Affected areas list only
`Users.jsx` + routing/sidebar as frontend additions; the self-service
bullet is worded as an endpoint only, with no paired UI file, and
`Topbar.jsx`/`AuthContext.jsx` (where such a UI would have to live)
aren't in scope. The `POST /api/users/me/password` endpoint exists and
works; there's just no in-app entry point to reach it yet. Flagging this
the same way Stage 4 flagged its "no force-delete UI" decision — worth
a follow-up if a self-service UI turns out to matter in practice.

No dedicated test file added — `routes/users.js` is CRUD + bcrypt with
no pure-math logic comparable to Stage 1's money/pricing/costing scope
or Stage 2's `requireAuth`; every other CRUD route (customers,
suppliers) is boot-tested only too, not unit-tested, so this stays
consistent with that existing precedent rather than introducing a
one-off exception.

Verified

- `node --check` clean on `main.js` and `routes/users.js`.
- `npm test`: 66/66 passing (no change from Stage 5 — no new test file),
  fresh `npm install`.
- Boot test (single `bash_tool` call, no live Mongo — none available in
  this sandbox): booted with a real `.env`, hit all five new routes with
  no token (all 401, confirming the module mounts and loads without
  throwing) and an unmatched `/api/*` path (404).
- `npm run build` (frontend, fresh `npm install`): clean, no errors.
- `git status --short` / `git diff --stat` confirm exactly the 7
  intended files changed (5 modified, 2 new) — nothing else.
- `node_modules` (root and frontend), `frontend/dist`, and the scratch
  `.env`/log removed after verification, before packaging.

Open / known limitations

- No live MongoDB available in this sandbox (same gap as every prior
  stage) — none of the CRUD/auth logic above was exercised against a
  real database or a real browser session. A manual live pass is
  recommended: (a) log in as admin, add a cashier worker, confirm they
  can log in; (b) reset that worker's password, confirm their existing
  token stops working immediately; (c) attempt to delete your own
  account and the last remaining admin, confirm both are blocked;
  (d) call `POST /api/users/me/password` directly (e.g. via curl) as a
  logged-in cashier, confirm the old token is invalidated and the
  returned new token works.
- No self-service password-change UI — see the scope decision above.

Compaction note (this pass)

Stages 1-4 were condensed from their original multi-page entries (full
verification narratives, every flagged nuance) down to short summaries
above, to bring this file back under ~250 lines. No facts were changed
or removed — only shortened. If the full original wording for any prior
stage is needed again, it exists in this file's git history
(`production-progress.md` at the commit just before this compaction).
