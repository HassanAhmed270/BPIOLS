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

**2026-08-25 — Stage 4 complete.**

**Stage 4 — PDF export alongside CSV.** Added `pdfkit` as a new backend
dependency (`package.json`). New `lib/pdf.js` exports `sendTablePDF(res,
filenameBase, { title, subtitle, columns, rows })` — streams a landscape
A4 PDF with a title/subtitle header and a simple table (dark header row,
one row per record, page breaks handled, "No data for this range." shown
when `rows` is empty) using the same `{ key, label }` column shape
`lib/csv.js`'s `toCSV()` already uses, so each route's column list is
shared between CSV and PDF, not duplicated. `routes/export.js`: kept all
5 existing routes and their URLs unchanged; added a `format=pdf` query
param (`?format=pdf`, default remains CSV) via a new shared
`sendReport(req, res, filenameBase, rows, columns, title, subtitle)`
helper that picks `sendTablePDF` or the existing `sendCSV` — this keeps
the file to one send call per route rather than branching inline in each
of the 5 handlers, per the stage's own "whichever keeps `routes/export.js`
cleanest" note. `frontend/src/lib/api.js`'s `downloadExport(type, range,
format)` now takes an optional third `format` arg (`'csv'` default),
appends `&format=pdf` when requested, and falls back to `.pdf` for the
downloaded filename if the server didn't send a `Content-Disposition`
header. `frontend/src/pages/Reports.jsx`: each of the 5 report cards now
shows two buttons side by side — "Download CSV" (unchanged style) and a
new outlined "Download PDF" — both independently track their own pending
state so clicking one doesn't disable the other.

**Verified:**
- Backend: `npm install` (added `pdfkit`), boot-tested with a real
  `.env` in a single shell session — server starts cleanly, all 5
  export routes return `401` unauthenticated for both the CSV path
  (unchanged) and the new `?format=pdf` path, confirming the routes
  mount and the format branch doesn't bypass `requireAuth`. No live
  MongoDB replica set in the sandbox, so the authenticated PDF-with-real-
  data path was not exercised end-to-end through the route itself.
- `lib/pdf.js`'s PDF generation was verified directly (bypassing auth/DB,
  since neither is available here): a standalone script called
  `sendTablePDF` with representative rows through a throwaway local HTTP
  server, confirmed `Content-Type: application/pdf`, a non-trivial byte
  count, and that the output is a structurally valid PDF (`file` command:
  "PDF document, version 1.3, 1 page(s)") — this exercises the same
  function the routes call, just without auth/Mongo in the path. Also
  confirmed the empty-`rows` branch ("No data for this range.") renders
  without throwing, per the stage's own testing note about a
  structurally valid empty-data PDF.
- `npm test` — all 66 existing tests pass unchanged (this stage added no
  backend logic the test suite covers; `lib/pdf.js` has no dedicated
  test file, consistent with `lib/csv.js` also having none).
- Frontend: `npm install` + `npm run build` (Vite) — clean build, no
  errors.
- Test/build artifacts (`node_modules` in both root and `frontend/`,
  `frontend/dist`, `.env`, `/tmp` scratch files) removed after
  verification, before packaging.

**Known/open:**
- Authenticated, real-data PDF output (actual sales/refund/credit rows,
  multi-page pagination against a real dataset) was not verified
  end-to-end — no live MongoDB replica set in this sandbox, same
  standing constraint as every prior stage. The empty-data and
  representative-hand-built-rows paths were verified directly against
  `lib/pdf.js`, per above.
- `lib/pdf.js`'s table layout is intentionally simple (fixed equal-width
  columns, no per-column width tuning, no cell wrapping beyond
  `ellipsis: true`) — adequate for the stage's "formatted table, not a
  raw data dump" bar, but a report with very long text in a narrow
  column (e.g. a long refund reason) will truncate with an ellipsis
  rather than wrap. Not flagged as a defect against this stage's
  completion criteria, noting for awareness.
- No manual/live-browser check of the two-button Reports.jsx layout was
  possible in this sandbox (no live browser), same constraint as prior
  UI-facing stages.
