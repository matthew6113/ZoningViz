# ZoningViz — Zoning Envelope Visualizer

Full spec: `SPEC.md`. This file is the condensed version plus working rules. When the two disagree, SPEC.md wins; flag the conflict to the user.

## Goal

Pick a San Francisco parcel; show in 3D how each zoning rule carves a translucent "potential" block (2x the mapped height) down to the legal building envelope, one rule at a time. Each rule gets a card (plain-English sentence resolved for this lot + code citation), a dimension line, and a red removed volume. Ends with the envelope sliced into floors and running totals (volume, footprint, stories, gross floor area, % of block surviving). A scrubber steps through rules; any rule can be toggled off to see its cost.

Zoning identification is a data lookup (the parcel record carries `zoning_code`), never an AI judgment.

v1 scope: SF only, districts RH-1(D), RH-1, RH-2, RH-3, flat lots, static browser app with no backend.

## Working rules

1. **Never invent zoning values.** Every rule value must come from a district JSON file with a citation. Do not hard-code numbers like heights, yard depths or angles in engine or app code. If a value is unknown, use a `flag` rule; do not guess.
2. **The engine package has no browser imports.** `packages/engine` must run in plain Node: no React, Three.js, MapLibre, GSAP, PMTiles, `window` or `document`. Its tsconfig omits the DOM lib, and `test/purity.test.ts` fails on browser-only imports.
3. **Run the tests before saying a phase is done.** `pnpm test` and `pnpm typecheck` must pass. Report failures as failures.

Also:
- Build one phase at a time (see SPEC.md "Build phases"). Don't start a phase until the previous phase's "done when" is true and the user has approved its plan.
- A rule with `verified: false` always shows an "unverified" tag in the UI.
- Red is reserved for removed volume. Never use it for anything else.
- Overlays the app can't model (special use districts, Family Zoning Plan R-4 heights, SB 9, state density bonus, cross-slope strips) are detected and flagged, never silently ignored. Slope itself is modeled since Phase 6 (§260/§261 from 3DEP ground).

## Stack

| Layer | Choice |
|---|---|
| App shell | Vite + React + TypeScript (`apps/web`) |
| Map | MapLibre GL JS; parcel outlines as one static PMTiles file built with tippecanoe |
| 3D | Three.js via react-three-fiber + drei |
| Booleans | manifold-3d (WASM) |
| Projection | proj4, EPSG:2227 (CA State Plane III, US survey feet); `engine/src/geometry/projection.ts` takes the proj definition from the jurisdiction |
| Animation | One GSAP timeline |
| Rules | JSON district files validated with zod |
| Tests | Vitest (root `vitest.config.ts` runs every package as a project) |
| Package manager | pnpm workspaces, Node ≥ 22 |

Libraries are added in the phase that first needs them, not all up front.

## Commands

```sh
pnpm install
pnpm test         # vitest run, all workspace projects
pnpm typecheck    # tsc in every package
pnpm dev          # web app dev server: the map (needs pnpm build-tiles once), or ?parcel=fixture-a / ?parcel=4025007
pnpm build        # web app production build (copies public/tiles/sf.pmtiles if built)
pnpm build-demo   # apps/web/dist-demo: hosted demo for static hosts with no outside network (claude.ai artifact): recorded data for the "Try one" lots, tiles as base64 chunks
pnpm e2e          # Playwright browser tests (DataSF, basemap and tiles replayed; LIVE=1 records new DataSF responses)
pnpm build-tiles                  # parcels + zoning -> apps/web/public/tiles/sf.pmtiles (needs tippecanoe; $TIPPECANOE overrides)
pnpm build-tiles --fixture        # small tileset around the demo lots -> apps/web/e2e/fixtures/tiles (committed)
pnpm sweep [--per-district N]     # random RH lots through adapter + engine + invariants (the "any RH parcel" check)
pnpm parcel <blklot>              # facts for one SF parcel (also: --at <lon> <lat>, --json, --no-cache)
pnpm envelope <blklot>            # run the engine on a real parcel (--front N, --setback FT, --floor FT, --off id,id, --json)
pnpm record-fixtures [blklot...]  # re-record real parcels as engine test inputs
LIVE=1 pnpm test                  # adds a smoke test against the real DataSF API
```

