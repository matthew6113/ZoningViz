# ZoningViz — Zoning Envelope Visualizer

Full spec: `SPEC.md`. This file is the condensed version plus working rules. When the two disagree, SPEC.md wins; flag the conflict to the user.

## Goal

Pick a San Francisco parcel; show in 3D how each zoning rule carves a translucent "potential" block (2x the mapped height) down to the legal building envelope, one rule at a time. Each rule gets a card (plain-English sentence resolved for this lot + code citation), a dimension line, and a red removed volume. Ends with the envelope sliced into floors and running totals (volume, footprint, stories, gross floor area, % of block surviving). The viewer steps through the rules with Next (nothing plays on its own); any rule can be toggled off to see its cost.

Zoning identification is a data lookup (the parcel record carries `zoning_code`; for named NC districts, coded just "NCD"/"NCT", the zoning layer gives the specific code by district name), never an AI judgment.

v1 scope: SF only, districts RH-1(D), RH-1, RH-2, RH-3, flat lots, static browser app with no backend. Phase 6 added sloping ground, RM-1–RM-4 and NC-1/NC-2/NC-3/NC-S; RTO-1, RTO-M and RTO-C followed (2026-10-17), then the first five named NC districts (Excelsior Outer Mission, Geary Boulevard and North Beach NCDs; Mission Street and Valencia Street NCTs) and five more (Inner Sunset, Polk Street, Taraval Street and Union Street NCDs; Hayes-Gough NCT), then five more (Inner Clement, 24th Street – Noe Valley, Mission Bernal and San Bruno Avenue NCDs; Divisadero Street NCT), then five more (Outer Clement, Upper Fillmore and Noriega NCDs; 24th Street – Mission and Upper Market Street NCTs), then five more (Bayview, Pacific Avenue, Haight Street and Castro Street NCDs; Ocean Avenue NCT), then five more (Sacramento Street, West Portal Avenue, Irving Street, Outer Balboa Street and Inner Taraval Street NCDs; drafts). The other named NCD/NCT districts (each with its own control table) aren't covered.

## Working rules

1. **Never invent zoning values.** Every rule value must come from a district JSON file with a citation. Do not hard-code numbers like heights, yard depths or angles in engine or app code. If a value is unknown, use a `flag` rule; do not guess.
2. **The engine package has no browser imports.** `packages/engine` must run in plain Node: no React, Three.js, MapLibre, GSAP, PMTiles, `window` or `document`. Its tsconfig omits the DOM lib, and `test/purity.test.ts` fails on browser-only imports.
3. **Run the tests before saying a phase is done.** `pnpm test` and `pnpm typecheck` must pass. Report failures as failures.

Also:
- Build one phase at a time (see SPEC.md "Build phases"). Don't start a phase until the previous phase's "done when" is true and the user has approved its plan.
- A rule with `verified: false` always shows an "unverified" tag in the UI.
- Red is reserved for removed volume. Never use it for anything else.
- Overlays the app can't model (special use districts, SB 9, state density bonus, cross-slope strips) are detected and flagged, never silently ignored. Every special use district a lot lies in is listed on the fact card as "not modeled"; a few have a note in `sf/specialUse.json` (§249.94 so far) that says what they allow and whether the lot's zoning can use them, held to the same rules as district files (cited, `verified: false` until checked; the §249.94 note is verified). Slope itself is modeled since Phase 6 (§260/§261 from 3DEP ground). R-4 lots show the base envelope by default; the Housing Choice-SF envelope (§206.10) is drawn only when the viewer switches it on.

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
pnpm build        # web app production build (copies public/tiles/sf.pmtiles if built); relative asset paths, so it runs from any folder
pnpm build-demo   # apps/web/dist-demo: hosted demo for static hosts with no outside network (claude.ai artifact): recorded data for the "Try one" lots, tiles as base64 chunks
pnpm e2e          # Playwright browser tests (DataSF, basemap and tiles replayed; LIVE=1 records new DataSF responses)
pnpm build-tiles                  # parcels + zoning -> apps/web/public/tiles/sf.pmtiles (needs tippecanoe; $TIPPECANOE overrides)
pnpm build-tiles --fixture        # small tileset around the demo lots -> apps/web/e2e/fixtures/tiles (committed)
pnpm sweep [--per-district N]     # random lots per covered district through adapter + engine + invariants; --program also runs R-4 lots with Housing Choice-SF on
pnpm parcel <blklot>              # facts for one SF parcel (also: --at <lon> <lat>, --json, --no-cache)
pnpm envelope <blklot>            # run the engine on a real parcel (--front N, --setback FT, --floor FT, --off id,id, --program, --json)
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
  src/state/                    # URL state (?parcel&step&front&setback&off&program&at)
  src/anim/                     # schedule (beat times), GSAP timeline over a plain state object, usePlayer, stills (storyboard steps)
  src/data/                     # loadLot (fixtures or DataSF), lotData (the requests a lot needs), engine hooks
  src/demo/                     # VITE_DEMO build: replayed requests, example-lot search, chunked tiles
  src/scene/                    # react-three-fiber scene; palette.ts holds the only red; capture.tsx renders share images
  src/share/                    # share images: content.ts (captions, links, file names; tested in Node), compose.ts (canvas layout)
  src/ui/                       # fact card, rule cards (eye toggles), player controls (Back, Next, step dots), HUD, summary, share buttons
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
  test/                         # fixtures A–Y (far: RM/NC, bulk, localProgram: Housing Choice-SF, rto, namedNc), invariants, schema, front detection, terrain
  test/fixtures/parcels/        # recorded real parcels (pnpm record-fixtures)
