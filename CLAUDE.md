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
pnpm dev          # web app dev server
pnpm build        # web app production build
pnpm parcel <blklot>              # facts for one SF parcel (also: --at <lon> <lat>, --json, --no-cache)
pnpm envelope <blklot>            # run the engine on a real parcel (--front N, --setback FT, --floor FT, --off id,id, --json)
pnpm record-fixtures [blklot...]  # re-record real parcels as engine test inputs
LIVE=1 pnpm test                  # adds a smoke test against the real DataSF API
```

Dev API responses are cached in `.cache/datasf/` (gitignored).

## Folder map

The monorepo lives at the repo root (SPEC.md's tree shows it under `zoning-envelope/`).

```
SPEC.md, CLAUDE.md
apps/web/                       # React app: map, scene, cards, controls
packages/engine/                # @zoningviz/engine — pure TS + WASM: resolve rules, build solids, measure
  src/envelope.ts               # createEngine() -> computeEnvelope(parcel, district, options)
  src/types.ts                  # ParcelInput (city-agnostic input), EnvelopeResult, Step, Solid
  src/geometry/projection.ts    # proj4 projection, planar areas
  src/geometry/lot.ts           # planar prep, street-side (front) detection, lot frame, width/depth
  src/geometry/manifold.ts      # manifold-3d loading, half-space cuts, mesh export, slicing
  src/rules/schema.ts           # zod schema for district files
  src/rules/resolve.ts          # rule params -> numbers, card sentence, cut (no geometry)
  src/rules/regions.ts          # cut -> allowed region; dimension lines
  test/                         # fixtures A–D, invariants, schema, front detection
  test/fixtures/parcels/        # recorded real parcels (pnpm record-fixtures)
packages/jurisdictions/         # @zoningviz/jurisdictions (depends on engine, never the reverse)
  sf/adapter.ts                 # createSfAdapter(): getParcelByBlockLot, getParcelAt
  sf/datasf.ts                  # dataset IDs, SoQL helpers, EPSG:2227 definition
  sf/heightLabel.ts             # "40-X" / "40//85-R-4" parser; anything else is "unparsed"
  sf/node/cache.ts              # Node-only disk cache (CLI, test replay); never import from browser code
  sf/engineInput.ts             # toParcelInput(parcel, neighbors) -> engine ParcelInput
  sf/cli.ts, sf/envelope-cli.ts # `pnpm parcel`, `pnpm envelope`
  sf/DATA-NOTES.md              # verified fields and query syntax, deviations from SPEC.md
  sf/districts/<CODE>.json      # one rule file per district; register it in sf/districts/index.ts
scripts/record-engine-fixtures.mts  # real parcels -> engine test inputs
scripts/build-tiles.ts          # parcels -> PMTiles (Phase 5)
```

New jurisdictions add `packages/jurisdictions/<city>/` (adapter + districts). The engine and the animation must not change to support them.

## Data (San Francisco, DataSF Socrata, no key)

Base: `https://data.sf.gov/resource/<id>.json` or `.geojson` (formerly data.sfgov.org; same IDs).

| Layer | ID | Use |
|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | blklot, mapblklot, zoning_code, zoning_district, shape, active, address fields, centroid lat/lon |
| Zoning Districts | `3i4a-hu95` | Map overlay; cross-check blank zoning |
| Height and Bulk Districts | `h9wh-cg3m` | `height` label, `gen_hght`, geometry in **`the_geom`** (not `shape`); parcels straddling two districts keep both and split the envelope |

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
| `front_setback` | vertical cut parallel to front line | `{ method: "block_average", maxFeet, userOverride }` |
| `side_yard` | vertical cuts along side lines (RH-1(D)) | Phase 5 (not in the schema yet) |
| `sky_plane` | angled cut rising from a line | `{ fromLine: "front_setback" \| "front_lot_line", startHeightFeet, angleDeg }` |
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
- **Heights:** each zone is cut to its own height (R-4 uses the base). A zone with no readable height is not cut and its card says it isn't modeled.
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

## Phase status

- [x] Phase 0 — Kickoff
- [x] Phase 1 — Data (DataSF adapter, `pnpm parcel <blklot>`; demo parcels 4025007, 0044030, 4276045)
- [x] Phase 2 — Engine (fixtures A–D and invariants pass; `pnpm envelope` for real lots)
- [ ] Phase 3 — Scene (step through with Next/Back)
- [ ] Phase 4 — Animation (GSAP timeline, scrubber)
- [ ] Phase 5 — Map and coverage (PMTiles, map screen, RH-1(D)/RH-1/RH-3 drafts)
- [ ] Phase 6 — Depth (one item per session)
