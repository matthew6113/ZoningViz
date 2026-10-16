# Zoning Envelope Visualizer — Claude Code Build Spec

Oct 9, 2026 · @Matthew Huguet

## What it does

Pick any San Francisco parcel and the tool shows, in 3D, how each zoning rule carves a solid block of "potential" down to the legal building envelope. The user watches the code act on the land one rule at a time.

The experience in one pass:

1. **Pick.** Click a parcel on a map or type an address. The parcel highlights.
2. **Identify.** A card states the facts: zoning district (e.g. RH-2), height and bulk district (e.g. 40-X), lot size, lot depth, and any special use district.
3. **Start full.** The camera moves into a 3D scene. The parcel footprint rises as a translucent block well above the legal height. This is "all the space you might imagine using."
4. **Carve.** Each rule takes a turn. Its card appears with the plain-English rule and its code citation, a dimension line draws on the model, and the forbidden volume turns red and falls away.
5. **Land.** The final envelope remains, sliced into floors, with running totals: envelope volume, footprint, stories, gross floor area, and percent of the starting block that survived.

The user steps through the rules one at a time: nothing advances until they press Next, which plays one rule's sequence and stops. They can step back, jump to any step, or toggle any rule off to see what it costs. (Changed at the user's request on 2026-10-16: the original play/pause, scrubber and speed toggle were removed.)

One naming note: "identify its zoning" is a data lookup, not an AI judgment. The parcel record already carries its zoning code, so the lookup is exact.

## Decisions and defaults

The spec assumes San Francisco first, hand-encoded rules, and a browser-only app. Each default below can be swapped without rewriting the architecture.

| Decision | Default | Why |
|---|---|---|
| Jurisdiction | San Francisco only for v1, behind a jurisdiction adapter | DataSF's parcel layer already carries each lot's zoning code, so lookup is a single query |
| Districts covered in v1 | RH-1(D), RH-1, RH-2, RH-3 | These four codes cover about 129,000 of SF's roughly 235,000 parcel records, so most clicks work on day one |
| Rule source | Hand-written JSON per district, each rule citing its Planning Code section | Zoning accuracy cannot depend on an LLM reading code live |
| Role of AI | Optional v2 tool that drafts rule JSON from code text for human review | Keeps the "model" useful without letting it invent law |
| App shape | Static web app, no backend; queries DataSF directly | Free to host, nothing to maintain |
| Map vs 3D | 2D map for picking, then a dedicated 3D scene in local feet | Far simpler and smoother to animate than 3D inside the map |
| Terrain | Flat lot in v1; slope rules shown as a flagged card | SF slope rules need a terrain model, which is a v2 job |
| Stack | Same as the megaprojects map where they overlap | Shared parcel layer and styling between the two projects |

**Open question:** should the starting "potential" block be a fixed ceiling (say 200 ft) or the tallest height anywhere in SF? The spec uses 2x the mapped height so the first cut always reads clearly.

## Data sources (San Francisco)

Two DataSF datasets do most of the work: the parcel layer (geometry plus zoning code) and the height and bulk districts layer. Everything is queryable over the Socrata API with no key needed at low volume. DataSF moved from data.sfgov.org to data.sf.gov; the dataset IDs did not change.

| Layer | DataSF ID | Fields to use | Role in the app |
|---|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | blklot, mapblklot, zoning_code, zoning_district, shape (multipolygon), active, address fields, centroid lat/lon | Parcel picking, geometry, zoning lookup |
| Zoning Map – Zoning Districts | `3i4a-hu95` | District code and name, geometry | Map overlay; cross-check for parcels with blank zoning |
| Zoning Map – Height and Bulk Districts | `h9wh-cg3m` | Height and bulk label (e.g. 40-X), geometry | Height cap and bulk rules, via point-in-polygon on the parcel |
| Special Use Districts, street centerlines, building footprints | Search DataSF | Look up IDs at build time | Overlays, front-lot-line detection, neighbor context |

Query patterns to hand Claude Code (it should verify each against the live API first):

