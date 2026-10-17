# DataSF notes (verified against the live API, 2026-10-10)

What the SF adapter relies on, checked against `https://data.sf.gov`, and where it differs from SPEC.md. Re-check before each release (`LIVE=1 pnpm test`).

## Datasets and fields

| Dataset | ID | Fields used | Notes |
|---|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | `blklot`, `mapblklot`, `from_address_num`, `to_address_num`, `street_name`, `street_type`, `zoning_code`, `zoning_district`, `active` (boolean), `shape` (MultiPolygon), `centroid_latitude`, `centroid_longitude`, `data_as_of` | Matches SPEC.md. There is **no lot-area field**. About 1,400 active records have `street_name` = `UNKNOWN`. |
| Height and Bulk Districts | `h9wh-cg3m` | `height` (label), `gen_hght` (number), `the_geom` (MultiPolygon) | **The geometry column is `the_geom`, not `shape`.** There are 269 distinct labels. Some polygons are huge (one is 20k vertices, about 800 KB). |
| Zoning Districts | `3i4a-hu95` | `zoning`, `districtna`, `gen`, `the_geom` (also `zoning_sim`, `url`, `codesectio`) | Used when a parcel's `zoning_code` is blank, and as the map's zoning tint (10,617 polygons; `gen` is Residential / Mixed Use / Commercial / Public / Industrial). |
| Addresses with Units (EAS) | `ramy-di5m` | `address`, `parcel_number`, `unit_number`, `longitude`, `latitude` | Address search. `starts_with(address,'667 HAMP') AND unit_number IS NULL` answers in about 0.3 s. Numbered streets are zero-padded (`752 04TH AVE`), as in the parcel layer. It finds corner lots by their second street too. `parcel_number` can be a condo unit's block/lot; the adapter resolves it to the land record. |
| Assessor Secured Property Tax Rolls | `wv5m-vpq2` | `lot_area` | Used only for one-off cross-checks; the app doesn't read it. |
| Zoning Map – Special Use Districts | `5yf5-ms5f` | `name`, `url` (amlegal link to the code section), `the_geom` (MultiPolygon) | 145 rows, about 2 MB as GeoJSON; some districts come in several pieces with the same name. Besides SUDs it holds restricted use districts and subdistricts (alcohol, fringe financial, formula retail). The largest pieces are 8–10k vertices (Priority Equity Geographies SUD 9,832; Family and Senior Housing Opportunity SUD 7,967). Another dataset with the same title, `rxfc-8aap`, has more columns and was updated less recently; the app uses `5yf5-ms5f`. |
| Building Footprints | `ynuv-fyni` | `sf16_bldgid`, `mblr` ("SF" + block/lot), `hgt_median_m` (median LiDAR height above ground, meters, 2010 survey), `shape`, `data_as_of` | Context only. `getBuildings()` fetches the lot's bbox + 150 ft and drops buildings standing on the lot itself. The app keeps only the lot's own block, so buildings across the street don't block the street-side camera. The dataset is dated 2023-09-11, but the heights date from 2010. |

Dataset as-of dates come from `GET /api/views/<id>.json`, field `rowsUpdatedAt` (Unix seconds). Parcel rows also carry `data_as_of`.

## Query syntax (confirmed)

- Point in parcel: `$where=active=true AND intersects(shape,'POINT(<lon> <lat>)')`
- Polygon against height districts: `$where=intersects(the_geom,'MULTIPOLYGON(((...)))')`
- Neighbors: `$where=active=true AND blklot=mapblklot AND mapblklot!='<self>' AND intersects(shape,'POLYGON(<lot bbox + ~50 ft>)')`. Column-to-column comparison (`blklot=mapblklot`) works in SoQL and collapses condo stacks to their land record.
- `.json` and `.geojson` both work, and `.json` returns `shape` as a GeoJSON object.
- CORS is `Access-Control-Allow-Origin: *`, so the browser can query DataSF directly.
- SoQL has `num_points()` and `simplify()`, but **no `intersection()`**. Overlap areas have to be computed on the client.
- **URL limit:** about 9 KB works and about 18 KB returns HTTP 414. Above 6,000 WKT characters the adapter sends the parcel's bounding box instead.