packages/jurisdictions/         # @zoningviz/jurisdictions (depends on engine, never the reverse)
  sf/adapter.ts                 # createSfAdapter(): getParcelByBlockLot, getParcelAt, getNeighbors, getBuildings, searchAddresses
  sf/address.ts                 # address labels ("752 4th Ave") and search-query normalization
  sf/zoning.ts                  # zoningCodes ("RH-2|RH-2" -> RH-2), zoningCoverage (covered / not covered / split / unknown)
  sf/specialUse.ts, .json       # notes on special use districts (§249.94) and whether a lot can use them
  sf/tiles.ts                   # tile feature properties and paging queries (the contract between build-tiles and the map)
  sf/datasf.ts                  # dataset IDs, SoQL helpers, EPSG:2227 definition
  sf/heightLabel.ts             # "40-X" / "40//85-R-4" parser; anything else is "unparsed"
  sf/node/cache.ts              # Node-only disk cache (CLI, test replay); never import from browser code
  sf/engineInput.ts             # toParcelInput(parcel, neighbors) -> engine ParcelInput
  sf/cli.ts, sf/envelope-cli.ts # `pnpm parcel`, `pnpm envelope`
  sf/DATA-NOTES.md              # verified fields and query syntax, deviations from SPEC.md
  sf/districts/<CODE>.json      # one rule file per district, named by its code with spaces as hyphens (NCD-NORTH-BEACH.json); register it in sf/districts/index.ts
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
| Zoning Districts | `3i4a-hu95` | Map overlay; cross-check blank zoning; the specific code of a named NC district (`zoning` by `districtna`), since parcels say only "NCD"/"NCT" |
| Height and Bulk Districts | `h9wh-cg3m` | `height` label, `gen_hght`, geometry in **`the_geom`** (not `shape`); parcels straddling two districts keep both and split the envelope |
| Building Footprints | `ynuv-fyni` | Scene context only: outlines with LiDAR `hgt_median_m` (2010 survey); the app shows buildings on the lot's own block |
| USGS 3DEP elevation | ImageServer `getSamples` | Ground for the slope rules and the drawn terrain: 1 m bare-earth LiDAR (survey `CA_SanFrancisco_B23`, 2023-04-20), meters → US survey feet. Takes EPSG:2227 points, ≤ 1,000 per POST, CORS open; about 3% of requests 502, so they're retried. Not DataSF: `elevation.nationalmap.gov` |
| Addresses (EAS) | `ramy-di5m` | Address search: `starts_with(address, …) AND unit_number IS NULL`; numbered streets are zero-padded (`752 04TH AVE`) |
| Special Use Districts | `5yf5-ms5f` | `name`, `url`, `the_geom`: queried with the lot shrunk by 1 ft so districts that only meet its edge are left out; listed on the fact card, never modeled |

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

