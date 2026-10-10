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
- Overlays the app can't model (special use districts, Family Zoning Plan R-4 heights, SB 9, state density bonus, slope) are detected and flagged, never silently ignored.

## Stack

| Layer | Choice |
|---|---|
| App shell | Vite + React + TypeScript (`apps/web`) |
| Map | MapLibre GL JS; parcel outlines as one static PMTiles file built with tippecanoe |
| 3D | Three.js via react-three-fiber + drei |
| Booleans | manifold-3d (WASM) |
| Projection | proj4, EPSG:2227 (CA State Plane III, US survey feet), plus turf |
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
pnpm dev          # web app dev server
pnpm build        # web app production build
```

## Folder map

The monorepo lives at the repo root (SPEC.md's tree shows it under `zoning-envelope/`).

```
SPEC.md, CLAUDE.md
apps/web/                       # React app: map, scene, cards, controls
packages/engine/                # @zoningviz/engine — pure TS: resolve rules, build solids, measure
  src/geometry/                 # projection, lot lines, cuts, slicing
  src/rules/                    # rule kind -> allowed-region builder
  test/fixtures/                # fixtures A–D with expected numbers
packages/jurisdictions/         # @zoningviz/jurisdictions
  sf/adapter.ts                 # DataSF queries, field mapping (Phase 1)
  sf/districts/<CODE>.json      # one rule file per district
scripts/build-tiles.ts          # parcels -> PMTiles (Phase 5)
```

New jurisdictions add `packages/jurisdictions/<city>/` (adapter + districts). The engine and the animation must not change to support them.

## Data (San Francisco, DataSF Socrata, no key)

Base: `https://data.sf.gov/resource/<id>.json` or `.geojson` (formerly data.sfgov.org; same IDs).

| Layer | ID | Use |
|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | blklot, mapblklot, zoning_code, zoning_district, shape, active, address fields, centroid lat/lon |
| Zoning Districts | `3i4a-hu95` | Map overlay; cross-check blank zoning |
| Height and Bulk Districts | `h9wh-cg3m` | Height cap and bulk via point-in-polygon; parcels straddling two districts keep both and split the envelope |

Condo parcels stack: group by `mapblklot` so a click picks the land, not a unit. Show each dataset's as-of date on the fact card.

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
  effectiveDate: string;         // ISO date the cited text took effect
};
```

| Kind | Effect on volume | Params seen in SPEC.md |
|---|---|---|
| `info` | none; card only | — |
| `height_cap` | horizontal cut | `{ source: "heightDistrict" }` or `{ feet }` |
| `rear_yard` | vertical cut parallel to rear line | `{ pctOfLotDepth, minFeet, appliesAt }` |
| `front_setback` | vertical cut parallel to front line | `{ method: "block_average", maxFeet, userOverride }` |
| `side_yard` | vertical cuts along side lines (RH-1(D)) | Phase 5 |
| `sky_plane` | angled cut rising from a line | `{ fromLine, startHeightFeet, angleDeg }` |
| `bulk` | caps plan dimensions above a height | Phase 6 |
| `far` | volume budget, shown as a gauge | Phase 6 |
| `flag` | not modeled; card says what's missing and why | — |

The engine resolves params against the parcel into numbers and a sentence before any geometry runs ("Rear yard: 30% of 100 ft = 30 ft"). When two height caps apply, the lower cuts and the higher shows "already satisfied."

**Open item for Phase 2:** SPEC.md's RH-2 example omits `plain`, `url`, `effectiveDate` (and `params` on info/flag rules), which the schema requires. Ask the user how to fill these rather than inventing them.

## Geometry engine (summary)

Project parcel to EPSG:2227 feet, recentered on centroid → find front lot line (edges bordering no parcel and facing a street; corner/through lots prompt the user) → measure depth (front line to farthest point along inward normal) and width (front line length) → starting block = footprint extruded to 2x mapped height → resolve rules → for each geometric rule, `next = prev ∩ allowed`, `removed = prev − next` (manifold-3d) → measure each step → slice floors at 10 ft floor-to-floor (adjustable), plate area at mid-story.

Output: ordered steps, each with solid before, removed solid, solid after, measurements and the resolved card sentence. All solids are computed up front; the animation only replays them.

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

## Phase status

- [ ] Phase 0 — Kickoff (repo and CLAUDE.md done; Phase 1 plan awaiting approval)
- [ ] Phase 1 — Data (DataSF adapter, `pnpm parcel <blklot>`)
- [ ] Phase 2 — Engine (fixtures A–D, invariants)
- [ ] Phase 3 — Scene (step through with Next/Back)
- [ ] Phase 4 — Animation (GSAP timeline, scrubber)
- [ ] Phase 5 — Map and coverage (PMTiles, map screen, RH-1(D)/RH-1/RH-3 drafts)
- [ ] Phase 6 — Depth (one item per session)