## Differences from SPEC.md

1. **Height lookup uses the parcel polygon, not the centroid.** Each district also returns its piece of the lot (lot ∩ district, clipped in lon/lat) so the engine can cut each part to its own height. A centroid can't detect a second district. The adapter intersects the parcel polygon. When more than one label matches, it downloads those districts and measures each overlap in EPSG:2227 with `polygon-clipping`. Anything under 0.1% of the lot is treated as boundary contact, since district lines usually follow lot lines. That threshold is a data-cleaning tolerance, not a zoning value.
2. **R-4 (Family Zoning Plan) labels carry both heights, but only in the label text.** The format is `base//local-R-4`, e.g. `40//85-R-4`. **`gen_hght` is the local-program height**: it equals the second number for every simple R-4 label (asserted in `test/heightLabel.test.ts`). The base height appears only in the label, so `gen_hght` must never be used as the R-4 cap. Compound labels like `140/400//140/450-R-4` and `120/400//120/650-R4` (note the missing hyphen) are left unparsed and flagged.
3. **Many RH lots are in R-4 districts now.** 4501 Ocean Ave (RH-1(D)) is `40//40-R-4`, and 766–772 Francisco St (RH-2) is `40//50-R-4`. Plain `40-X` districts still exist.
4. **Coverage count:** there are 124,824 *active* RH records (RH-1 60,596; RH-2 37,167; RH-3 14,115; RH-1(D) 12,946). SPEC.md's "about 129,000" probably includes retired records. A new code, `RTO-C` (11,855 active records), is outside v1.
5. **Condo stacks:** unit records repeat the parent's exact shape and share its `mapblklot`. The land record is the row with `blklot = mapblklot`. It's active and carries the full address range. The largest stack, `0306026`, has 2,393 records, so point lookups group by `mapblklot`.
6. **Lot area is computed**, as the planar area in EPSG:2227 with holes subtracted. The assessor's `lot_area` is too noisy to use as ground truth. Of 11 lots sampled, 5 agree within ~1%, but block 6660 (Kingston St / San Jose Ave) differs by −10% to +26%. Condo parents read 0, and frontage/depth are usually 0.

## Phase 5 findings (2026-10-10)

1. **Land parcels:** 155,017 active records with `blklot = mapblklot`. As GeoJSON they come to about 78 MB in four 50k pages. With the zoning layer, tippecanoe (zoom 12–16, no dropping) makes a 20.6 MB PMTiles file.
2. **Zoning codes on land parcels:**

   | Code | Parcels |
   |---|---|
   | RH-1 | 60,121 |
   | RH-2 | 32,419 |
   | RH-1(D) | 12,919 |
   | RH-3 | 8,973 |
   | RH-1(S) | 63 |
   | RH DTR | 63 |

   RH DTR is Rincon Hill Downtown Residential, not a house district.
3. **Repeated and split codes.** `zoning_code` can hold several codes joined by `|`:
   - Repeats (`RH-2|RH-2`) collapse to one code (`zoningCodes`).
   - True splits (`RH-1|RH-2`, 115 RH lots) aren't modeled. The map and the lot page say so (`zoningCoverage`).
   - 758 land parcels have no code at all; they are looked up from the zoning layer when opened.
4. **Non-standard land ids.** About 140 land records aren't `block + lot`:
   - common areas (`5335ACOMH`, `1924COMA`)
   - open space (`4991OS1`)
   - vacated streets (`VACST22S`, `PARKCOSO`)
   
   The adapter accepts any 4–12 character id of letters, digits and `*`.
5. **Coverage sweep** (`pnpm sweep`, 200 random land parcels per district plus every RH-1(S) lot, two seeds, 1,726 lots):
   - Every lot produced an envelope for every front choice.
   - About 1 lot in 8 asked for the front (corner lots, through lots, lots beside unparcelled land).
   - Some corner lots measured from their long side are only about 25 ft deep, so the 15 ft rear yard plus the 10 ft maximum setback leave nothing. The engine adds a "Nothing is left" note.
   - A 5 sq ft sliver (`2716042`) had no side long enough to count as a street side, so the longest side is used.