- **Parcel at a click:** `GET https://data.sf.gov/resource/acdm-wktn.geojson?$where=active=true AND intersects(shape,'POINT(<lon> <lat>)')`
- **Neighbors for context:** same endpoint with `intersects(shape, <parcel buffered ~50 ft as WKT>)`
- **Height district:** the same intersects query against `h9wh-cg3m`, using the parcel centroid; if a parcel straddles two districts, keep both and split the envelope
- **Address search:** match `from_address_num` / `to_address_num` / `street_name` in the parcel layer before reaching for an outside geocoder

**The Family Zoning Plan changed heights citywide.** It was signed into law on December 12, 2025. It created a new R-4 height and bulk district in which each affected parcel carries two heights: a base height and a higher "local program" height available only through the Housing Choice SF program. Claude Code must check whether `h9wh-cg3m` exposes both values. If it does, the app shows base height as the rule and the local program height as an optional "unlock" step. If it does not, the app flags R-4 parcels as incomplete rather than guessing.

## Rule model

Every zoning district is one JSON file of ordered rules; the array order is the animation order. The engine never hard-codes a district. Adding RM-1 later means writing one file, not touching geometry code.

Each rule has a `kind` that maps to one geometry operation:

| Kind | What it does to the volume | Example |
|---|---|---|
| `info` | Nothing; shows a card | Permitted uses, unit count |
| `height_cap` | Horizontal cut at a height | 40 ft from the 40-X district |
| `rear_yard` | Vertical cut parallel to the rear lot line | 30% of lot depth |
| `front_setback` | Vertical cut parallel to the front lot line | Block average, capped |
| `side_yard` | Vertical cuts along side lines | RH-1(D) only |
| `sky_plane` | Angled cut rising from a line | 45 degrees from 30 ft at the front |
| `bulk` | Caps plan dimensions above a height | Bulk letters other than X |
| `far` | Volume budget, not a shape; shown as a fill gauge | Districts that use floor area ratio |
| `flag` | Rule the app cannot model yet; shown honestly | Slope adjustments |

Required fields on every rule: `id`, `kind`, `title`, `plain` (one sentence a layperson understands), `params`, `citation`, `url`, `verified` (true only after a human checks the code text), and `effectiveDate`.

Worked example for RH-2. Values come from secondary summaries of the Planning Code, so every `verified` stays false until checked against the official code.

```json
{
  "jurisdiction": "sf",
  "district": "RH-2",
  "name": "Residential, House, Two Family",
  "rules": [
    { "id": "use", "kind": "info", "title": "Homes, up to two units",
      "citation": "SF Planning Code §209.1", "verified": false },
    { "id": "mapped-height", "kind": "height_cap", "title": "Height limit",
      "params": { "source": "heightDistrict" }, "citation": "§250", "verified": false },
    { "id": "rh-dwelling-height", "kind": "height_cap", "title": "RH-2 dwelling cap",
      "params": { "feet": 40 }, "citation": "§261(b)", "verified": false },
    { "id": "rear-yard", "kind": "rear_yard", "title": "Rear yard",
      "params": { "pctOfLotDepth": 0.30, "minFeet": 15, "appliesAt": "grade_and_every_story" },
      "citation": "§134(c)(1), §134(d)(1)", "verified": false },
    { "id": "front-setback", "kind": "front_setback", "title": "Front setback",
      "params": { "method": "block_average", "maxFeet": 10, "userOverride": true },
      "citation": "§132", "verified": false },
    { "id": "front-plane", "kind": "sky_plane", "title": "Front height plane",
      "params": { "fromLine": "front_setback", "startHeightFeet": 30, "angleDeg": 45 },
      "citation": "§261(c)", "verified": false },
    { "id": "slope", "kind": "flag", "title": "Slope can lower the limit",
      "citation": "§261(b)", "verified": false }
  ]
}
```

The rule engine resolves params against the parcel into concrete numbers before any geometry runs, e.g. "rear yard = 30% x 100 ft = 30 ft." Those resolved sentences are what the cards display. When two height caps apply, the lower one cuts and the higher one shows as "already satisfied."

## Geometry engine

The engine computes every step's solid up front, then the animation just plays them back. Each rule produces an "allowed region"; the new envelope is the old envelope intersected with it, and the removed piece is the difference.

