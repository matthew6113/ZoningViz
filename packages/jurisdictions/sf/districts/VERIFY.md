# Verification checklist for the RH district files

Every rule in `RH-1(D).json`, `RH-1.json`, `RH-1(S).json`, `RH-2.json` and `RH-3.json` is an **unverified draft** (`verified: false`, `effectiveDate: null`).

amlegal (the official codified Planning Code) blocks automated access, so the values were drafted from secondary sources. To verify a rule:

1. Read the cited section on amlegal.
2. Check the value against the code text.
3. Set `verified: true` and set `effectiveDate` to the date the current text took effect. The schema refuses `verified: true` without a date.

## Sources used for the drafts (October 2026)

| Ref | Source | What it is |
|---|---|---|
| S1 | [gocodebook §§132–134](https://gocodebook.com/library/us/ca/san-francisco-county-zoning/sec.-134.-rear-yards-in-r-rc-rto-nc-m-cmuo-mug-muo-mur-red-red-mx-spd-umu-and-wmug) | Mirror of the codified text, "2026-08 edition, text as of 2026-09-23" |
| S2 | [gocodebook Art. 2.5 (§261, §261.1)](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2.5-height-and-bulk-districts) | Same mirror |
| S3 | [gocodebook §209.1](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2-use-districts/sec.-209.-description-and-purpose-of-residential-and-residential-commercial-districts/sec.-209.1.-rh-residential-house-districts) | Same mirror; the Table 209.1 columns are garbled |
| S4 | [gocodebook Art. 2 (§207(c)(8))](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2-use-districts) | Same mirror |
| S5 | [Zoning Administrator Bulletin No. 5, *Buildable Area*](https://sfplanning.org/sites/default/files/documents/publications/ZAB_05_Buildable_Area.pdf) | Official; revised Sept 2025. Includes the 2024 changes but predates the Family Zoning Plan |
| S6 | [Ord. 248-23](https://sfbos.org/sites/default/files/o0248-23.pdf) (File 230446) | Official; effective 1/14/2024. Rewrote §132 and §134 |
| S7 | [Ord. 245-25](https://sfbos.org/sites/default/files/o0245-25.pdf) (Family Zoning Plan) | Official; effective 1/12/2026 |

| S8 | [gocodebook Art. 2.5 (§260, §261)](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2.5-height-and-bulk-districts) | Mirror, text as of 2026-09-23. §261 last amended by Ord. 188-15 (12/4/2015); §260 by Ord. 245-25 (1/12/2026) |
| S9 | [2590 Pacific Ave Letter of Determination](https://sfplanning.org/sites/default/files/za/2590_Pacific_Avenue.pdf), 5/4/2016 | Official; how the ZA averaged front and rear elevations for §261(b) |

Sections 133 and 261.1 were also read directly on gocodebook. Pages: [§133](https://gocodebook.com/library/us/ca/san-francisco-county-zoning/sec.-133.-side-yards-rh-1-d-districts) and [§261.1](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2.5-height-and-bulk-districts/sec.-261.-additional-height-limits-applicable-to-certain-rh-districts/sec.-261.1.-additional-height-limits-for-narrow-streets-and-alleys-in-r-rto-nc-nct-and-east).

## Rules shared by every RH district

| Rule id | Value in the files | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `height-reference` | Height is measured from the curb at the building's centerline. Level or downslope lots: the curb, for the first 100 ft of depth. Upslope lots: the curb within 10 ft of the street, then the average of the ground at either side of each cross-section | §260(a)(1)(A)–(C), §261(a) | S8 | §260: 1/12/2026 (Ord. 245-25) |
| `mapped-height` | The height and bulk district's mapped height (from DataSF) | §250, and the height map | — | — |
| `rear-yard` | 30% of lot depth, never less than 15 ft, at grade and every story | §134(c)(1), §134(d)(1) | S1, S5, S7 | Text 1/14/2024 (Ord. 248-23); reworded 1/12/2026 (Ord. 245-25) |
| `front-setback` | As deep as the adjacent building with the shallowest setback, up to 10 ft. The 15 ft exception for some block faces isn't modeled | §132(a), (c)(1), (d) | S1, S5 | §132(a) 1/19/2025 (Ord. 297-24); §132(d) 1/14/2024 |
| `narrow-street` (flag) | Frontages on streets 40 ft wide or narrower step back upper stories; not modeled | §261.1 | S2 | 5/17/2021 (Ord. 47-21) |
| `cross-slope` (flag) | Where the street or ground slopes across the lot by more than 5%, the building is measured from several points, each covering a width of 65 ft or less (Table 260-1: 65 / 55 / 45 / 35 ft for slopes over 5 / 15 / 20 / 25%); not modeled | §260(a)(3), Table 260-1 | S8 | 1/12/2026 |

## RH-1(D)

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | 1 unit per lot, or 1 per 3,000 sq ft of lot area, up to 3. Up to 4 units (6 on corner lots) under the density exception, plus ADUs | §209.1 (Table 209.1), §207(c)(8) | S3, S4 | Check |
| `rh-dwelling-height` (`height_by_slope`) | 35 ft; 40 ft when the rear lot line's average ground is 20 ft or more higher than the front's; 30 ft when 20 ft or more lower; 25 ft when 40 ft or more lower | §261(b)(1)(A)–(C) | S2, S5, S8 | 12/4/2015 (Ord. 188-15) |
| `side-yards` | Lots under 28 ft wide: none. 28 to under 31 ft: one yard of lot width − 25 ft. 31 to under 40 ft: 3 ft each side. 40 to under 50 ft: 4 ft each side. 50 ft or more: 5 ft each side | §133(a)–(c), Table 209.1 | S1, S3, S5 | 1978 (Ord. 443-78) |
| `front-plane` | 30 ft at the front setback line, rising at 45° toward the rear; doesn't apply when the rear is 20 ft or more higher | §261(c), (c)(1), (c)(2) | S2, S5, S8 | 12/4/2015 |

## RH-1 and RH-1(S)

The rules are the same as RH-1(D), without side yards. Only the `use` cards differ:

| District | `use` value | Check |
|---|---|---|
| RH-1 | 1 unit per lot, or 1 per 3,000 sq ft of lot area. Up to 4 (6 on corners) under the density exception, plus ADUs | §209.1, §207(c)(8) |
| RH-1(S) | 2 units per lot if the second unit is 600 sq ft or less, or 1 per 3,000 sq ft of lot area, up to 3. Up to 4 (6 on corners) under the density exception | §209.1, §207(c)(8) |

## RH-2

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | 2 units per lot, or 1 per 1,500 sq ft of lot area. Up to 4 (6 on corners) under the density exception, plus ADUs | §209.1, §207(c)(8) | S3, S4 | Check |
| `rh-dwelling-height` (`height_by_slope`) | 40 ft; 35 ft when the rear lot line's average ground is 20 ft or more lower than the front's (no uphill increase) | §261(b)(2) | S2, S5, S8 | 12/4/2015 |
| `front-plane` | 30 ft at the front setback line, then 45°; doesn't apply when the rear is 20 ft or more higher | §261(c), (c)(1), (c)(2) | S2, S5, S8 | 12/4/2015 |

## RH-3

| Rule id | Value | Check | Drafted from |
|---|---|---|---|
| `use` | 3 units per lot, or 1 per 1,000 sq ft of lot area. Up to 4 (6 on corners) under the density exception, plus ADUs | §209.1, §207(c)(8) | S3, S4 |
| *(absent)* | No §261 dwelling cap and no §261(c) front plane: the sources say both apply only in RH-1(D), RH-1, RH-1(S) and RH-2. The mapped height governs | §261(b), (c) | S2, S5 |

## Open questions to settle while verifying

1. **Corner-lot side yards (RH-1(D)).** The engine puts side yards along every lot line that runs front to back, including a second street side. Does §133 require a side yard along a street side?
2. **Corner-lot front setback.** §132(c) gives a corner lot half the adjacent setback, on the frontage the owner elects. That case isn't modeled; the user can set the setback with the slider.
3. **Density figures.** Table 209.1's columns were garbled in both copies read. Confirm the units per lot and lot area per unit for each district.
4. **§261(c)(2).** Next to taller neighbors, the front plane is raised to the average height of the adjacent buildings. That isn't modeled because neighbor heights aren't reliable enough.
5. **§133(b) and (c).** Buildings 25 ft tall or less may shift width so that one side yard is 3 ft, and neighbors may agree to build to a shared line. Neither is modeled.
6. **Overlays that change these rules for opted-in projects.** Neither is detected yet:
   - The §249.94 Family and Senior Housing Opportunity SUD covers most RH lots. It changes height, the rear yard and the front plane for corner lots.
   - Housing Choice-SF (§206.10) on R-4 lots: "Section 261 shall not apply."
7. **URLs.** The `url`s point at amlegal section pages found by search (node ids from a dev mirror for §133, §260 and §261.1). None was opened, because amlegal blocks automated access.
8. **"Average ground elevation" (§261(b), (c)).** The code doesn't define it. The engine averages the ground along each lot line from a 1 m LiDAR terrain model (USGS 3DEP, 2023). The 2590 Pacific Ave determination (S9) averaged surveyed spot elevations at the lot corners and let a retaining wall just inside the rear line stand in for it. Check which method the Planning Department uses, and whether existing or finished grade.
9. **The curb.** §260 measures from the curb; there is no curb data, so the engine uses the ground at the middle of the front lot line. A sidewalk's cross-slope usually puts the curb a few inches lower.
10. **"As measured at curb" in §261(b)(1)(A).** On an upslope lot, the 40 ft limit is described as measured at curb, but §260(a)(1)(C) measures upslope lots from the ground at the sides beyond 10 ft of the street. The engine follows §260 for every height rule. Confirm.
11. **Which way a lot slopes (§260(a)(1)(B)–(C)).** The engine calls a lot upsloping when the ground along its centerline averages higher than the curb. The code speaks of the slope "at the centerline of the building or building step"; check how small a rise still counts.
12. **Deep downslope lots.** Past 100 ft (or the mid-block line), §260(a)(1)(B) measures from the lower end of the lot. The card says so; it isn't modeled.