Verification (every rule in all 41 files: the RH, RM and NC files 2026-10-14; the RTO files, the §249.94 note and the twenty-five named NC districts 2026-10-17): each value was compared with the official Planning Code PDF from amlegal (current through Ord. 131-26), which the user keeps in a private repo (amlegal's terms bar redistributing it; never commit it here), and the user confirmed each batch in chat. A verified rule is dated by the latest ordinance that amended a cited subsection (else the section's latest amendment; a table that only restates a section is dated by that section), and its card shows "in effect since" that date. Rules link to the gocodebook mirror page with the same text. New or changed rules start as drafts (`verified: false`, `effectiveDate: null`; the schema refuses `verified: true` without a date) until checked the same way. VERIFY.md's log lists each batch.

| Kind | Effect on volume | Params seen in SPEC.md |
|---|---|---|
| `info` | none; card only | — |
| `height_cap` | horizontal cut | `{ source: "heightDistrict" }` or `{ feet }` |
| `rear_yard` | vertical cut parallel to rear line | `{ pctOfLotDepth, minFeet, appliesAt: "grade_and_every_story" \| "above_first_story" }` (the second needs an earlier `ground_story` rule; the schema checks) |
| `front_setback` | vertical cut parallel to front line | `{ method: "shallowest_adjacent", maxFeet, userOverride }` (SPEC.md says `block_average`; renamed in Phase 5 with the user's approval because §132(a) since 2024 uses the shallowest adjacent setback) |
| `side_yard` | removes bands along the side lot lines (RH-1(D)) | `{ byLotWidth: [{ minWidthFeet, eachSideFeet } \| { minWidthFeet, totalLotWidthMinusFeet, layout: "one_side" }] }` |
| `sky_plane` | angled cut rising from a line | `{ fromLine: "front_setback" \| "front_lot_line", startHeightFeet, angleDeg, skipWhenRearHigherByFeet? }` (step status `not_applicable` when skipped) |
| `height_reference` | none itself; sets where every height rule measures from (§260) | `{ downslopeCurbDepthFeet, upslopeCurbWithinFeet }` (info card) |
| `height_by_slope` | horizontal cut (on the reference) whose height depends on rear − front ground | `{ baseFeet, steps: [{ rear: "higher" \| "lower", byAtLeastFeet, feet }] }` |
| `ground_story` | none itself; sets the first story's height for `above_first_story` rear yards and floor slicing (NC, §145.1) | `{ minFloorToFloorFeet, exceptions: [{ heightDistrictFeet: [40, 50], minFloorToFloorFeet }] }` (info card; the exception is picked by the mapped height covering most of the lot) |
| `far` | none; a non-residential floor-area budget (ratio × lot area), shown as a gauge against the envelope's floor area | `{ ratio, appliesTo: "non_residential" }` (§124(b): FAR doesn't limit residential uses in R and NC districts) |
| `bulk` | above each zone's bulk height, cuts the envelope to one box that meets the length and diagonal limits (Table 270) | `{ letters: { A: { aboveFeet, lengthFeet, diagonalFeet }, … }, noLimit: ["X"], podiumOnly: { "R-4": 85 } }` (the letter comes from the zone, `HeightZoneInput.bulk`; X and R-4 below the podium → `not_applicable`; other letters → `not_modeled`; the same table is in every file, checked by `sf/test/districts.test.ts`) |
| `local_program` | none itself; when `options.localProgram` is on and a zone has `localProgramHeightFt` (SF: R-4's second number, Housing Choice-SF), that zone's height becomes the program height and later rules are waived or take new params | `{ minHeight: { feet, onCornerLot, lotAreaOverSqFt }, waives: [{ ruleId, because, citation }], replaces: [{ ruleId, params, citation }], assumes, notDrawn }` (waived/replaced ids must be later cutting rules; replacement params are checked against that kind's schema; `minHeight` raises corner lots and lots larger than the area. Card: `not_applicable` without a program height, else `info` saying what it changes) |
| `flag` | not modeled; card says what's missing and why | `{}` |

The schema rejects kinds the engine can't build yet; add the kind to `rules/schema.ts`, `resolve.ts` and `regions.ts` together.

The engine resolves params against the parcel into numbers and a sentence before any geometry runs ("Rear yard: 30% of 100 ft = 30 ft"). When two height caps apply, the lower cuts and the higher shows "already satisfied."

## Geometry engine (summary)

Project parcel to EPSG:2227 feet, recentered on centroid → find front lot line → measure depth (front line to farthest point along inward normal) and width (front line's chord) → starting block = footprint extruded to **2× the mapped height** (decided; the tallest zone on split lots) → resolve rules → for each geometric rule, `next = prev ∩ allowed`, `removed = prev − next` (manifold-3d) → measure each step → slice floors at 10 ft floor-to-floor (adjustable), plate area at mid-story.

- **Front detection:** an edge is street frontage when short probes stepped outward from it land in no neighbor parcel. One street side → it's the front; several (corner, through lots) → `status: "needs_front_choice"` with candidates, and the caller passes `options.frontSide`. Street centerlines aren't used yet, so a lot beside unparcelled land can get an extra prompt.
- **Rear yard** is cut parallel to the front line; irregular lots get the "approximate geometry" note. `above_first_story` (NC-2, NC-3, NC-S) keeps the rear part below the first story's top (on the height reference), assuming a non-residential first story; the first story is drawn at the `ground_story` minimum.
- **Front setback:** `options.overrides[ruleId].feet` (clamped to the rule's max) when the rule allows it; otherwise the rule's maximum (neighbors' setbacks aren't in city data).
- **Side yards:** lot edges that run more front-to-back than across are side lot lines, assigned left/right (seen from the street) by their midpoint. Everything within the yard width of them is removed (a sliver grown with round joins), so bent and angled side lines are followed. The lot width (front chord) picks the row of the district's table. Corner lots get yards on a street side too (open question in VERIFY.md).
- **Heights:** each zone is cut to its own height (R-4 uses the base). A zone with no readable height is not cut and its card says it isn't modeled.
- **Local program (Housing Choice-SF):** with `options.localProgram`, `resolve.planLocalProgram` gives each zone with a `localProgramHeightFt` that height, raised to `minHeight.feet` on a corner lot (two street sides closer to perpendicular than parallel, `lot.isCornerLot`) or a lot larger than `lotAreaOverSqFt`. Those heights replace the mapped ones before anything else, so the start block (2×), the height cut, `ground_story`'s exception and bulk follow. Waived rules get a `not_applicable` step; replaced rules run with the program's params and both citations. Off by default; switched off with its card id in `disabledRuleIds`.
- **Bulk (Table 270):** `regions.planBulk` measures the envelope above each zone's bulk height (on the height reference) across and along the lot frame and corner to corner. If it's too big, it keeps one box: the widest street front the length allows, then the depth the length and diagonal allow, at the front of what's there and centered across. The card says that is one allowed placement. Bulk runs after every yard, setback and plane.
- **Terrain (Phase 6):** `ParcelInput.terrain` holds a fine grid over the lot and a coarse one around it (planar CRS, feet). The engine averages the ground along the front and rear lot lines, puts the curb estimate (ground at the middle of the front line) at z = 0, and builds the `height_reference`: the curb on level/downslope lots; on upslope lots the curb within 10 ft, then the average ground at the two side lot lines of each cross-section. Height cuts are profile solids (depth, z) extruded across the lot when the reference varies; half-spaces otherwise. The starting block is the lot prism minus a heightfield ground solid, up to max(reference) + 2× the mapped height. Footprint is the plan projection. Floors: level slices from the curb (below it too, on downslope lots); on upslope lots stories follow the reference (stepped plates). With a `ground_story` rule the first story above the curb is that tall, then the floor-to-floor height. No terrain → flat, and slope rules use their base values with a note.
- Cuts return `[next, removed]` from one `split` against the allowed region. Never compute removed as prev − next: on terrain both share the ground surface and the subtraction leaves slivers.
- `options.disabledRuleIds` skips rules (Phase 4's toggles). `options.localProgram` switches the district's local program on.

Output (`EnvelopeResult`): ordered steps, each with the rule, status (`cut | already_satisfied | info | not_applicable | not_modeled | disabled`), resolved sentence and numbers, dimension lines, solids before/removed/after (plain `{ volume, positions, indices }` in world feet), and measurements; plus lot info, floors, totals and notes. All solids are computed up front; the animation only replays them.

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
| H | 25 x 100 ft, NC-2, 40-X, flat | 10 ft first story (40/50-ft exception); rear yard 25 ft from 10 ft up; 81,250 cu ft; floors 2,500 + 3 × 1,875 = 8,125 sq ft; FAR 2.5 budget 6,250 sq ft |
| I | 25 x 100 ft, NC-2, 65-A, flat | 14 ft first story; 130,625 cu ft; stories 0–14, then 10 ft to 64; 11,875 sq ft |
| J | 25 x 100 ft, RM-1, 40-X, flat, no setback | 30 ft rear yard at every level; 70,000 cu ft; 4 × 1,750 = 7,000 sq ft; FAR 1.8 budget 4,500 sq ft |
| K | 50 x 150 ft, RM-4, 65-A, flat, no setback | 112.5 ft deep above 40 ft > 110 ft length: 50 × 110 ft box; removes 3,125 cu ft; 362,500 cu ft; floors 4 × 5,625 + 2 × 5,500 = 33,500 sq ft |
| L | 105 x 100 ft, RM-4, 65-A | 105 × 75 ft above 40 ft: diagonal 129 > 125; depth → √(125² − 105²) = 67.8 ft |
| N | 25 x 100 ft, RM-4, 65-N | 50 ft length limit: 75 → 50 ft deep above 40 ft; removes 15,625 cu ft |
| O | 25 x 100 ft, RH-2, 40//40-R-4, Housing Choice-SF on, no setback | Dwelling cap and front plane waived: 68,750 → 70,000 cu ft; 4 × 1,750 = 7,000 sq ft |
| P | 25 x 100 ft, RH-1, 40//40-R-4, on | 35 ft §261 cap waived: 60,937.5 → 70,000 cu ft; 5,250 → 7,000 sq ft |
| Q | 25 x 100 ft, NC-2, 40//65-R-4, on | 65 ft from a 130 ft block; 14 ft first story; 18 ft rear yard above it; 139,550 cu ft; 2,500 + 5 × 2,050 = 12,750 sq ft; bulk doesn't apply (85 ft podium) |
| R | 100 x 100 ft, RH-2, 40//40-R-4, on | Larger than 8,000 sq ft: 65 ft; 455,000 cu ft; 6 × 7,000 = 42,000 sq ft (275,000 and 27,500 without) |
| S | 80 x 100 ft, RH-2, 40//40-R-4, on | Exactly 8,000 sq ft, not larger: stays 40 ft; 224,000 cu ft |
| T | 25 x 100 ft, RH-2, 40//40-R-4, on, streets front and left | Corner lot: 65 ft; 113,750 cu ft. Streets front and rear (through lot): stays 40 ft |
| U | 25 x 100 ft, RTO-C, 40-X, flat, no setback | 25 ft rear yard at every level (no first-story height for RTO-C); 75,000 cu ft; 4 × 1,875 = 7,500 sq ft; FAR 1.8 budget 4,500 sq ft. RTO-1 and RTO-M: 30 ft yard, 70,000 cu ft |
| V | 25 x 100 ft, RTO-C, 40//65-R-4, on | 65 ft; program's 18% (18 ft) rear yard at every level; 133,250 cu ft; 6 × 2,050 = 12,300 sq ft. RTO-1 keeps its 30% yard: 113,750 cu ft |
| W | 25 x 100 ft, NCT-MISSION, 40-X, flat, no setback | 14 ft first story (NCTs have no 40/50-ft exception); rear yard 25 ft from 14 ft up; 83,750 cu ft; stories 0–14, 14–24, 24–34, 34–44 (counted: its middle is under 40 ft): 2,500 + 3 × 1,875 = 8,125 sq ft. North Beach, Excelsior and Geary at 40-X: fixture H's 81,250 cu ft |
| X | 25 x 100 ft, NCD-INNER SUNSET, 40-X, flat, no setback | Rear yard 25 ft at grade and every story (§134(d)(1)); 10 ft first story; 75,000 cu ft; 4 × 1,875 = 7,500 sq ft; FAR 1.8 budget 4,500 sq ft. With Housing Choice-SF at 40//65-R-4: the program's 18% yard above the first story, fixture Q's 139,550 cu ft. Polk, Taraval and Union at 40-X: fixture H's 81,250; Hayes-Gough NCT: fixture W's 83,750 |
| Y | 25 x 100 ft, NCT-UPPER MARKET, 40-X, flat, no setback | Rear yard 25 ft at grade and every story (§134(d)(4)) under a 14 ft first story; 75,000 cu ft; stories 0–14, 14–24, 24–34, 34–44: 4 × 1,875 = 7,500 sq ft; FAR 3.0 budget 7,500 sq ft. Outer Clement at 40-X: fixture X's 75,000; Upper Fillmore and Noriega: fixture H's 81,250; 24th Street – Mission NCT: fixture W's 83,750 |

Real lots recorded for the invariants, with their 3DEP terrain: 4025007, 4025006, 4276045, 0044030 (RH-2), 2687029 (RH-1(D), irregular, falls 35.5 ft from the street), 1646023 (RH-1, also run as RH-1(S)), 0982019 (RH-3), 0072050 (RM-1), 0065024 (RM-2), 0191023 (RM-3), 0224032 (RM-4, corner), 1446048 (NC-1), 2516021 and 3593008 (NC-2; 2516021 rises from the street), 0496004 (NC-3), 1018019 (NC-S, corner), 0872013 (RTO-1, 85//85-R-4), 3597019 (RTO-M), 0493016 (RTO-C, corner, 40//65-R-4), 6013018 (NCD-EXCELSIOR), 1070003 (NCD-GEARY BOULEVARD, corner, 50//85-R-4, 10,750 sq ft), 0116010 (NCD-NORTH BEACH, corner), 3569008 (NCT-MISSION, 80-B), 3568002 (NCT-VALENCIA), 0571003 (NCD-POLK, 65//85-R-4), 1738025 (NCD-INNER SUNSET), 2360031 (NCD-TARAVAL, rises from the street), 0531006A (NCD-UNION, corner), 0816012 (NCT-HAYES, through lot, 40-X and 50-X), 1439040 (NCD-INNER CLEMENT), 6507031 (NCD-24TH-NOE-VALLEY), 6635005 (NCD-MISSION BERNAL, falls from the street), 5982003A (NCD-SAN BRUNO AVENUE, irregular), 1203019 (NCT-DIVISADERO, 65//85-R-4), 1458040 (NCD-OUTER CLEMENT), 0654003 (NCD-UPPER FILLMORE), 2056033 (NCD-NORIEGA), 4211016 (NCT-24TH-MISSION, 65-X), 3563044 (NCT-UPPER MARKET, 75//160-R-4, 10,802 sq ft, two street sides), 2695010 (NCD-CASTRO), 1243031 (NCD-HAIGHT), 0183038 (NCD-PACIFIC), 5326011 (NCD-BAYVIEW, irregular), 6935021 (NCT-OCEAN, 50//85-R-4), 1010012 (NCD-SACRAMENTO), 3012022 (NCD-WEST PORTAL, irregular), 1781044 (NCD-IRVING), 1612024 (NCD-OUTER BALBOA STREET), 2343042 (NCD-INNER TARAVAL STREET). Hillside e2e: 124 Clarendon Ave (downslope, 30 ft; 40 ft under Housing Choice-SF) and 118 Dellbrook Ave 2820020 (upslope +36.9 ft: 40 ft, no front plane). Recorded lots with an R-4 label are also run with Housing Choice-SF on; e2e switches it on at 1345–1347 Clement St (NC-1, 40//65-R-4) and 3249 Webster St (RTO-C, 40//65-R-4).

## Phase status

- [x] Phase 0 — Kickoff
- [x] Phase 1 — Data (DataSF adapter, `pnpm parcel <blklot>`; demo parcels 4025007, 0044030, 4276045)
- [x] Phase 2 — Engine (fixtures A–D and invariants pass; `pnpm envelope` for real lots)
- [x] Phase 3 — Scene (Next/Back through fixture A and real lots; `pnpm e2e` covers it)
- [x] Phase 4 — Animation (one GSAP timeline, per-rule toggles, reduced motion). Changed 2026-10-16 at the user's request: step by step with Next; play/pause, the scrubber and 1×/2× were removed
- [x] Phase 5 — Map and coverage (PMTiles, map screen, RH-1(D)/RH-1/RH-1(S)/RH-3 drafts, side_yard; `pnpm sweep` over random RH lots)
- [x] Phase 6 — Depth (one item per session)
  - [x] Terrain and slope: §260 height reference and §261 slope caps from USGS 3DEP ground; drawn terrain; fixtures F and G
  - [x] FAR districts: RM-1–RM-4 and NC-1/NC-2/NC-3/NC-S drafts, `far` gauge, `ground_story`, rear yards above the first story; fixtures H–J
  - [x] Bulk letters: Table 270 `bulk` rule in every district, one fitting box above the bulk height; fixtures K, L, N
  - [x] Family Zoning Plan local-program unlock: `local_program` rule (Housing Choice-SF, §206.10) in every district, `?program=1` switch on R-4 lots, summary comparison; fixtures O–T
  - [x] Share images: "Save image" (this view with its rule card) and "Storyboard" (a tile per cut, start to result) as PNGs
- [x] Since Phase 6: special use districts listed on the fact card (§249.94 note); RTO-1, RTO-M, RTO-C district files (Table 209.4); fixtures U and V; all verified 2026-10-17
- [x] Named NC districts, batch 1 (2026-10-17): named-district lookup, five district files, fixture W; verified 2026-10-17
- [x] Named NC districts, batch 2 (2026-10-17): Inner Sunset, Polk, Taraval, Union, Hayes-Gough, fixture X; verified 2026-10-17
- [x] Named NC districts, batch 3 (2026-10-17): Inner Clement, 24th Street – Noe Valley, Mission Bernal, San Bruno Avenue, Divisadero NCT; verified 2026-10-17
- [x] Named NC districts, batch 4 (2026-10-17): Outer Clement, Upper Fillmore, Noriega, 24th Street – Mission NCT, Upper Market NCT, fixture Y; verified 2026-10-17
- [x] Named NC districts, batch 5 (2026-10-17): Bayview, Pacific Avenue, Haight Street, Castro Street, Ocean Avenue NCT; verified 2026-10-17
- [ ] Named NC districts, batch 6 (2026-10-17): Sacramento, West Portal, Irving, Outer Balboa, Inner Taraval (drafts, VERIFY.md)

## Web app notes

- **Map:** the app opens on the map (`map/MapScreen.tsx`); a lot opens over it (`.lot-layer`) and the map stays mounted underneath, hidden, so ← Map and browser Back are instant. `?at=lon,lat,zoom` keeps the map view (replaced on moveend, kept while a lot is open). Click or search → `prefetchLot` → `flyTo` (1.2 s, north up, padded so the lot lands where the scene canvas will be) → the lot view fades in when loaded. The map passes its ft-per-pixel (`Handoff`) so the scene's arrival starts overhead and north up at the same scale, then turns to the street view. Reduced motion: no flight.
- MapLibre 6 has no default export (`import { Map } from "maplibre-gl"`), and under Vite its worker must be set explicitly (`setWorkerUrl` with `maplibre-gl-worker.mjs?url`, in `map/tiles.ts`).
- **Hosting:** `.github/workflows/pages.yml` deploys the full app to GitHub Pages (https://matthew6113.github.io/ZoningViz/) on every push to `main`: typecheck and unit tests, tippecanoe built from a pinned commit (cached), `pnpm build-tiles` fresh from DataSF, `pnpm build`. Pages must be set to Source: GitHub Actions, and the `github-pages` environment must list `main` under deployment branches (the repo's default branch is the dev branch, which is all GitHub allows by default). This session's GitHub access can't trigger or re-run workflows; a push to `main` or the Actions page can. `pnpm build-demo` is the offline variant for hosts with no outside network.
- Tiles: `VITE_SF_TILES` (default `tiles/sf.pmtiles`) and `VITE_BASEMAP_STYLE` (default OpenFreeMap positron, no key). The static host must answer HTTP range requests. A missing tiles file shows a "run `pnpm build-tiles`" notice; search still works.
- Hover and click read the parcel tiles' `zoning`; the tint comes from the zoning-district layer. Covered and zoning-less lots open; others (and split-zoned lots) get a popup that says why. Map colors live in `map/style.ts` and must not be red (`map/map.test.ts`).
- e2e: `e2e/map.ts` routes the basemap style to a background-only style and serves the fixture tileset with HTTP 206 range answers; every spec calls `serveMap(page)`.
- Rule cards: only rules that cut volume get the eye toggle (height caps, yards, setbacks, planes, bulk), and not while they don't apply; info, flag, `height_reference`, `ground_story`, `far` and `local_program` cards don't. The `far` card shows a gauge (budget against the final floor area) and the result adds a "Non-residential cap" row. The `local_program` card has a switch (`role="switch"`, `?program=1`) on lots it applies to; while it's on, App runs the engine a second time without it and the summary adds a "Without Housing Choice-SF" row.
- Step positions: 0 = starting block, 1…N = rule N applied (envelope + red removed piece), N+1 = finale (floors + summary).
- **Share images** (`ui/ShareButtons.tsx`, beside ← Map): "Save image" renders the scene as it is (any step, the viewer's camera) 1,600 px wide at the canvas's shape; "Storyboard" renders 640 × 480 tiles for the start, each step with status `cut` and the result, in up to 3 columns. `scene/capture.tsx` resizes the renderer, runs `advance()` (every `useFrame`) and copies the canvas in one task, then puts it back, so nothing flickers and `preserveDrawingBuffer` isn't needed; tiles widen the field of view 1.3× so tall starting blocks fit. `anim/stills.ts` drives the scene's state with a second, target-less timeline to each step's resting point and restores it, so the cards, HUD, step dots and URL never move. The HTML dimension labels are redrawn on the image at `dimensionLabelAnchor` (shared with the scene), nudged apart when they collide. Captions (`share/content.ts`) carry the rule sentence and citation or the result totals, the "unverified" tag, the honesty line, the unverified count, data dates and a link without `at=` (the storyboard's also without `step=`). Phones (coarse pointer) get the share sheet; everything else downloads. Red appears only as the removed-volume swatch.
- Each rule's state switches on 1 ms after its step begins, so a step that begins where the previous one rests (the opening, card-only rules) doesn't change what's on screen at that rest: the start rests on the pale starting block.
- **Animation:** `anim/schedule.ts` sets the beats (arrival 1.5 s, rise 1.2 s; per rule announce 0.6 / measure 0.8 / cut 1.2 / remove 0.9; info/flag/off rules 1.5 s; "already satisfied" = announce + measure). Step *k* rests at the end of rule *k*'s cut, with the red piece showing; the HUD counters tick down during the cut, so a resting step shows its own totals, and the piece lifts away on the next Next. `anim/timeline.ts` builds one GSAP timeline that tweens a plain `AnimState`; the scene reads it in `useFrame` and the HUD is written through refs. React re-renders only when the step changes. Keep it that way: no per-frame React state.
- **Step by step** (`anim/usePlayer.ts`, `ui/PlayerControls.tsx`): nothing advances on its own. Next stops only where the shape changes (`schedule.isStop`: the start, `cut` and `satisfied` segments, the result): it plays the current step's lift, then jumps over card-only steps (`skip`, seeking past them so their cards land) and plays the target's beats to its resting point (`stopAt`); pressed mid-animation it lands that step at once first. Back goes to the previous stop. The step dots (`Go to the start`, `Go to rule n: …`, `Go to the result`; card-only rules get small `.minor` dots) and Home/End jump to any step without animating. → / Space / Page Down = Next, ← / Page Up = Back. `settle()` finishes a running step (share images call it). There's no play button, scrubber or speed toggle.
- **Phones (≤ 860 px):** one column (canvas, controls, then cards). The page keeps the screen's height (`.app` is `100dvh`) and the lot view scrolls inside its layer, which is positioned over the map; an auto-height page collapses that layer and the cards cover the canvas. Rule cards don't auto-scroll there; instead `.step-detail` under the controls (hidden on wider screens) repeats the current rule's sentence, its removed volume and the card-only rules passed over.
- A fresh visit plays the arrival and pauses at the start; `?step=n` opens paused there; `?step` follows the playhead; `?off=` lists rules switched off (engine `disabledRuleIds`); `?program=1` switches the local program on (engine `localProgram`).
- `prefers-reduced-motion` builds a shorter timeline with no camera flight, sweep or lift (crossfades). In Playwright set it with `test.use({ contextOptions: { reducedMotion: "reduce" } })`; a top-level `reducedMotion` option is silently ignored.
- `preserveDrawingBuffer` is on only under automation (`navigator.webdriver`), for the tests' pixel checks. Reading the canvas waits for SwiftShader to finish every queued frame; after switching and scrubbing a heavy lot (1345 Clement St with buildings and terrain) that took 45–65 s in a 4-core container, so `expectSceneDrawn` takes a timeout for such tests.
- Performance: about 1 ms of script per frame during playback. Headless Chromium here renders with SwiftShader (software), so its fps falls with canvas size (60 fps at 640×420, about 16 at 1360×820); that's rasterization, not our code.
- The scene sits in one group rotated from the engine's z-up to three's y-up (`scene/coords.ts`).
- drei `<Html>` labels must go through the scene's `Label` component, which pins them to a stable `portal`. Without it, labels go blank when the canvas's event target changes.
- Playwright is pinned to 1.56.1 to match the pre-installed Chromium (build 1194). Don't upgrade it without a matching browser.
- In this sandbox, `pkill -f "vite preview"` kills the calling shell (it matches its own command line). Use `pkill -f "[v]ite.js preview"`.