1. **Project to feet.** Convert the parcel polygon from lon/lat to EPSG:2227 (California State Plane Zone III, US survey feet) with proj4, then recenter on the parcel centroid. All math happens in feet from here on.
2. **Find the front lot line.** Pick the parcel edge(s) that border no other parcel and face a street centerline. Corner and through lots get a prompt: "Which side is the front?" The user's answer is stored per parcel.
3. **Measure the lot.** Lot depth is the distance from the front line to the farthest point along its inward normal. Lot width is the front line's length. Irregular lots get an "approximate geometry" badge.
4. **Build the starting block.** Extrude the footprint to 2x the mapped height.
5. **Resolve rules.** Turn each rule's params into numbers for this parcel (rear yard = max(30% x depth, 15 ft)).
6. **Cut.** For each geometric rule, build its allowed region as a large prism or half-space (a box below the height cap, a slab in front of the rear-yard line, a wedge under the sky plane). Then `next = prev ∩ allowed` and `removed = prev − next`. Use manifold-3d (WebAssembly) for the booleans; it is robust where lighter CSG libraries crack on thin slivers.
7. **Measure each step.** Record volume, footprint area, and the resolved sentence for the card.
8. **Slice floors.** Cut the final envelope at a 10 ft floor-to-floor height (user-adjustable). Floor area per story = plate area at mid-story height.

Invariants the test suite must enforce on every parcel:

- Volume never increases from one step to the next.
- Start volume minus final volume equals the sum of removed volumes, within 0.1%.
- The envelope never leaves the parcel prism.
- A rule with no effect still gets a card that says "already satisfied."

Test fixtures with hand-checked answers:

| Fixture | Inputs | Expected result |
|---|---|---|
| A: standard lot | 25 x 100 ft, RH-2, 40-X, no front setback | Rear yard 30 ft; footprint 1,750 sq ft; front plane removes 1,250 cu ft; envelope 68,750 cu ft; 4 stories, about 6,875 sq ft of floor area |
| B: shallow lot | 25 x 40 ft, RH-2, 40-X | 30% is 12 ft, so the 15 ft minimum governs; footprint 625 sq ft |
| C: corner lot | Any real RH-2 corner parcel | Front prompt appears; invariants pass; no NaN volumes |
| D: split height | A parcel crossing two height districts | Two height cuts, each on its own part of the lot |

## Animation choreography

Every rule plays the same four-beat sequence, about 3.5 seconds total, so the viewer learns the grammar once. One GSAP timeline holds all steps, which makes the step buttons free.

The four beats of each rule:

1. **Announce (0.6 s).** The rule card slides in: title, the resolved sentence ("Rear yard: 30% of 100 ft = 30 ft"), and the citation as a link.
2. **Measure (0.8 s).** A dimension line draws itself on the model, from the lot line to the new boundary, with its number.
3. **Cut (1.2 s).** A thin cutting plane sweeps through the block along the boundary. The volume beyond it tints red.
4. **Remove (0.9 s).** The red piece lifts a few feet, fades to 0%, and is removed. The counters tick down: volume, footprint, percent remaining.

Opening and closing beats:

- **Arrival.** Camera flies from the 2D map into a three-quarter view. Neighbors appear as quiet gray extrusions so scale reads.
- **Starting block.** The footprint rises as a pale translucent block to 2x the legal height.
- **Finale.** The envelope turns solid, floor slices appear one by one from the ground up, and a summary card states stories, floor area, and "X% of the block survived."

Visual language:

- **Envelope:** one calm neutral, slightly translucent so cuts behind it read.
- **Removed volume:** one red, always. Never use red for anything else.
- **Info-only rules** (use, unit count): card only, no geometry beat, 1.5 s.
- **Flagged rules** (not modeled): card with a dashed border saying what is not shown and why.
- **prefers-reduced-motion:** skip the lift and sweep; crossfade between states instead.