## Phase 6 findings: ground elevations (2026-10-12)

1. **Source.** USGS 3DEP ImageServer, `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`.
   - Over San Francisco it serves the 1 m bare-earth DEM from the LiDAR survey **CA_SanFrancisco_B23**, acquired 2023-04-20 and published 2024-08-26. Elevations are in meters, NAVD88.
   - The catalog `query?objectIds=<rasterId>` gives the survey name and `AcquisitionDate`.
2. **Access.**
   - `getSamples` takes EPSG:2227 points directly (`spatialReference: {wkid: 2227}`), so nothing has to be reprojected.
   - It returns at most **1,000 samples per request**. Requests go as POST, because a GET URL with 1,000 points is too long.
   - CORS is open (`Access-Control-Allow-Origin: *`). A request takes about 0.7–1.2 s.
3. **Reliability.** About 3% of requests answer 502 Bad Gateway. Each request is retried twice (0.4 s, then 1.2 s). If the context grid still fails, the lot keeps its fine grid; if the fine grid fails, the lot is treated as flat and says so.
4. **Grids.** Both grids are in EPSG:2227 feet:
   - **Fine:** the lot bbox + 10 ft, spaced 3 ft or more. The rules use this one.
   - **Context:** the bbox + 150 ft, spaced 10 ft or more. The scene uses this one.
   - Each grid is capped at 1,000 points.
5. **Measuring.** Single samples at lot corners vary by ±5 ft near buildings. Averages along a whole lot line are stable: 667 Hampshire's front line averages 54.4 ft with the street at 53.5 ft.
6. **Sweep (`pnpm sweep --per-district 50 --seed 3`, terrain on).** In RH-1(D) and RH-1, about 1 lot in 8 has its rear 20 ft or more higher than its front, and about 1 in 10 has it 20 ft or more lower. RH-2 and RH-3 are mostly within 20 ft.

## Special use districts (2026-10-16)

1. **Listed, never modeled.** `getParcelByBlockLot` returns `specialUseDistricts` (name and code link, one per name, sorted), or null when the layer can't be read; the lot still loads then. `specialUse.ts` adds a note for the districts in `specialUse.json` (so far §249.94) saying what they allow and, from the lot's zoning, whether the lot can use them.
2. **Edge contact.** District lines follow lot lines and streets, so a plain polygon query also finds districts that only meet a lot's edge. The adapter queries with the lot shrunk by 1 ft instead (the intersection of eight copies of the lot shifted 1 ft outward in eight directions, coordinates rounded to 1e-7°). On 301 random RH/RM/NC lots, measured against the downloaded district shapes: all 463 real overlaps (the smallest 6.9% of the lot) were found, and all 9 edge contacts (0.001% of the lot or less) were dropped, at insets from 0.25 ft to 3 ft. No district shape has to be downloaded.
3. **Long outlines.** When the shrunk lot's WKT is over 6,000 characters (or nothing is left of a sliver), the adapter fetches the districts crossing the lot's bounding box with their shapes and keeps those covering at least 0.1% of the lot, as for height districts. That download can reach several hundred KB, so it's kept for the few hundred lots with outlines of 150+ vertices.

## Named neighborhood commercial districts (2026-10-17)

