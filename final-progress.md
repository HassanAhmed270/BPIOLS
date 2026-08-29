# Final Fixes Progress Log — BPIOLS

Append-only log for the phase in `final.md`. Condense older stages for
length only, never change what they claim. Separate from
`production-progress.md` (earlier phase's log) — never confuse the two.
Stage numbering follows `final.md` only, starting at Stage 1.

`final.md` was agreed 2026-08-24; a second triage doc merged in as
Stages 12–14 on 2026-08-25. All 16 original notebook items are
accounted for; "Deferred" is empty as of Stage 17. Stages 18–19 were
raised and scoped directly by Hassan on 2026-08-29, same as Stage 16.

**Stages 1–9 complete (2026-08-25, condensed).** 1: PKR via
`formatMoney()`. 2: sequential `#000N` product IDs (`nextProductId()`/
`Counter.js`, atomic, never reissued). 3: `AuditLog.jsx` flattened
before/after table. 4: PDF export alongside CSV (`lib/pdf.js`,
`pdfkit`). 5: toast/confirm infra (`sonner`, `ConfirmDialog.jsx`). 6:
all 64 `alert()`/`confirm()` call sites migrated — zero remain. 7: Add
Product requires `cost`; positive initial stock creates a matching
`NoSupplier` `StockBatch` (`lib/costing.js`, shared with
`routes/suppliers.js`); incidental fix: `suppliers.js` was missing its
`mongoose` import. 8: Billing shows selected product's cost next to
selling price, admin-gated. 9 (split 9a/9b/9c): Add/Deduct Stock
actions, zero-stock auto-disable, `returned_to_supplier` credits
supplier instead of `Loss`; Loss on Dashboard + 6th Reports export;
hard-delete requires `{reason, note}`, 400s if `quantity > 0`. Verified
throughout: boot-tested, `npm test` 66/66, build clean, `oxlint` 0
errors. No live DB/browser in sandbox for any stage — standing
constraint, not a defect.

**Stage 10 complete (2026-08-26, condensed).** UI polish,
frontend-only. `Products.jsx` Add/Update colors + 2-column grid;
`Billing.jsx` cart preview → stacked receipt-lines. **Same-day
correction (Hassan-flagged):** the grid had briefly let Update
Product's Supplier dropdown change `supplierID` — fixed both sides
(dropdown Add-mode only; update branch never touches `supplierID`).
Verified clean throughout.

**Stage 11 complete (2026-08-26, condensed).** Bill preview: customer
balance.
`Billing.jsx` only. "Customer Balance" line at the bottom of the
on-screen preview (`totalBalanceDue - creditBalance`, pre-sale) when a
real customer is selected. Verified clean throughout. Known/open:
code-reviewed only, recommend a manual check (balance-due/in-credit/
walk-in) once merged.

**Stage 12 complete (2026-08-26, condensed).** Offline: continuous draft
persistence. `frontend/src/lib/offlineQueue.js`/`Billing.jsx` only, no
backend changes. New IndexedDB `drafts` store (`DB_VERSION` 1→2,
additive, `sales` store untouched), single fixed record —
`saveLocalDraft()`/`getLocalDraft()`/`clearLocalDraft()`. `withStore()`
generalized to take a store-name param. `Billing.jsx`: a new
non-debounced `useEffect` writes cart state on every change, separate
from the existing 7s-debounced *server*-side autosave (unchanged, still
fails silently offline). Local draft checked first on mount, same
resume/discard pattern; `resetBill()` clears both. Stays local until
"Generate Bill" per `final.md` — no auto-handoff to `PendingBill`.
Follow-up same day (Hassan-flagged): added `fake-indexeddb` +
`offlineQueue.test.js` (10 cases, `frontend`'s first test coverage);
surfaced and fixed a real bug — `withStore()` never closed its IndexedDB
connection, hanging `deleteDatabase()` between test runs. Verified both
passes: `npm run build` clean, `oxlint` 0 errors, boot-tested, `npm test`
66/66 (root) + 10/10 (`frontend`). Known/open: no live browser/IndexedDB
— store creation, restore-on-reload, clear-on-finalize code-reviewed
only; recommend a manual reload check (online + devtools-Offline).

**2026-08-26 — Stage 13 complete.** Offline: sync reliability &
dashboard visibility (depended on Stage 12). Sync commit/transaction/
replay logic unchanged — additive reliability/visibility only.
`offlineSync.js`: `online` event now waits ~60s (`RECONNECT_DELAY_MS`,
debounced) before flushing instead of firing instantly. New
`SyncOverlay.jsx` (mounted in `App.jsx`) driven by a small pub-sub
(`subscribeAutoSync`/`isAutoSyncing`) set only around *automatic*
flushes — Reports.jsx's manual "Sync Now" bypasses it, unchanged.
`flushOne()` now calls new `verifyOrderExists()` after a `synced`
result before trusting it: `ok` → synced as before; `not-found` (genuine
non-network error) → `conflict`; `unverified` (network/timeout, 3
attempts w/ backoff) → left `pending`, retries next cycle (commit is
idempotent). `models/Order.js` gains `offlineOrigin` (Boolean), set by
`syncOfflineSale()`. Folded in per `final.md`'s allowance:
`getDashboardSummary` gets `offlineOrders`; `Dashboard.jsx` gets one more
`StatCard` — flagged, makes that stat row 6 cards not 5, cosmetic only.
Incidental (Hassan-authorized): removed a leftover debug
`console.log('OFFLINE CUSTOMER DEBUG:', …)` in `lib/offlineSync.js`,
pre-existing, no functional effect. Verified: root `npm test` 66/66
before/after; boot-tested (`GET /api/products`, `GET /api/orders/:id`,
`GET /dashboard/load` 401 with no token); `frontend` `npm run build`
clean, `npm test` 10/10 unaffected; `oxlint` 0 errors on all seven
touched/added files. Known/open: no live browser — the 60s delay,
overlay timing, and verify/backoff path are code-reviewed only, not
exercised end-to-end; recommend a manual offline→online check once
merged. `offlineOrigin`/"Offline Sales" figure are schema-checked only,
no live Mongo. `unverified` intentionally leaves a sale `pending` rather
than `conflict` (by design) — flagging for awareness, not a defect.

**2026-08-26 — Stage 14 complete (condensed).** Exchange process
improvements. Confirmed pre-existing and untouched: store-credit-only
on edit, the "Revised" receipt's full edit-history table. New:
`applyLineAddition()` (`routes/orders.js`) adds a new line during an
exchange via checkout's own FIFO/price logic, `editHistory.action`
gains `'add'`; `POST /customer/create` (upsert-style) +
`POST /api/order/:orderID/convert-customer` reattach a walk-in order to
a real customer; `Orders.jsx` gained "Convert to customer" and "Add a
new item" panels. Incidental: removed an unused `isValidDiscount`
import in `routes/orders.js`. Verified: `npm test` 66/66, boot-tested,
`frontend` build clean, `oxlint` 0 errors on all five touched files.
Known/open: no live Mongo/browser — FIFO on an added line and the
walk-in→customer credit landing are code-reviewed only; added lines
never apply a discount (out of scope, not requested).

**2026-08-26 — Stage 15 complete (condensed).** Deduct Stock batch
selection when cost differs. `lib/costing.js`: new
`consumeSpecificBatch(productID, batchId, quantity, session)` — draws
from one named batch only (guarded atomic decrement, same pattern as
`consumeFIFO`), capped to its own `quantityRemaining`; separate function,
not a mode flag on `consumeFIFO` — checkout/offline sync still call
`consumeFIFO` unconditionally. New `listRemainingBatches(productID)`
(oldest-first). `routes/products.js`: new `GET
/api/product/:productID/batches` (admin-only); `POST .../deduct-stock`
takes an optional `batchId`, branches to `consumeSpecificBatch` when
present else `consumeFIFO` (unchanged default, existing callers
unaffected). `Products.jsx`: Deduct Stock fetches batches on selection;
picker only renders when 2+ *distinct* `unitCost` values remain (a
single cost, even split across batches, stays fully automatic, no
picker — matches Stage 9). Verified: `npm test` 66/66, boot-tested
(`GET .../batches`, `POST .../deduct-stock` both 401 with no token),
`frontend` build clean, `oxlint` 0 errors on all four touched files.
Known/open: no live Mongo/browser — picker appearance and the resulting
`Loss`/supplier-credit `costValue` matching the chosen batch exactly are
code-reviewed only; recommend restocking one product twice at two
different costs (picker should appear) and a different product twice at
the same cost (picker should not) once merged.

**Stage 16 complete (2026-08-29, condensed).** Raised directly by
Hassan, frontend-only, three parts. 16a: `Suppliers.jsx`'s purchase-
history `Balance` column split into `Status` (`Due`/`Credit`/`Settled`)
+ a separate `Credit Used` column — relabeled/split only, same fields,
no calculation touched. 16b: `Orders.jsx`'s per-item Refund picker
replaced with a single **Refund Full Order (Cash Back)** action
(`settlement: 'cash'`, already hardcoded); "Edit"/"Add item" relabeled
**Exchange — ... (Store Credit)** (backend already credit-only);
printed Revised Receipt now labels each edit-history row `Exchange —
Store Credit`/`Cash Back`/`—` to match. 16c: `Billing.jsx`'s "Special
Bill" button/modal/handler removed entirely. Incidental: removed a
leftover debug `console.log` in `Orders.jsx`'s refund handler. Verified:
build/`oxlint` clean on all three files, boot-tested (5 routes all 401
with no token), `npm test` 66/66, `frontend npm test` 10/10. Known/open:
no live browser — code-reviewed only.

**Stage 17 complete (2026-08-29, condensed).** App-wide friendly
offline/unreachable-server handling, raised after killing the backend
while the frontend dev server stayed up. Confirmed already-correct and
untouched: `AuthContext.jsx` never force-logs-out on a connectivity
failure (only a genuine 401 does); Billing's offline-queue fallback
(`isNetworkError`, `err instanceof TypeError`) already survives
backend-down-network-up. The actual gap: raw "Failed to fetch" text
everywhere, no shared offline signal outside Billing. New
`lib/networkStatus.js` (pub-sub, mirrors `subscribeAutoSync`);
`lib/api.js`'s `request()`/`downloadExport()` now call `markOffline()`
on a raw fetch failure (relabeling `.message` on the *same* `TypeError`
object — critical, so `isNetworkError()`'s type check keeps matching)
and `markOnline()` on any response at all; new
`NetworkStatusBanner.jsx` mounted next to `SyncOverlay`. Verified:
build/`oxlint` clean on all 4 touched/added files, `frontend npm test`
10/10 (confirms the `TypeError` check still holds), `npm test` 66/66.
Known/open: no live browser — banner behavior against a real killed
backend is code-reviewed only.

**Stage 18 complete (2026-08-29, condensed).** Thermal receipt printing
(ESC/POS over Web USB) with manual-print fallback. Confirmed via chat:
USB (not Serial), plain Chrome/Edge tab for now (not Electron, not
built yet). New `frontend/src/lib/thermalPrint.js`:
`pairThermalPrinter()` (click-triggered one-time `navigator.usb.
requestDevice` pairing) vs. silent `getPairedPrinter()`/
`tryThermalPrint(data)` (`navigator.usb.getDevices()`, never prompts) —
builds raw ESC/POS bytes and writes via `transferOut`; resolves `false`
(never throws) on any failure so the caller always has a clean fallback
signal. `Billing.jsx`: new header "Connect Thermal Printer" button;
`printReceiptFor()` is now `async`, tries `tryThermalPrint()` first,
falls through to the unchanged `printReceipt()` popup on `false`.
`Orders.jsx`'s separate receipt print untouched. Verified: build/
`oxlint` clean on both touched/added files, `frontend npm test` 10/10,
`npm test` 66/66 (backend untouched, frontend-only stage). Known/open:
no live USB hardware in this sandbox — pairing and ESC/POS output are
code-reviewed only; recommend pairing a real printer and testing both
the print and no-printer-fallback paths once merged. Exact ESC/POS
command compatibility may need tuning per printer model.

**2026-08-29 — Stage 19 complete.** Overpayment prompt: change back vs.
customer balance. Raised directly by Hassan, same session as Stage 18.
Two open questions confirmed via chat before starting: a walk-in sale
always gets change, no prompt (no account to credit); an offline sale
that overpays and syncs later always defaults to change (matches
today's behavior — cashier isn't present at sync time). Confirmed the
existing behavior first: `routes/billing.js`'s draft-commit handler
already deliberately capped `amountPaid` at `netOwed`, discarding any
excess as unpersisted "change" — an explicit prior decision, not a bug.
New: `models/PendingBill.js` gets `overpaymentChoice` (`'change'|
'balance'`, default `'change'`), carried in the draft the same
tamper-resistant way as `paidInput`/`paymentMethod` rather than a
trusted request param. `POST /billing/draft` accepts/validates it with
the same quiet-default-on-bad-value pattern as `paymentMethod`. The
draft-commit handler (`POST /billing/orderDetails`) computes
`overpaidAmount = paidInput - netOwed` and, only when the sale isn't
walk-in, the amount is positive, and `draft.overpaymentChoice ===
'balance'`, adds it onto the existing `newCreditBalance` write inside
the same transaction that already handles credit auto-apply — so it's
one write to `Customer.creditBalance`, not two. `Billing.jsx`: new
`chooseOverpaymentSettlement(amount)` — a `sonner` toast with `action`
("Add to Balance") and `cancel` ("Give Change") buttons, resolving a
Promise; only shown in `handleGenerateBill` when `paidNum > total`, the
customer isn't the `WALKIN_CUSTOMER` sentinel, and the app doesn't
already look offline (`!offlineSyncEnabled || isOnline`) — the exact
default-to-change confirmed above. The choice is threaded through
`saveDraftNow()`'s new 4th param into the draft before `api.saveOrder()`,
and into `printReceiptFor()`'s new 4th param, which now labels the
settlement line "Added to Customer Balance" instead of "Change" only
when that's genuinely what happened. The offline-queue fallback call
site always passes `'change'` explicitly regardless of what was chosen,
since offline sync never applies balance credit — keeps the printed
slip honest. **Incidental (in the exact functions/lines already being
touched):** several pre-existing comments in `routes/billing.js` and
`Billing.jsx` were labeled "Stage 19" from an old, unrelated numbering
(the walk-in-customer sentinel) and now directly collided with this
stage's own "Stage 19" comments in the same functions — relabeled those
specific lines to drop the stale stage number rather than leave two
different features both claiming to be "Stage 19" in the same file; no
other comment-stripping pass was done. **Affected files:** `models/
PendingBill.js`, `routes/billing.js`, `frontend/src/pages/Billing.jsx`.
Verified: `frontend` build clean, `oxlint` 0 errors on all three touched
files, `frontend npm test` 10/10, root `npm test` 66/66, backend
boot-tested (`node main.js` with a real `.env`, no live Mongo in this
sandbox) — `POST /billing/draft` and `POST /billing/orderDetails` both
401 with no token, `POST /billing/draft` with a well-formed body
including `overpaymentChoice: "balance"` and a garbage token also 401
(parses fine, rejected by auth as expected, confirming the new field
doesn't break request parsing/validation ordering). Known/open: no live
browser and no live MongoDB replica set in this sandbox — the toast
prompt's actual appearance/button behavior, the transaction correctly
crediting `creditBalance`, and the printed receipt's two labels are
code-reviewed only; recommend once merged: ring up a real customer sale,
overpay it, confirm the toast appears with both choices, pick "Add to
Balance" and confirm that customer's balance increased by exactly the
overpaid amount and the receipt says so; repeat choosing "Give Change"
and confirm nothing changed on the account; confirm a walk-in overpay
never shows the prompt.
