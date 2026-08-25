# Final Fixes Progress Log — BPIOLS

Append-only log for the phase defined in `final.md`. Do not rewrite prior
entries — append new ones as each stage completes. This log is separate
from `production-progress.md` (the previous phase's log) — the two must
never be confused with each other.

Stage numbering here follows `final.md` only, starting fresh at Stage 1,
independent of `production.md`'s Stage 1–8 and the original build's
`progress.md` numbering.

No stages completed yet. `final.md` was agreed on 2026-08-24 after a
full item-by-item discussion of Hassan's handwritten notes and
screenshots. Three items from those notes (Exchange process improvements,
Offline management overhaul, Dashboard offline-billing visibility) were
deliberately left out of the initial `final.md` — see its (now resolved)
"Deferred — not yet scoped" section — pending further detail from
Hassan.

**2026-08-25 update:** Hassan supplied a separately-triaged document
covering exactly those three deferred items (plus the standalone
"where is offline data saved?" question). Merged into `final.md` as
Stage 12 (offline draft persistence), Stage 13 (offline sync reliability
& dashboard visibility), and Stage 14 (exchange process improvements).
Stages 1–11 were not touched — that document's own "not covered" section
noted it lacked context on the already-resolved #4/#7 (product
deletion/stock-adjustment) discussion, so nothing from it was allowed to
override Stage 9. A full coverage audit against all 16 original notebook
items was appended to the end of `final.md`; all 16 are now accounted
for (15 as their own stage/closed-item, #7 folded into Stage 9's scope
rather than kept separate). `final.md` now has 14 stages; the "Deferred"
section is empty. No code changed this update — planning only.

**2026-08-25 — Stages 1 & 2 complete.**

**Stage 1 — Currency: PKR.** `frontend/src/lib/money.js`'s `formatMoney()`
rewritten to output `Rs 1,234.50` (comma thousands-grouping, `-Rs X.XX`
for negatives), replacing the old `$X.XX` format. `roundMoney()`
unchanged. Confirmed by grep that no other frontend file has a hardcoded
`$` money literal outside this function — every money display already
routes through `formatMoney()`, so no other file needed changes, per the
stage's own contingency note.

**Stage 2 — Product ID auto-generation.** `routes/products.js`'s
`POST /api/product` create path now ignores any submitted `productId`
and generates the next sequential `#000N` server-side via a new
`nextProductId()` helper, backed by a new `models/Counter.js`
(`{ _id, seq }`, incremented atomically with `findOneAndUpdate($inc)`,
lazily seeded from the current max existing `productID` on first use) so
a deleted product's ID is never reissued. The existing-product (update)
merge branch is unchanged — it still looks up by the submitted
`productId`. The response now includes the generated `productId` for the
create path. `frontend/src/pages/Products.jsx`: removed the Product ID
input from the Add Product form entirely; Update Product still shows the
ID as a disabled, pre-filled field. Submit validation on Add no longer
requires a typed ID (only Product Name). On successful Add, a plain
alert shows the generated ID (e.g. "Product added successfully as
#0007.") — full toast styling is Stage 5/6's job, this is the plain
message the stage description allows for now.

*Note (flagged, not a scope violation):* `models/Counter.js` is a new
file not listed in Stage 2's "Affected areas" (`routes/products.js`,
`frontend/src/pages/Products.jsx`). It was added because the stage's own
task list requires collision-free, non-reused sequential IDs, which
isn't achievable by scanning `Product.productID` alone (a deleted
product's number would otherwise be reissued). This is a small, generic,
reusable helper (documented in `CLAUDE.md` under "Existing conventions"
so later stages needing another counter — e.g. Order IDs — reuse it
rather than duplicating the pattern).

**Verified:**
- Backend: `npm install`, boot-tested with a real `.env` (fresh
  `JWT_SECRET` generated, no other values changed) — server starts
  cleanly, `routes/products.js` mounts without throwing. Unauthenticated
  `POST /api/product` correctly returns 401. No live MongoDB replica set
  in the sandbox, so `nextProductId()`/`Counter` writes and the full
  create/update flow were not exercised against real data — only
  route-mount and pre-DB auth/validation behavior were confirmed.
