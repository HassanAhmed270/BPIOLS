# deployment-progress.md

Append-only progress log for the deployment phase (`deployment.md`,
Stage 16+). See `CLAUDE.md` for document authority and conventions.

---

## Stage 16 — Backend cross-origin support — COMPLETE

**Changed:**
- Added `cors` npm package (`package.json`/`package-lock.json`).
- New `lib/cors.js`: builds `corsOptions` from `ALLOWED_ORIGINS` (comma-
  separated env var). Requests with no `Origin` header (same-origin,
  curl, Electron's main process) always pass; an origin not in the list
  is rejected (no CORS headers granted, so a browser blocks it).
- `main.js`: applies `cors(corsOptions)` globally, first in the
  middleware chain, before all routes.
- `.env.example`: documented `ALLOWED_ORIGINS`, defaults to empty
  (same-origin production serving needs nothing set).
- No changes to authentication, authorization, route behavior, or
  business logic. Auth is Bearer-token based (no cookies), so
  `credentials: true` was intentionally not enabled.

**Verified:**
- Backend boots cleanly with a real `.env` (`node main.js`).
- Preflight `OPTIONS` from an allowed origin
  (`Origin: http://localhost:5173`) returns
  `Access-Control-Allow-Origin: http://localhost:5173`.
- Preflight `OPTIONS` from a disallowed origin
  (`Origin: http://evil.example.com`) gets no
  `Access-Control-Allow-Origin` header — blocked client-side.
- Requests with no `Origin` header (curl, same-origin) pass through
  untouched and hit normal route validation.
- Confirmed no interference with the existing Vite dev proxy (`frontend/
  vite.config.js`), which keeps local dev same-origin from the browser's
  perspective; `ALLOWED_ORIGINS` is purely additive for Electron/direct
  cross-origin cases.
- Full `npm test`: 66/66 passing.

**Not verified (known limitations):**
- No live MongoDB replica set in the sandbox — boot test confirms route
  mounting, middleware order, and pre-DB auth/validation only, not
  full DB-backed request flows.
- Not tested against an actual Electron renderer origin yet (Stage 17
  will introduce the real Electron shell and its origin/scheme, which
  should be added to `ALLOWED_ORIGINS` at that point).
- No real hosted frontend URL exists yet to test the "future hosted
  client" path end-to-end; only the env-driven mechanism was verified.

**Flagged, not part of this stage (incidental note):**
- A stray `bpiols-stage17.bundle` file exists at the repo root, unrelated
  to Stage 16's affected areas and to this deployment phase's own
  Stage 17. Recommend Hassan remove it or confirm its purpose before the
  next stage, rather than it being silently deleted here.

---