Controls: Back and Next (Next animates one rule and stops; pressed mid-animation it finishes that rule and starts the next), a row of step dots (start, one per rule, result) that jump without animating, and a per-rule eye icon that toggles that rule off and recomputes, so the user can see what a single rule costs. Keyboard: → / Space / Page Down for Next, ← / Page Up for Back, Home and End for the start and the result. (Changed at the user's request on 2026-10-16; this replaced play/pause, a scrubber with a tick per rule and a 1x/2x speed toggle.)

## UI and interaction

Two screens, one URL. The map is for choosing; the 3D scene is for understanding. Every state is in the URL, so a link like `?parcel=0119012&step=4` opens straight to the rear-yard cut on that lot.

- **Map screen.** Full-bleed MapLibre map of SF with parcel outlines drawn from vector tiles at zoom 16+. Hover shows block/lot and zoning code; click selects. A search box takes an address or a block/lot number. A toggle tints parcels by zoning district.
- **3D screen.** Canvas on the left two-thirds; on the right, a vertical stack of rule cards that fill in as the animation passes them, ending as a complete checklist of what governs this lot. A back arrow returns to the map at the same spot.
- **Fact card.** Sits above the rule stack: address, block/lot, zoning code and name, height and bulk district, lot area, width, depth, and the data's as-of date.
- **Phone layout.** Canvas on top, rule cards in a bottom sheet the user can drag up. Controls sit in a single row under the canvas.
- **Honesty strip.** A permanent one-line footer: "Illustrative. Not a zoning determination. Verify with SF Planning." It links to the city's official zoning map.

## Tech stack and repo structure

A TypeScript web app built with Vite, with the zoning logic in a pure package that has no browser dependencies. Keeping the engine pure means it can be unit-tested in Node and reused later in a server or another app.

Stages 2 to 5 run once, before anything moves. The animation only replays stored solids, which is why scrubbing backward is instant.

| Layer | Choice | Job |
|---|---|---|
| App shell | Vite + React + TypeScript | Screens, state, routing by URL |
| Map | MapLibre GL JS | Parcel picking, zoning tint |
| Parcel tiles | Build script: DataSF GeoJSON to PMTiles via tippecanoe | All 235k parcel outlines as one static file, no tile server |
| 3D | Three.js via react-three-fiber + drei | Scene, camera, materials, dimension lines |
| Booleans | manifold-3d (WASM) | Robust solid cuts |
| Projection | proj4 (EPSG:2227) + turf | Feet-based geometry, buffers, edge tests |
| Animation | GSAP timeline | The four-beat sequence and scrubber |
| Rules | JSON + zod schema | Validated district files |
| Tests | Vitest | Fixtures and invariants |
| Hosting | Any static host | No backend |

```
zoning-envelope/
  CLAUDE.md                 # this spec, condensed, plus working rules
  apps/web/                 # React app: map, scene, cards, controls
  packages/engine/          # pure TS: resolve rules, build solids, measure
    src/geometry/           # projection, lot lines, cuts, slicing
    src/rules/              # rule kinds -> allowed-region builders
    test/fixtures/          # fixtures A-D with expected numbers
  packages/jurisdictions/
    sf/
      adapter.ts            # DataSF queries, field mapping
      districts/RH-2.json   # one file per district
  scripts/build-tiles.ts    # parcels -> PMTiles
```

The jurisdiction adapter is the seam for expansion. A second city (Oakland, Petaluma) supplies its own adapter and district files; the engine and the animation stay untouched.

## Build phases and prompts

Build in seven phases (0 to 6), one Claude Code session each, and do not start a phase until the last one's "done when" is true. Export this doc as Markdown, save it in the repo root as SPEC.md, and paste the prompts below in order.

### Phase 0 — Kickoff

**Done when** the repo exists, CLAUDE.md is written, and a phase plan is approved.

> Read SPEC.md fully. Create the monorepo described under "Tech stack and repo structure." Write a CLAUDE.md that condenses SPEC.md into: project goal, stack, folder map, the rule-JSON schema, the test invariants, and these working rules: (1) never invent zoning values; every rule value must come from a district JSON file with a citation; (2) the engine package has no browser imports; (3) run the tests before saying a phase is done. Then use plan mode to propose a plan for Phase 1 only and wait for my approval.

### Phase 1 — Data

**Done when** a CLI prints correct facts for three real parcels you choose.

> Phase 1. In packages/jurisdictions/sf, build the DataSF adapter. First hit the live API and confirm the field names and the SoQL intersects() syntax for datasets acdm-wktn (parcels) and h9wh-cg3m (height and bulk); report anything that differs from SPEC.md. Then write getParcelAt(lon, lat) and getParcelByBlockLot(blklot) returning: geometry, blklot, address, zoning_code, height district(s), and lot area. Check whether h9wh-cg3m exposes both base and local-program heights for Family Zoning Plan (R-4) parcels and tell me what you find. Add a CLI: `pnpm parcel <blklot>`. Cache responses to disk in dev.

### Phase 2 — Engine

**Done when** fixtures A to D and all invariants pass.

> Phase 2. Build packages/engine per the "Geometry engine" and "Rule model" sections of SPEC.md. Use proj4 for EPSG:2227, manifold-3d for booleans, zod for the rule schema. Implement rule kinds height_cap, rear_yard, front_setback, sky_plane, info, and flag. Write districts/RH-2.json exactly as in SPEC.md. Write Vitest tests for fixtures A-D and every invariant. Fixture A must produce: footprint 1,750 sq ft, envelope 68,750 cu ft, about 6,875 sq ft of floor area. Output of the engine: an ordered array of steps, each with the solid before, the removed solid, the solid after, measurements, and the resolved card sentence.

### Phase 3 — Scene

**Done when** you can click Next through every step of fixture A and a real parcel, with no animation yet.

> Phase 3. In apps/web, render the engine's steps with react-three-fiber. Neutral translucent envelope, red removed volume, gray neighbor extrusions, a ground plane, soft lighting, three-quarter camera. Add Next and Back buttons that jump between steps, a fact card, and the rule-card stack. Load a parcel from ?parcel=<blklot>.

### Phase 4 — Animation

**Done when** the full sequence plays smoothly at 60 fps on a laptop and scrubs both ways.

> Phase 4. Implement the "Animation choreography" section of SPEC.md with one GSAP timeline: the four beats per rule, the arrival, the starting block, and the finale with floor slices. Add play/pause, a scrubber with a tick per rule, 1x/2x speed, per-rule toggles that recompute the engine, and a reduced-motion path. Keep ?step=<n> in the URL in sync.

### Phase 5 — Map and coverage

**Done when** any RH parcel in SF works from a click.

> Phase 5. Build scripts/build-tiles.ts (parcels to PMTiles via tippecanoe) and the MapLibre map screen: hover info, click to select, address and block/lot search, zoning tint toggle, fly-in transition to the scene. Then draft districts/RH-1(D).json, RH-1.json and RH-3.json with verified=false on every rule, listing for each value the Planning Code section I need to check. Add side_yard for RH-1(D).

### Phase 6 — Depth

> Pick from: terrain and slope rules (§261), bulk letters, FAR districts (RM, NC), the Family Zoning Plan "local program" unlock step, and share images. One item per session.

The verification pass between Phases 5 and 6 is yours: read each cited section, fix the value if needed, and flip `verified` to true.

## Accuracy guardrails and pitfalls

The tool is only worth showing if its numbers are right, so every value traces to a cited rule and every gap is shown, not hidden.

- **No live LLM law.** Rules come only from district JSON files. An AI may draft a file; a person verifies it.
- **Unverified means visible.** Any card built from a rule with `verified: false` shows a small "unverified" tag until you clear it.
- **Overlays override bases.** Special use districts, the Family Zoning Plan's R-4 heights, and state laws (SB 9, the state density bonus) can change the answer. v1 detects these overlays and flags them rather than ignoring them.
- **Front setbacks depend on neighbors.** SF averages adjacent buildings' setbacks, which the parcel data does not carry. v1 uses the rule's maximum with a user slider; v2 can estimate from building footprints.
- **Slope changes heights.** On hills like Russian Hill, §261 can lower the RH height limit where the lot falls steeply. v1 flags it; v2 needs a terrain model.
- **Condo parcels stack.** Several blklot records can share one footprint; group them by mapblklot so a click picks the land, not a unit.
- **Irregular lots are approximate.** Depth on a wedge or flag lot is a judgment call; badge it and show the depth line used.
- **Data goes stale.** Show each dataset's as-of date on the fact card and re-check DataSF IDs before each release.

## Sources

- Parcels – Active and Retired (acdm-wktn), column definitions
- Zoning Map – Zoning Districts (3i4a-hu95)
- Zoning Map – Height and Bulk Districts (h9wh-cg3m)
- SF Planning, Family Zoning Plan
- Sheppard Mullin, Family Zoning Plan: R-4 base and local program heights
- SF Planning Code §209.1, RH control table (secondary transcription)
- Summary of RH yard, setback and §261 height rules (secondary)
- Zoning Administrator letter on §261 slope height reduction, 2590 Pacific Ave