- The parcel layer gives every named NC district a generic `zoning_code`, "NCD" (33 districts) or "NCT" (11), and its name in `zoning_district` ("NORTH BEACH NEIGHBORHOOD COMMERCIAL"). The zoning layer (`3i4a-hu95`) has each district's own code in `zoning` ("NCD-NORTH BEACH", "NCT-MISSION") with the same name in `districtna`.
- All 44 parcel names match exactly one zoning-layer code. The layer has 121 (code, name) pairs in all; the one name shared by two codes ("PDR PRODUCTION, DISTRIBUTION, AND REPAIR": M-2 and PDR-2) is never a generic code's.
- So `resolveNamedDistrict` (sf/zoning.ts) swaps a lot's generic code for the zoning layer's by name: the adapter with one grouped query (`select zoning,districtna group by zoning,districtna`, cached per adapter), and `pnpm build-tiles` with the same query before writing parcels, so the map's hover and click see the specific code too. A name that isn't found leaves the generic code (shown as not covered).
- Sweep (`pnpm sweep --per-district 12 --seed 9 --program`, batch 1): all 60 lots in the five named districts produced envelopes. Bulk B and A cut nothing on the sampled lots ("already satisfied"); every sampled Geary lot is R-4 (50//85 and similar) and all grew under Housing Choice-SF. `--only CODE,CODE` sweeps chosen districts.

## RTO coverage (2026-10-17)

- Active land parcels: RTO-C 8,766, RTO-1 1,325, RTO-M 1,147. With them, about 88% of land parcels have a rule file (81% before). The largest uncovered groups left are the named NCD districts (4,850 lots in about 30 tables), NCT (1,798) and P (1,683).
- Sweep (`pnpm sweep --per-district 15 --seed 7 --program`): all 45 RTO lots produced envelopes. 8 asked for the front; one RTO-M front choice (3643058, front 2) leaves nothing. Every sampled RTO-C lot was in an R-4 district, and all grew under Housing Choice-SF (median +5,818 sq ft); 10 of the 13 R-4 RTO-1 lots didn't change (their two heights are equal).

## Neighbors' front setbacks: not from building outlines (2026-10-17)

§132(a) sets the front setback from the adjacent buildings' setbacks, which city data doesn't record. The Building Footprints layer (`ynuv-fyni`) was tried as a stand-in and rejected:
- On 40 random RH lots, 52 sides had a building next door. Measured from the street line to the outline, 14 of them (27%) start in front of the property line, 7 by more than 3 ft (beyond what a bay window over the sidewalk explains), down to −7.0 ft; both neighbors of 1391 Hampshire St come out at about −9.5 ft. The outline and parcel layers are commonly offset by several feet, against a 10 ft maximum.
- Outlines are roof outlines, so they include the bays, decks and garage extensions §132(b) leaves out. Errors run toward a shallower setback, i.e. a larger envelope than the code allows.

So the setback stays at the rule's maximum, with the slider for the viewer's own figure.

## Height label parsing

| Pattern | Result | Examples |
|---|---|---|
| `<ft>-<bulk>` | standard height + bulk letter | `40-X`, `65-A-1`, `85-R-2` |
| `<base>//<local>-R-4` | R-4 base + local program | `40//40-R-4`, `55//85-R-4` |
| anything else | `unparsed` → flagged, never guessed | `40/55-X`, `45-TI`, `OS`, `CP`, `None Stated`, compound R-4 |

## Demo parcels (Phase 1 "done when")

Expected values were checked independently with pyproj (official EPSG:2227) + shapely. They agree with the adapter to within 0.01 sq ft and 1e-5 in share.

| Block/lot | Address | Zoning | Height | Lot area | Why it's here |
|---|---|---|---|---|---|
| `4025007` | 667 Hampshire St | RH-2 | `40-X` (100%) | 2,500 sq ft (assessor: 2,500) | Ordinary 25×100-style lot, like fixture A |
| `0044030` | 766–772 Francisco St | RH-2 | `40//50-R-4` → base 40, local 50 | 4,219 sq ft | Condo stack (4 units) and an R-4 split |
| `4276045` | 1391–1393 Hampshire St | RH-2 | `40-X` 67.06% / `55-X` 32.94% | 2,961 sq ft | Straddles two height districts (fixture D candidate) |
| `7261001` | 4501 Ocean Ave | RH-1(D) | `40//40-R-4` | 3,122 sq ft | Used for the `--at` point lookup |
| `2687029` | 124 Clarendon Ave | RH-1(D) | `40//40-R-4` | 5,699 sq ft | Phase 5: irregular lot, side yards along bent side lines |
| `1646023` | 752 4th Ave | RH-1 | `40//40-R-4` | 3,726 sq ft | Phase 5: RH-1 (and RH-1(S) in the tests) |
| `0982019` | 2120 Lyon St | RH-3 | `40//40-R-4` | 3,185 sq ft | Phase 5: RH-3, no dwelling cap or front plane |

Recorded responses for these parcels are in `test/fixtures/datasf/` (in the same format as the dev cache) and are replayed by `test/adapter.test.ts`.