Dev API responses are cached in `.cache/datasf/` and tile inputs in `.cache/tiles/` (both gitignored). The city tileset (about 20 MB) is gitignored too; only the e2e fixture tileset is committed.

## Folder map

The monorepo lives at the repo root (SPEC.md's tree shows it under `zoning-envelope/`).

```
SPEC.md, CLAUDE.md
apps/web/                       # React app: map, scene, cards, controls
  src/App.tsx                   # URL state -> map, or lot -> engine -> scene + cards (lots open over the map)
  src/map/                      # MapScreen (hover, click, search, zoning tint, fly-in), style.ts (layers, colors), tiles.ts (pmtiles + worker setup)
  src/state/                    # URL state (?parcel&step&front&setback&off&at)
  src/anim/                     # schedule (beat times), GSAP timeline over a plain state object, usePlayer
  src/data/                     # loadLot (fixtures or DataSF), lotData (the requests a lot needs), engine hooks
  src/demo/                     # VITE_DEMO build: replayed requests, example-lot search, chunked tiles
  src/scene/                    # react-three-fiber scene; palette.ts holds the only red
  src/ui/                       # fact card, rule cards (eye toggles), player controls + scrubber, HUD, summary
  e2e/                          # Playwright specs; fixtures/datasf = recorded responses, fixtures/tiles = demo-area tiles, map.ts = basemap/tiles routes
packages/engine/                # @zoningviz/engine — pure TS + WASM: resolve rules, build solids, measure
  src/envelope.ts               # createEngine() -> computeEnvelope(parcel, district, options)
  src/types.ts                  # ParcelInput (city-agnostic input), EnvelopeResult, Step, Solid
  src/geometry/projection.ts    # proj4 projection, planar areas
  src/geometry/lot.ts           # planar prep, street-side (front) detection, lot frame, width/depth
  src/geometry/manifold.ts      # manifold-3d loading, half-space cuts, mesh export, slicing
  src/rules/schema.ts           # zod schema for district files
  src/rules/resolve.ts          # rule params -> numbers, card sentence, cut (no geometry)
  src/rules/regions.ts          # cut -> allowed region; dimension lines; cut planes (for the sweep)
  test/                         # fixtures A–E, invariants, schema, front detection
  test/fixtures/parcels/        # recorded real parcels (pnpm record-fixtures)
packages/jurisdictions/         # @zoningviz/jurisdictions (depends on engine, never the reverse)
  sf/adapter.ts                 # createSfAdapter(): getParcelByBlockLot, getParcelAt, getNeighbors, getBuildings, searchAddresses
  sf/address.ts                 # address labels ("752 4th Ave") and search-query normalization
  sf/zoning.ts                  # zoningCodes ("RH-2|RH-2" -> RH-2), zoningCoverage (covered / not covered / split / unknown)
  sf/tiles.ts                   # tile feature properties and paging queries (the contract between build-tiles and the map)
  sf/datasf.ts                  # dataset IDs, SoQL helpers, EPSG:2227 definition
  sf/heightLabel.ts             # "40-X" / "40//85-R-4" parser; anything else is "unparsed"
  sf/node/cache.ts              # Node-only disk cache (CLI, test replay); never import from browser code
  sf/engineInput.ts             # toParcelInput(parcel, neighbors) -> engine ParcelInput
  sf/cli.ts, sf/envelope-cli.ts # `pnpm parcel`, `pnpm envelope`
  sf/DATA-NOTES.md              # verified fields and query syntax, deviations from SPEC.md
  sf/districts/<CODE>.json      # one rule file per district; register it in sf/districts/index.ts
  sf/districts/VERIFY.md        # every drafted value, the section to check, sources, open questions
scripts/record-engine-fixtures.mts  # real parcels -> engine test inputs
scripts/build-tiles.ts          # parcels + zoning -> PMTiles via tippecanoe
scripts/sweep.mts               # coverage sweep over random RH lots
```

New jurisdictions add `packages/jurisdictions/<city>/` (adapter + districts). The engine and the animation must not change to support them.

## Data (San Francisco, DataSF Socrata, no key)

Base: `https://data.sf.gov/resource/<id>.json` or `.geojson` (formerly data.sfgov.org; same IDs).

| Layer | ID | Use |
|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | blklot, mapblklot, zoning_code, zoning_district, shape, active, address fields, centroid lat/lon |
| Zoning Districts | `3i4a-hu95` | Map overlay; cross-check blank zoning |
| Height and Bulk Districts | `h9wh-cg3m` | `height` label, `gen_hght`, geometry in **`the_geom`** (not `shape`); parcels straddling two districts keep both and split the envelope |
| Building Footprints | `ynuv-fyni` | Scene context only: outlines with LiDAR `hgt_median_m` (2010 survey); the app shows buildings on the lot's own block |
| USGS 3DEP elevation | ImageServer `getSamples` | Ground for the slope rules and the drawn terrain: 1 m bare-earth LiDAR (survey `CA_SanFrancisco_B23`, 2023-04-20), meters → US survey feet. Takes EPSG:2227 points, ≤ 1,000 per POST, CORS open; about 3% of requests 502, so they're retried. Not DataSF: `elevation.nationalmap.gov` |
| Addresses (EAS) | `ramy-di5m` | Address search: `starts_with(address, …) AND unit_number IS NULL`; numbered streets are zero-padded (`752 04TH AVE`) |

Verified facts (details in `packages/jurisdictions/sf/DATA-NOTES.md`):
- **R-4 (Family Zoning Plan) labels are `base//local-R-4`. `gen_hght` is the local-program height, not the base.** Never use `gen_hght` as an R-4 cap; the base exists only in the label. Unparseable labels are flagged, not guessed.
- Height districts are found by intersecting the parcel polygon (not the centroid). Overlap shares are computed on the client in EPSG:2227, and districts under 0.1% of the lot are treated as boundary contact.
- Lot area is computed from the parcel shape; the parcel layer has no area field, and the assessor's `lot_area` is too noisy to use as ground truth.
- Condo stacks: units repeat the parent's shape; the land record is `blklot = mapblklot`. Point lookups group by `mapblklot`.
- Show each dataset's as-of date on the fact card (`SfParcel.asOf`).

## Rule JSON schema

One file per district. **The `rules` array order is the animation order.**

```ts
type DistrictFile = {
  jurisdiction: string;          // "sf"
  district: string;              // "RH-2"
  name: string;                  // "Residential, House, Two Family"
  rules: Rule[];
};

type Rule = {
  id: string;                    // unique within the file, e.g. "rear-yard"
  kind: RuleKind;
  title: string;                 // card title
  plain: string;                 // one sentence a layperson understands
  params: object;                // kind-specific, see below ({} for info/flag)
  citation: string;              // "§134(c)(1), §134(d)(1)"
  url: string;                   // link to the code section
  verified: boolean;             // true only after a human checks the code text
  effectiveDate: string | null;  // ISO date the cited text took effect; null only while verified is false
};
```

Decided with the user: missing fields in SPEC.md's RH-2 example are filled as unverified drafts. `effectiveDate` stays `null` until the verification pass because no amendment history could be read (amlegal blocks automated access), and the schema refuses `verified: true` without a date. The `url`s point at amlegal section pages found by search and haven't been opened.

| Kind | Effect on volume | Params seen in SPEC.md |
|---|---|---|
| `info` | none; card only | — |
| `height_cap` | horizontal cut | `{ source: "heightDistrict" }` or `{ feet }` |
| `rear_yard` | vertical cut parallel to rear line | `{ pctOfLotDepth, minFeet, appliesAt }` |
| `front_setback` | vertical cut parallel to front line | `{ method: "shallowest_adjacent", maxFeet, userOverride }` (SPEC.md says `block_average`; renamed in Phase 5 with the user's approval because §132(a) since 2024 uses the shallowest adjacent setback) |
| `side_yard` | removes bands along the side lot lines (RH-1(D)) | `{ byLotWidth: [{ minWidthFeet, eachSideFeet } \| { minWidthFeet, totalLotWidthMinusFeet, layout: "one_side" }] }` |
| `sky_plane` | angled cut rising from a line | `{ fromLine: "front_setback" \| "front_lot_line", startHeightFeet, angleDeg, skipWhenRearHigherByFeet? }` (step status `not_applicable` when skipped) |
| `height_reference` | none itself; sets where every height rule measures from (§260) | `{ downslopeCurbDepthFeet, upslopeCurbWithinFeet }` (info card) |
| `height_by_slope` | horizontal cut (on the reference) whose height depends on rear − front ground | `{ baseFeet, steps: [{ rear: "higher" \| "lower", byAtLeastFeet, feet }] }` |
| `bulk` | caps plan dimensions above a height | Phase 6 (not in the schema yet) |
| `far` | volume budget, shown as a gauge | Phase 6 (not in the schema yet) |
| `flag` | not modeled; card says what's missing and why | `{}` |

The schema rejects kinds the engine can't build yet; add the kind to `rules/schema.ts`, `resolve.ts` and `regions.ts` together.

The engine resolves params against the parcel into numbers and a sentence before any geometry runs ("Rear yard: 30% of 100 ft = 30 ft"). When two height caps apply, the lower cuts and the higher shows "already satisfied."

## Geometry engine (summary)

Project parcel to EPSG:2227 feet, recentered on centroid → find front lot line → measure depth (front line to farthest point along inward normal) and width (front line's chord) → starting block = footprint extruded to **2× the mapped height** (decided; the tallest zone on split lots) → resolve rules → for each geometric rule, `next = prev ∩ allowed`, `removed = prev − next` (manifold-3d) → measure each step → slice floors at 10 ft floor-to-floor (adjustable), plate area at mid-story.

- **Front detection:** an edge is street frontage when short probes stepped outward from it land in no neighbor parcel. One street side → it's the front; several (corner, through lots) → `status: "needs_front_choice"` with candidates, and the caller passes `options.frontSide`. Street centerlines aren't used yet, so a lot beside unparcelled land can get an extra prompt.
- **Rear yard** is cut parallel to the front line; irregular lots get the "approximate geometry" note.
- **Front setback:** `options.overrides[ruleId].feet` (clamped to the rule's max) when the rule allows it; otherwise the rule's maximum (neighbors' setbacks aren't in city data).
- **Side yards:** lot edges that run more front-to-back than across are side lot lines, assigned left/right (seen from the street) by their midpoint. Everything within the yard width of them is removed (a sliver grown with round joins), so bent and angled side lines are followed. The lot width (front chord) picks the row of the district's table. Corner lots get yards on a street side too (open question in VERIFY.md).
- **Heights:** each zone is cut to its own height (R-4 uses the base). A zone with no readable height is not cut and its card says it isn't modeled.
- **Terrain (Phase 6):** `ParcelInput.terrain` holds a fine grid over the lot and a coarse one around it (planar CRS, feet). The engine averages the ground along the front and rear lot lines, puts the curb estimate (ground at the middle of the front line) at z = 0, and builds the `height_reference`: the curb on level/downslope lots; on upslope lots the curb within 10 ft, then the average ground at the two side lot lines of each cross-section. Height cuts are profile solids (depth, z) extruded across the lot when the reference varies; half-spaces otherwise. The starting block is the lot prism minus a heightfield ground solid, up to max(reference) + 2× the mapped height. Footprint is the plan projection. Floors: level slices from the curb (below it too, on downslope lots); on upslope lots stories follow the reference (stepped plates). No terrain → flat, and slope rules use their base values with a note.
- Cuts return `[next, removed]` from one `split` against the allowed region. Never compute removed as prev − next: on terrain both share the ground surface and the subtraction leaves slivers.
- `options.disabledRuleIds` skips rules (Phase 4's toggles).

Output (`EnvelopeResult`): ordered steps, each with the rule, status (`cut | already_satisfied | info | not_modeled | disabled`), resolved sentence and numbers, dimension lines, solids before/removed/after (plain `{ volume, positions, indices }` in world feet), and measurements; plus lot info, floors, totals and notes. All solids are computed up front; the animation only replays them.

## Test invariants (every parcel)

- Volume never increases from one step to the next.
- Start volume − final volume = sum of removed volumes, within 0.1%.
- The envelope never leaves the parcel prism.
- A rule with no effect still gets a card that says "already satisfied."

Fixtures (hand-checked):

| Fixture | Inputs | Expected |
|---|---|---|
| A | 25 x 100 ft, RH-2, 40-X, no front setback | Rear yard 30 ft; footprint 1,750 sq ft; front plane removes 1,250 cu ft; envelope 68,750 cu ft; 4 stories, ~6,875 sq ft floor area |
| B | 25 x 40 ft, RH-2, 40-X | 15 ft minimum governs over 30% (12 ft); footprint 625 sq ft |
| C | Real RH-2 corner parcel | Front prompt appears; invariants pass; no NaN volumes |
| D | Parcel crossing two height districts | Two height cuts, each on its own part of the lot |
| E | 35 x 100 ft, RH-1(D), 40-X, no front setback | 40 ft then 35 ft caps; 3 ft side yards; footprint 29 x 70 = 2,030 sq ft; front plane removes 362.5 cu ft; envelope 70,687.5 cu ft; 3 stories, 6,090 sq ft |
| F | 25 x 100 ft, RH-1, 40-X, no setback, ground falling 25 ft to the rear | 30 ft cap (rear 20+ ft lower); measured from the curb; 67,812.5 cu ft; levels −20…30: 250, 1,250, 1,750 ×3 = 6,750 sq ft |
| G | Same, ground rising 30 ft to the rear | 40 ft cap; front plane doesn't apply; curb within 10 ft, then side-line ground; 69,625 cu ft; 4 stepped stories × 1,750 = 7,000 sq ft |

Real lots recorded for the invariants, with their 3DEP terrain: 4025007, 4025006, 4276045, 0044030 (RH-2), 2687029 (RH-1(D), irregular, falls 35.5 ft from the street), 1646023 (RH-1, also run as RH-1(S)), 0982019 (RH-3). Hillside e2e: 124 Clarendon Ave (downslope, 30 ft) and 118 Dellbrook Ave 2820020 (upslope +36.9 ft: 40 ft, no front plane).

## Phase status

- [x] Phase 0 — Kickoff
- [x] Phase 1 — Data (DataSF adapter, `pnpm parcel <blklot>`; demo parcels 4025007, 0044030, 4276045)
- [x] Phase 2 — Engine (fixtures A–D and invariants pass; `pnpm envelope` for real lots)
- [x] Phase 3 — Scene (Next/Back through fixture A and real lots; `pnpm e2e` covers it)
- [x] Phase 4 — Animation (one GSAP timeline, scrubber, 1×/2×, per-rule toggles, reduced motion)
- [x] Phase 5 — Map and coverage (PMTiles, map screen, RH-1(D)/RH-1/RH-1(S)/RH-3 drafts, side_yard; `pnpm sweep` over random RH lots)
- [ ] Phase 6 — Depth (one item per session)
  - [x] Terrain and slope: §260 height reference and §261 slope caps from USGS 3DEP ground; drawn terrain; fixtures F and G
  - [ ] Bulk letters · FAR districts (RM, NC) · Family Zoning Plan local-program unlock · share images

## Web app notes

- **Map:** the app opens on the map (`map/MapScreen.tsx`); a lot opens over it (`.lot-layer`) and the map stays mounted underneath, hidden, so ← Map and browser Back are instant. `?at=lon,lat,zoom` keeps the map view (replaced on moveend, kept while a lot is open). Click or search → `prefetchLot` → `flyTo` (1.2 s, north up, padded so the lot lands where the scene canvas will be) → the lot view fades in when loaded. The map passes its ft-per-pixel (`Handoff`) so the scene's arrival starts overhead and north up at the same scale, then turns to the street view. Reduced motion: no flight.
- MapLibre 6 has no default export (`import { Map } from "maplibre-gl"`), and under Vite its worker must be set explicitly (`setWorkerUrl` with `maplibre-gl-worker.mjs?url`, in `map/tiles.ts`).
- Tiles: `VITE_SF_TILES` (default `tiles/sf.pmtiles`) and `VITE_BASEMAP_STYLE` (default OpenFreeMap positron, no key). The static host must answer HTTP range requests. A missing tiles file shows a "run `pnpm build-tiles`" notice; search still works.
- Hover and click read the parcel tiles' `zoning`; the tint comes from the zoning-district layer. Covered and zoning-less lots open; others (and split-zoned lots) get a popup that says why. Map colors live in `map/style.ts` and must not be red (`map/map.test.ts`).
- e2e: `e2e/map.ts` routes the basemap style to a background-only style and serves the fixture tileset with HTTP 206 range answers; every spec calls `serveMap(page)`.
- Step positions: 0 = starting block, 1…N = rule N applied (envelope + red removed piece), N+1 = finale (floors + summary).
- **Animation:** `anim/schedule.ts` sets the beats (arrival 1.5 s, rise 1.2 s; per rule announce 0.6 / measure 0.8 / cut 1.2 / remove 0.9; info/flag/off rules 1.5 s; "already satisfied" = announce + measure). Step *k* rests at the end of rule *k*'s cut, with the red piece showing. `anim/timeline.ts` builds one GSAP timeline that tweens a plain `AnimState`; the scene reads it in `useFrame` and the HUD/scrubber are written through refs. React re-renders only when the step changes. Keep it that way: no per-frame React state.
- A fresh visit plays the arrival and pauses at the start; `?step=n` opens paused there; `?step` follows the playhead; `?off=` lists rules switched off (engine `disabledRuleIds`).
- `prefers-reduced-motion` builds a shorter timeline with no camera flight, sweep or lift (crossfades). In Playwright set it with `test.use({ contextOptions: { reducedMotion: "reduce" } })`; a top-level `reducedMotion` option is silently ignored.
- `preserveDrawingBuffer` is on only under automation (`navigator.webdriver`), for the tests' pixel checks.
- Performance: about 1 ms of script per frame during playback. Headless Chromium here renders with SwiftShader (software), so its fps falls with canvas size (60 fps at 640×420, about 16 at 1360×820); that's rasterization, not our code.
- The scene sits in one group rotated from the engine's z-up to three's y-up (`scene/coords.ts`).
- drei `<Html>` labels must go through the scene's `Label` component, which pins them to a stable `portal`. Without it, labels go blank when the canvas's event target changes.
- Playwright is pinned to 1.56.1 to match the pre-installed Chromium (build 1194). Don't upgrade it without a matching browser.
- In this sandbox, `pkill -f "vite preview"` kills the calling shell (it matches its own command line). Use `pkill -f "[v]ite.js preview"`.
