# SnapTrack — Yogabar Logistics Tracker

## Where this project stands

This app was built and tested inside a Claude.ai conversation, hosted as a published
Claude Artifact. It currently works end-to-end (login, roles, trip workflow, dashboard,
analytics, delay-reason capture, i18n, backup/restore) but its data layer is
`window.storage`, an API that **only exists inside Claude's artifact sandbox**. It will
not work once deployed anywhere else.

This folder is the migration to a real, independently-hosted backend:
**Cloudflare Pages (frontend) + Cloudflare Pages Functions (API) + D1 (database).**

## What's already done

- `schema.sql` — full D1 database schema, with the same default vehicles/locations/delay
  reasons the Claude version shipped with. Already tested for valid SQL syntax.
- `functions/api/[[path]].js` — a complete REST API covering every operation the frontend
  needs: setup, login (PBKDF2-hashed passwords, signed session tokens), CRUD for vehicles/
  locations/delay reasons/users/settings, and trip lifecycle endpoints (create, advance
  step with server-side role+location permission checks, delay-reason capture). Syntax-
  checked, not yet deployed or integration-tested against a live D1 instance.
- `index.html` — **this is still the original Claude-artifact version.** It contains every
  screen, every role, every feature already fully built and UI-complete, but all its data
  calls go through `sGet()`/`sSet()` wrappers around `window.storage`, which won't work
  outside Claude.

## What's left to do (this is the task)

1. **Rewrite the storage layer in `index.html`.** Every call to `sGet(key, shared)` /
   `sSet(key, value, shared)` needs to become a `fetch()` call to the matching endpoint in
   `functions/api/[[path]].js`. The UI, CSS, and business logic (trip state machine, i18n,
   analytics calculations) should NOT need to change — only how data gets in and out.
   Specifically:
   - Login/setup screens → `POST /api/setup`, `POST /api/login`. Store the returned
     token (e.g. in a JS variable + `sessionStorage`, which is fine now — the
     "never use browser storage" rule was a Claude-artifact-specific sandbox restriction
     that no longer applies once this is a normal hosted web app).
   - App boot → `GET /api/bootstrap` (returns vehicles, locations, delayReasons, settings,
     users) + `GET /api/trips?from=&to=&vehicleId=` for the trip data each view needs.
   - Every mutation (advanceTrip, startTrip, logArrival, admin CRUD, delay-reason submit)
     → the matching `POST`/`PATCH`/`DELETE` endpoint, sending the Bearer token from login.
   - Client-side permission checks can stay (fast UI feedback) but the API already
     re-checks them server-side — that's intentional and more secure; don't remove either.

2. **Test locally**, then deploy:
   - `npx wrangler d1 create snaptrack-db`, then
     `npx wrangler d1 execute snaptrack-db --file=schema.sql`
   - `npx wrangler pages dev .` to test the whole thing locally (serves `index.html`
     and runs the Functions API together, same as production will).
   - Push to GitHub, connect the repo to Cloudflare Pages, bind D1 as `DB`, set the
     `AUTH_SECRET` environment variable, deploy.

3. **Verify** by walking through: first-run admin setup → create a user of each role →
   log a full trip start-to-finish as an operator → confirm a delay-reason prompt appears
   when a step is deliberately slow → check Dashboard/Analytics/Reports render correctly.

## Do not change

The workflow, roles, permission model, i18n system, and visual design were all
deliberately designed and iterated on with the client — treat them as the spec, not as
a first draft to redesign.
