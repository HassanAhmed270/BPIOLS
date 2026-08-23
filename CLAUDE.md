# CLAUDE.md — BPIOLS Production Readiness

This repository is in a dedicated **production-hardening phase**. The MERN
billing/POS application is already feature-complete. Current work is limited
to correctness, security, data integrity, operational safety, and structural
cleanup defined by `production.md`.

## Document authority

- `production.md` is the authoritative production-readiness plan.
- `CLAUDE.md` contains current architecture and working rules.
- `production-progress.md` is the append-only log for this phase.
- `progress.md` is the historical feature-build log. Do not use its old
  stage numbering as production stage numbering.

Production stages start at **Stage 1** and follow `production.md` only.

## Start every task by syncing

Before planning or changing code:

1. Clone `https://github.com/HassanAhmed270/BPIOLS.git` into a scratch
   directory, or, if already cloned in this session:
   `git fetch origin main && git reset --hard origin/main`
2. Read `production.md` in full.
3. Read this `CLAUDE.md`.
4. Read `production-progress.md` in full if it exists.
5. Identify the next incomplete `production.md` stage and work only on it.

Never trust a local clone from an earlier session. The repository may have
changed since the previous task.

## Scope rules

- Work one production stage at a time and in `production.md` order.
- Touch only the stage's listed **Affected areas**.
- If proper completion requires an out-of-scope change, stop and flag it.
- An unrelated one-line, obviously-correct fix may be made inline, but state
  that it was incidental. Otherwise flag unrelated issues instead.
- Do not refactor or "improve while you're here."
- Prefer small, reversible commits. If a stage becomes too large, flag it.

## Existing conventions

Check for an existing helper before creating new logic.

- Money: `lib/money.js` → `roundMoney()`
- Prices: `lib/pricing.js`
- Validation: `lib/validators.js`
- Pagination/sorting: `lib/query.js`
- Errors: `lib/errors.js` → `AppError` + `asyncHandler`
- Audit logging: `lib/auditLog.js` → `logAudit()`
- FIFO costing: `lib/costing.js`
- Frontend API calls: `frontend/src/lib/api.js`

When inside an existing MongoDB transaction, pass its session to helpers that
support sessions.

### Code style

New code has **no comments** and no unnecessary blank-line padding. When
directly modifying existing code, remove comments in the touched code as part
of that change. Do not strip comments from unrelated files.

## Verification

- Backend changes: install dependencies, use a real `.env`, start the server,
  and exercise relevant routes with `curl` in one shell/tool call where a
  background server is required.
- Frontend changes: run `npm run build` or the appropriate Vite build.
- After Stage 1 establishes the test command, run `npm test` before declaring
  every later stage complete.
- Clean temporary `node_modules`, `.env`, `dist/`, logs, and other test
  artifacts before packaging when appropriate.
- State clearly when MongoDB/browser/end-to-end behavior was not actually
  tested.
- Never claim a push, merge, deployment, or live GitHub state unless it
  actually happened.

## End-of-stage requirements

A stage is not complete until:

1. `production-progress.md` is appended with:
   - changes;
   - verification performed;
   - open/known limitations.
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

- Backend: Express + Mongoose at repository root, primarily `main.js`.
- Domain routes may be under `routes/`; much of the existing API remains in
  `main.js`.
- Frontend: React + Vite + Tailwind under `frontend/`.
- Production backend serves `frontend/dist`.
- MongoDB **must run as a replica set** because checkout and other inventory
  mutations use multi-document transactions.
- `.env` is required; `JWT_SECRET` is required for boot, and the server also
  refuses to boot if `JWT_SECRET` still matches the placeholder value shipped
  in `.env.example` (checked in `middleware/auth.js`).
- `User.passwordChangedAt` is embedded into every issued JWT (`pwdTs` claim).
  `requireAuth` re-reads the user's current `passwordChangedAt` from the DB on
  every request and rejects the token if it's older than the current value —
  so a password change invalidates all previously issued tokens for that
  account. Any code path that changes a user's password must update
  `passwordChangedAt` to a fresh `Date` for this to take effect.

Core models include `Product`, `Customer`, `Order`, `Supplier`, `Refund`,
`PendingBill`, `OfflineSale`, `AuditLog`, `StockBatch`, and `User`.

Important invariants:

- Product/order business IDs use `#0000`-style identifiers; do not confuse
  them with Mongo `_id`.
- Product prices are history arrays; read them through `lib/pricing.js`.
- Stock availability accounts for `reserved`.
- Checkout uses persisted `PendingBill` data and server-side price/discount
  verification.
- Walk-in sales use the existing `Walk-in / Unknown` sentinel and remain real
  audited orders without a customer credit record.
- `Product.supplierID` is an optional `Supplier` ObjectId; `NoSupplier` is the
  self-purchase sentinel.
- Restocking and checkout use transactions.
- FIFO stock costing is handled through `StockBatch` and `lib/costing.js`.
- Audit records are written through `logAudit()`.
- CSV export and offline sync are optional feature-flagged modules.

## Request flow

1. `/auth/*` → authentication routes.
2. `/api/export/*` and `/api/sync/*` → optional modules when enabled.
3. Other `/api`, `/billing`, `/product`, `/customer`, `/supplier`, and
   `/dashboard/load` paths → JSON API handlers.
4. Other GET requests serve the built React SPA.
5. Unmatched `/api/*` and `/auth/*` requests return JSON 404s.

Backend authorization is the real security boundary; frontend admin gating is
UX only.

## Working principles

Preserve existing behavior unless the current `production.md` stage explicitly
requires changing it. Do not add features simply because they appear useful.
When a production-hardening change conflicts with historical assumptions,
follow the current repository plus `production.md`, then document the change
in `production-progress.md`.
