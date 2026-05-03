# Run 0001

## First Impressions
Random Walk is a single-service Express + React/TypeScript app that helps users discover random places to visit within a configurable radius of a home address, sourced from OpenStreetMap (Overpass + Nominatim). Backend is Node/Express with Prisma ORM over SQLite; frontend is React + Vite + Tailwind. Auth uses JWT + Argon2id with admin/user roles.

Key surfaces I familiarised myself with:
- **Schema** (`backend/prisma/schema.prisma`): `User`, `Place` (with `VisitStatus` enum: AVAILABLE / PLANNED / VISITED / IGNORED), and a generic key/value `Setting` table — most app config lives here as JSON-encoded values (search categories, search ranges, Nominatim contact, etc.).
- **Place lifecycle**: places are seeded via Overpass for several radii × categories, deduped by `osmId` and coords, then status-tracked in DB. `places.ts` exposes plan/unplan/visit/unvisit/ignore/unignore endpoints, plus `/random`, `/discover` (returns places with metadata + `shouldGenerateMore`), and an SSE `/generate-comprehensive` for OSM ingestion with progress streaming.
- **Categories**: configurable through `categoryConfig` service / `routes/categories.ts`, defaulting to PARK / TOURIST_ATTRACTION / TOWN / CITY / PLAYGROUND, each with a list of OSM `key=value` filters.
- **Frontend pages**: `Home.tsx` (search/discover + planned/available lists), `Places.tsx` (visited + ignored), `Admin.tsx` (1.4k LOC — settings, categories, ranges, users, generation, exports). Distance unit (miles vs km) is user-selectable.
- **Last run** (per recent commits): UI tweaks for OSM header config, category modification, and category list on Home; build fixes; example JWT secret env var. Tree is clean, branch is `main`.

## Plan
Awaiting feature direction from the user. Once they describe the changes, I'll plan integration tests alongside the implementation.

## Work Log
- Read README, SPEC, schema, app/router wiring, places routes, categories service, OSM ingestion service, Home/Places/Admin frontends.
- Feature 1: minimum-spacing search filter.
  - Backend: added `selectSpacedPlaces` helper in `backend/src/routes/places.ts` and applied it in `/api/places/discover` after the existing distance/category/text filtering. Greedy: shuffle, then keep candidates that are ≥ `minSpacingMiles` from any already-kept place.
  - Frontend: added `minSpacing` state on `Home.tsx` (persisted to `localStorage.selectedMinSpacing`, default 0.5 in the user's current unit), numeric input between "Number of Places" and "Categories", value converted to miles before posting.
  - Tests: 3 unit tests for `selectSpacedPlaces` covering disabled-spacing, drop-too-close, and count-cap cases.
- Test infrastructure repair (so AI helpers can run the suites):
  - Backend Jest: added a `moduleNameMapper` rule (`^(\\.{1,2}/.*)\\.js$` → `$1`) to strip `.js` from relative imports — required because `package.json` declares `"type": "module"` and source files use ESM-style `.js` suffixes that ts-jest in CJS mode can't resolve. Was failing pre-existing on `main`.
  - Frontend Vitest: switched the test environment from `jsdom` (missing as a dep) to `happy-dom` (added as a devDependency). jsdom 27 has CJS/ESM interop issues with Vitest 1.x; happy-dom is lighter and Vitest-recommended.
  - Layout test: stubbed `useAuth` via `vi.mock` and switched the nav assertions to `getByRole('link', ...)` to disambiguate the "Admin" nav link from the "Admin" role badge.
  - SetupWizard test: replaced the `window.fetch` mock with `vi.mock('axios')`; updated the multi-step test to fill the now-required Nominatim contact email and to walk the current four-step flow (clicking "Next: Generate Places" then "Skip for now" to trigger `onComplete`).
- Feature 2: opt-in re-suggestion of visited places + freeform notes.
  - Schema: added nullable `notes String?` column to `Place`. New migration `20260503175336_add_place_notes` generated; SQL is just `ALTER TABLE "places" ADD COLUMN "notes" TEXT;`. Existing installs pick this up automatically because `database.ts` runs `prisma migrate deploy` on startup.
  - Backend: new `PATCH /api/places/:id` endpoint (zod-validated, max 2000 chars, empty/whitespace clears the field). `/api/places/discover` now accepts `includeVisited: boolean` and expands the `visitStatus` filter from `'AVAILABLE'` to `{ in: ['AVAILABLE', 'VISITED'] }` when set.
  - Frontend `Home.tsx`: new "Include previously visited places" checkbox, persisted to `localStorage.selectedIncludeVisited`, default off. Tracks `searchResultIds` so VISITED places only show in the suggestions panel when they came back from the latest search; visited results render their notes read-only and gain a "Plan to Visit Again" button alongside "Unmark as Visited".
  - Frontend `Places.tsx`: per-place notes block on both the Visited and Ignored sections, with an inline textarea + Save/Cancel for editing. Notes display whitespace-preserving text and a placeholder "No notes yet."
  - Tests: 4 new backend tests covering the PATCH endpoint (set, clear via whitespace, 404, 400 over length).

## Discoveries
- Settings are a flexible key/value store, so most config additions can ride on the existing Setting model without a migration — new schema fields would require a Prisma migration (only one squashed init migration today).
- `places.ts` already has both legacy `/random` and a richer `/discover` endpoint; `Home.tsx` uses `/discover` and supports the new metadata response shape.
- `enhancePlacesWithGeocode` calls Nominatim per-place, throttled by `nominatimRateLimiter` — anything that adds more lookups will need to respect this.
- `Admin.tsx` is large and monolithic; further additions there will compound size unless we extract subcomponents.

## Summary
[Fill in before committing]