- `npm test` — all 66 existing tests pass unchanged (money/validator
  tests only cover backend `lib/money.js`/`lib/validators.js`, which
  Stage 1/2 didn't touch).
- Frontend: `npm install` + `npm run build` (Vite) — clean build, no
  errors, both stages' changes included.
- Test/build artifacts (`node_modules`, `.env`, `frontend/dist`) removed
  after verification, before packaging.

**Known/open:**
- Product ID format is still capped at 4 digits (`#0001`–`#9999`,
  unchanged Mongoose schema `match: /^#\d{4}$/`); `nextProductId()` does
  not currently guard against overflow past `#9999` — out of scope for
  this stage, flagging for awareness only.
- No real end-to-end verification of ID sequencing or collision-freedom
  against live data was possible in this sandbox (no MongoDB available);
  this is standard for this project's verification constraints, not a
  gap introduced by this stage.
- Stage 1's "Manual visual check recommended" note stands — not
  performable in this sandbox (no live browser).

**2026-08-25 — Stage 3 complete.**

**Stage 3 — Audit log: flattened readable table.** New
`frontend/src/lib/flattenObject.js` exports `flattenObject(obj, prefix)`
(recursively flattens nested objects/arrays into `{ path, value }` pairs
using dot/bracket paths, e.g. `items[0].productName`; empty objects/arrays
and primitives resolve to a single leaf row so shape is never silently
dropped) and `lastSegment(path)` (extracts the trailing key name for
per-field formatting lookups). `AuditLog.jsx`'s expanded-row detail no
longer renders `JSON.stringify(entry.before/after, null, 2)` inside
`<pre>` blocks; it now builds a merged Field/Before/After row set
(`buildDiffRows`) over the union of both snapshots' flattened paths, one
row per path, sorted alphabetically. Rows where the formatted Before and
After differ get a yellow-tint/bold highlight; for a `create` entry
(`entry.before === null`) every row's Before cell renders blank rather
than the flattened literal `null`. Field values whose trailing key
matches `price`/`amount`/`balance`/`paid`/`due`/`cost` (case-insensitive)
are run through the existing `formatMoney()`; keys matching `date` or
ending in `At` are rendered via `Date.parse` + `toLocaleString()` when
parseable. Everything else stringifies as-is; a leaf value that is
itself a nested object/array (e.g. inside a deeply mixed structure) falls
back to a plain `JSON.stringify` of just that one cell, not the whole
entry — this is not a raw-dump regression, no entry, top-level or nested,
is rendered as one undifferentiated JSON blob anymore.

**Verified:**
- Frontend: `npm install` + `npm run build` (Vite) — clean build, no
  errors.
- `npm test` — all 66 existing backend tests still pass unchanged (this
  stage made no backend changes; `before`/`after` snapshots already
  contained everything needed, per the stage's own scope note).
- Manual check against real audit entries of different action types
  (create/update/delete, nested array fields like order line items) was
  not performed — no live Mongo/browser in this sandbox, same constraint
  the stage's own "Testing/validation" section anticipated. Reviewed by
  reading the component logic and confirming the flatten/format/diff
  functions against representative hand-constructed objects (nested
  objects, arrays, `null`/empty cases) instead.
- Confirmed via `grep` that no other frontend file renders a full-entry
  `JSON.stringify` dump; the one remaining `JSON.stringify` call in
  `AuditLog.jsx` is the single-cell fallback for a nested leaf value.

**Known/open:**
- No live-data or live-browser verification was possible in this
  sandbox — same standing constraint as Stages 1–2.
- `formatFieldValue`'s money/date detection is key-name based (matches
  the stage's own spec) rather than schema-aware; a field that happens to
  contain one of those substrings but isn't actually money/a date (none
  currently exist in the audited models, as far as this review found)
  would be mis-formatted. Flagging for awareness only, not a known actual
  case.
