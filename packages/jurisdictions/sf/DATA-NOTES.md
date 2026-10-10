# DataSF notes (verified against the live API, 2026-10-10)

What the SF adapter relies on, checked against `https://data.sf.gov`, and where it differs from SPEC.md. Re-check before each release (`LIVE=1 pnpm test`).

## Datasets and fields

| Dataset | ID | Fields used | Notes |
|---|---|---|---|
| Parcels – Active and Retired | `acdm-wktn` | `blklot`, `mapblklot`, `from_address_num`, `to_address_num`, `street_name`, `street_type`, `zoning_code`, `zoning_district`, `active` (boolean), `shape` (MultiPolygon), `centroid_latitude`, `centroid_longitude`, `data_as_of` | Matches SPEC.md. There is **no lot-area field**. About 1,400 active records have `street_name` = `UNKNOWN`. |
| Height and Bulk Districts | `h9wh-cg3m` | `height` (label), `gen_hght` (number), `the_geom` (MultiPolygon) | **The geometry column is `the_geom`, not `shape`.** There are 269 distinct labels. Some polygons are huge (one is 20k vertices, about 800 KB). |
| Zoning Districts | `3i4a-hu95` | `zoning`, `districtna` (also `zoning_sim`, `gen`, `url`, `codesectio`, `the_geom`) | Used only when a parcel's `zoning_code` is blank. |
| Assessor Secured Property Tax Rolls | `wv5m-vpq2` | `lot_area` | Used only for one-off cross-checks; the app doesn't read it. |

Dataset as-of dates come from `GET /api/views/<id>.json`, field `rowsUpdatedAt` (Unix seconds). Parcel rows also carry `data_as_of`.

## Query syntax (confirmed)

- Point in parcel: `$where=active=true AND intersects(shape,'POINT(<lon> <lat>)')`
- Polygon against height districts: `$where=intersects(the_geom,'MULTIPOLYGON(((...)))')`
- `.json` and `.geojson` both work, and `.json` returns `shape` as a GeoJSON object.
- CORS is `Access-Control-Allow-Origin: *`, so the browser can query DataSF directly.
- SoQL has `num_points()` and `simplify()`, but **no `intersection()`**. Overlap areas have to be computed on the client.
- **URL limit:** about 9 KB works and about 18 KB returns HTTP 414. Above 6,000 WKT characters the adapter sends the parcel's bounding box instead.

## Differences from SPEC.md

1. **Height lookup uses the parcel polygon, not the centroid.** A centroid can't detect a second district. The adapter intersects the parcel polygon. When more than one label matches, it downloads those districts and measures each overlap in EPSG:2227 with `polygon-clipping`. Anything under 0.1% of the lot is treated as boundary contact, since district lines usually follow lot lines. That threshold is a data-cleaning tolerance, not a zoning value.
2. **R-4 (Family Zoning Plan) labels carry both heights, but only in the label text.** The format is `base//local-R-4`, e.g. `40//85-R-4`. **`gen_hght` is the local-program height**: it equals the second number for every simple R-4 label (asserted in `test/heightLabel.test.ts`). The base height appears only in the label, so `gen_hght` must never be used as the R-4 cap. Compound labels like `140/400//140/450-R-4` and `120/400//120/650-R4` (note the missing hyphen) are left unparsed and flagged.
3. **Many RH lots are in R-4 districts now.** 4501 Ocean Ave (RH-1(D)) is `40//40-R-4`, and 766–772 Francisco St (RH-2) is `40//50-R-4`. Plain `40-X` districts still exist.
4. **Coverage count:** there are 124,824 *active* RH records (RH-1 60,596; RH-2 37,167; RH-3 14,115; RH-1(D) 12,946). SPEC.md's "about 129,000" probably includes retired records. A new code, `RTO-C` (11,855 active records), is outside v1.
5. **Condo stacks:** unit records repeat the parent's exact shape and share its `mapblklot`. The land record is the row with `blklot = mapblklot`. It's active and carries the full address range. The largest stack, `0306026`, has 2,393 records, so point lookups group by `mapblklot`.
6. **Lot area is computed**, as the planar area in EPSG:2227 with holes subtracted. The assessor's `lot_area` is too noisy to use as ground truth. Of 11 lots sampled, 5 agree within ~1%, but block 6660 (Kingston St / San Jose Ave) differs by −10% to +26%. Condo parents read 0, and frontage/depth are usually 0.

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

Recorded responses for these parcels are in `test/fixtures/datasf/` (in the same format as the dev cache) and are replayed by `test/adapter.test.ts`.
