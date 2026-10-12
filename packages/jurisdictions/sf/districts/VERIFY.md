# Verification checklist for the RH district files

Every rule in the district files is an **unverified draft** (`verified: false`, `effectiveDate: null`):
- RH: `RH-1(D).json`, `RH-1.json`, `RH-1(S).json`, `RH-2.json`, `RH-3.json`
- RM: `RM-1.json` to `RM-4.json`
- NC: `NC-1.json`, `NC-2.json`, `NC-3.json`, `NC-S.json`

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
| S10 | [gocodebook §209.2](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2-use-districts/sec.-209.-description-and-purpose-of-residential-and-residential-commercial-districts/sec.-209.2.-rm-residential-mixed-districts) (Table 209.2) | Mirror, text as of 2026-09-23. Merged table cells come through garbled; each row was checked against the clean Table 209.2 in Ord. 245-25 |
| S11 | [gocodebook Art. 7](https://gocodebook.com/library/us/ca/san-francisco-planning/article-7-neighborhood-commercial-districts) (§§710–713, Tables 710–713) | Mirror, text as of 2026-09-23 |
| S12 | gocodebook Art. 1.2: [§124](https://gocodebook.com/library/us/ca/san-francisco-planning/article-1.2-dimensions-areas-and-open-spaces/sec.-124.-basic-floor-area-ratio), §132, §134, §135 (Table 135A), §144.1, §145.1 | Mirror, text as of 2026-09-23 |
| S13 | gocodebook Art. 2.5: §261.1, §263.20, §270 | Mirror, text as of 2026-09-23 |
| S14 | [gocodebook §206.10](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2-use-districts/sec.-206.-the-affordable-housing-and-educator-housing-programs/sec.-206.10.-housing-choice-san-francisco-program) (Housing Choice-SF) and §263.19, §334 | Mirror, text as of 2026-09-23; checked against Ord. 245-25 as amended in committee 12/1/2025 |
| S15 | [Planning Director Bulletin No. 11](https://sfplanning.org/resource/planning-director-bulletin-no-11-housing-choice-sf-program), Housing Choice-SF | Official guidance, last updated 9/10/2026 (web page; the PDF couldn't be read). Secondary: where it differs from the code, the code was followed |

The RM and NC rules shared with RH (`height-reference`, `mapped-height`, `front-setback` in RM, `narrow-street`, `cross-slope`) reuse the RH text and amlegal URLs. The new rules' URLs point at the gocodebook pages the values were read from, not at amlegal.

Sections 133 and 261.1 were also read directly on gocodebook. Pages: [§133](https://gocodebook.com/library/us/ca/san-francisco-county-zoning/sec.-133.-side-yards-rh-1-d-districts) and [§261.1](https://gocodebook.com/library/us/ca/san-francisco-planning/article-2.5-height-and-bulk-districts/sec.-261.-additional-height-limits-applicable-to-certain-rh-districts/sec.-261.1.-additional-height-limits-for-narrow-streets-and-alleys-in-r-rto-nc-nct-and-east).

## Rules shared by every RH district

| Rule id | Value in the files | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `height-reference` | Height is measured from the curb at the building's centerline. Level or downslope lots: the curb, for the first 100 ft of depth. Upslope lots: the curb within 10 ft of the street, then the average of the ground at either side of each cross-section | §260(a)(1)(A)–(C), §261(a) | S8 | §260: 1/12/2026 (Ord. 245-25) |
| `mapped-height` | The height and bulk district's mapped height (from DataSF) | §250, and the height map | — | — |
| `rear-yard` | 30% of lot depth, never less than 15 ft, at grade and every story | §134(c)(1), §134(d)(1) | S1, S5, S7 | Text 1/14/2024 (Ord. 248-23); reworded 1/12/2026 (Ord. 245-25) |
| `front-setback` | As deep as the adjacent building with the shallowest setback, up to 10 ft. The 15 ft exception for some block faces isn't modeled | §132(a), (c)(1), (d) | S1, S5 | §132(a) 1/19/2025 (Ord. 297-24); §132(d) 1/14/2024 |
| `narrow-street` (flag) | Frontages on streets 40 ft wide or narrower step back upper stories; not modeled | §261.1 | S2 | 5/17/2021 (Ord. 47-21) |
| `bulk` (every district) | Table 270 by the bulk letter mapped for each height zone: above the listed height, every floor's length and diagonal stay within the limits. A 40/110/125, B 50/110/125, C 80/110/125, D 40/110/140, E 65/110/140, F 80/110/140, G 80/170/200, H 100/170/200, I 150/170/200, J 40/250/300, K 60/250/300, L 80/250/300, M 100/250/300, N 40/50/100, T 80/110/125 (height / length / diagonal, ft). X: no limits. R-4: limits start above the 85 ft podium (§270(i)); not modeled above it. Other letters (R, R-2, R-3, S, S-2, CS, V, TB, CP, HP, PM, TI, EP, IB, PY, OS) are governed elsewhere and not modeled. Where the envelope is too big, the app keeps one box (widest allowed street front, then the depth the diagonal allows, at the front and centered) | §270(a)–(c), Table 270, §102 (Plan Dimensions), §270(i) | S13 | Table 270 amended by Ord. 245-25 (1/12/2026; R-3, R-4 rows) and Ord. 13-26 (3/16/2026; row T) |
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

## Housing Choice-SF (`local-program`, every district)

The card is always shown. It applies only to lots with an R-4 height label (`base//program-R-4`), and only when the viewer switches it on (`?program=1`). The engine never treats it as the default envelope.

| Param | Value in the files | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| height | The number after "//" ("the height limit for projects using the HCSF Program") | §263.19(b)(2), §206.10(d)(1)(C) | S14 | 1/12/2026 (Ord. 245-25) |
| `minHeight` | 65 ft "on a Corner Lot or a Lot larger than 8,000 square feet", "unless a higher height limit is provided elsewhere". The app raises a lower program height to 65 ft on a lot whose street sides meet at a corner, or whose area (from the parcel shape) is over 8,000 sq ft | §206.10(d)(1)(C), §102 (Corner Lot) | S14 | 1/12/2026 |
| `waives` (RH-1(D), RH-1, RH-1(S), RH-2) | `rh-dwelling-height` and `front-plane`: "Planning Code Section 261 shall not apply." Other districts have no §261 rule to waive | §206.10(d)(1)(C) | S14 | 1/12/2026 |
| `replaces` (NC) | `rear-yard` becomes 18% of lot depth or 15 ft, whichever is greater, with "no rear yard ... required at the ground floor" in NC districts. RH and RM keep their rear yards: (E)(i) excludes "lots in Residential Districts other than ... RTO-C" | §206.10(d)(1)(E)(i)–(ii) | S14 | 1/12/2026 |
| `assumes` | The project adds homes (2 or more units, a net increase), is at least two-thirds residential, takes no other density bonus, and doesn't demolish a listed historic building, a hotel, or rent-controlled units on a site with more than 2 units | §206.10(b)(1)–(10) | S14 | 1/12/2026 |
| `notDrawn` | The (e) bonuses (up to +10 ft, or +30 ft combined), +20 ft for 100% affordable projects ((d)(2)(B)(iv)), §263.20's +5 ft, the up-to-15% adjustments ((d)(1)(M)) and the Citywide Design Standards | §206.10(d)(1)(M), (d)(2), (e), (e)(7); §263.20 | S14, S15 | 1/12/2026 |
| card text | Open space (§135) and exposure (§140) don't apply; FAR doesn't limit residential uses (form-based density). None of these is drawn either way | §206.10(d)(1)(A), (F), (G) | S14 | 1/12/2026 |

Unchanged under the program: front setbacks (except a 19th Avenue sidewalk option, (d)(1)(D)), side yards (except through the (e)(3)–(e)(4) bonuses), §270(i) bulk, §261.1 narrow streets, and the §260 height reference.

## Rules shared by every RM and NC district

| Rule id | Value in the files | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `far` | A floor area ratio for **non-residential** floor area only: RM-1 1.8, RM-2 1.8, RM-3 3.6, RM-4 4.8, NC-1 1.8, NC-2 2.5, NC-3 3.6, NC-S 1.8. "In R, RC, NC, and Mixed Use Districts, Floor Area Ratio limits shall not apply to Residential Uses." The FAR rows sit under "Non-residential standards" in Tables 209.2 and 710–713 | §124(a)–(b), Table 124 | S10, S11, S12 | §124(b) reworded by Ord. 245-25 (1/12/2026); the exemption itself is older |

## RM-1, RM-2, RM-3, RM-4

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | Density: 1 unit per 800 / 600 / 400 / 200 sq ft of lot area (RM-4: a unit of 500 sq ft or less with one room plus kitchen and bath counts as ¾, note (8)). Open space per unit: 100 / 80 / 60 / 36 sq ft private, or 133 / 106 / 80 / 48 sq ft common | Table 209.2, §207, Table 135A | S10, S12 | Ord. 245-25 kept the lot-area limits and removed the Ord. 292-24 minimum-density text |
| `rear-yard` | RM-1, RM-2: 30% of lot depth, at least 15 ft. RM-3, RM-4: 25%, at least 15 ft. At grade and every story | §134(c)(1), (c)(2), (d)(1) | S5, S12 | 1/14/2024 (Ord. 248-23 replaced the old 45% with averaging); Ord. 245-25 made no RM change except new (l) |
| `front-setback` | Same rule as RH: the adjacent building with the shallowest setback, up to 10 ft (15 ft exception not modeled). Table 209.2 still says "no case greater than 10 feet" without the 15 ft exception | §132(a), (c), (d) | S5, S12 | 1/14/2024 (Ord. 248-23 changed RM from averaging) |
| `front-modulation` (flag, RM-1 and RM-2) | On lots wider than 35 ft, the front steps at least 2 ft in height or depth every 35 ft or less, or has a pedestrian entrance every 25 ft | §144.1 | S12 | Check |
| *(absent)* | No side yards (Table 209.2: "Not Required"; §133 is RH-1(D) only). No §261 dwelling cap or front plane (RH only) | §133, §261 | S10, S13 | — |

## NC-1, NC-2, NC-3, NC-S

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | 1 home per 800 sq ft of lot area (NC-3: 600), or the nearest R district's density if greater (not compared in the app). Form-based density only on R-4 lots | Tables 710–713, §207(b)(6) | S11 | Ord. 245-25 kept the numbers and added the R-4 sentence |
| `ground-floor` (`ground_story`) | Non-residential ground floors at least 14 ft floor to floor; 10 ft in 40- and 50-ft height districts. The app draws the first story at this minimum | §145.1(c)(4)(C) | S12 | Check |
| `rear-yard` | 25% of lot depth, at least 15 ft. NC-1: at grade and every story ((d)(1)). NC-2 and NC-S: from the second story up, and at the first story if it has a dwelling ((d)(2)). NC-3: from the lowest story with a dwelling ((d)(3)). NC-2, NC-3 and NC-S are drawn with a non-residential first story | §134(c)(2), (d)(1)–(3) | S11, S12 | NC-S had no rear yard until Ord. 245-25 (1/12/2026); NC depths unchanged in substance by Ord. 248-23 |
| `front-setback` (flag) | Required only where the sidewalk is narrower than the Better Streets Plan width, for frontages of 50 ft or more, corner lots and lots next to a set-back building, up to 15 ft above grade. Not modeled | §132(e) | S11, S12 | 1/12/2026 (Ord. 245-25) |
| `ground-floor-bonus` (flag, not NC-S) | Up to 5 ft of extra height for a ground floor taller than 10 ft clear. NC-S: "NP" | §263.20 | S11, S13 | Amended by Ord. 245-25 |
| `large-lot` (flag, NC-S) | On lots of 2 acres or more, 65% coverage from the second story up (35% unbuilt) replaces the rear yard | §134(l) | S12 | 1/12/2026 (Ord. 245-25) |

## Open questions to settle while verifying

1. **Corner-lot side yards (RH-1(D)).** The engine puts side yards along every lot line that runs front to back, including a second street side. Does §133 require a side yard along a street side?
2. **Corner-lot front setback.** §132(c) gives a corner lot half the adjacent setback, on the frontage the owner elects. That case isn't modeled; the user can set the setback with the slider.
3. **Density figures.** Table 209.1's columns were garbled in both copies read. Confirm the units per lot and lot area per unit for each district.
4. **§261(c)(2).** Next to taller neighbors, the front plane is raised to the average height of the adjacent buildings. That isn't modeled because neighbor heights aren't reliable enough.
5. **§133(b) and (c).** Buildings 25 ft tall or less may shift width so that one side yard is 3 ft, and neighbors may agree to build to a shared line. Neither is modeled.
6. **Overlays that change these rules for opted-in projects.**
   - The §249.94 Family and Senior Housing Opportunity SUD covers most RH lots. It changes height, the rear yard and the front plane for corner lots. Not detected yet.
   - Housing Choice-SF (§206.10) on R-4 lots is modeled on request (the `local-program` card; questions 28–36).
7. **URLs.** The `url`s point at amlegal section pages found by search (node ids from a dev mirror for §133, §260 and §261.1). None was opened, because amlegal blocks automated access.
8. **"Average ground elevation" (§261(b), (c)).** The code doesn't define it. The engine averages the ground along each lot line from a 1 m LiDAR terrain model (USGS 3DEP, 2023). The 2590 Pacific Ave determination (S9) averaged surveyed spot elevations at the lot corners and let a retaining wall just inside the rear line stand in for it. Check which method the Planning Department uses, and whether existing or finished grade.
9. **The curb.** §260 measures from the curb; there is no curb data, so the engine uses the ground at the middle of the front lot line. A sidewalk's cross-slope usually puts the curb a few inches lower.
10. **"As measured at curb" in §261(b)(1)(A).** On an upslope lot, the 40 ft limit is described as measured at curb, but §260(a)(1)(C) measures upslope lots from the ground at the sides beyond 10 ft of the street. The engine follows §260 for every height rule. Confirm.
11. **Which way a lot slopes (§260(a)(1)(B)–(C)).** The engine calls a lot upsloping when the ground along its centerline averages higher than the curb. The code speaks of the slope "at the centerline of the building or building step"; check how small a rise still counts.
12. **Deep downslope lots.** Past 100 ft (or the mid-block line), §260(a)(1)(B) measures from the lower end of the lot. The card says so; it isn't modeled.
13. **FAR on mixed-use buildings.** §124(b) exempts residential uses, so the app shows FAR as a budget for non-residential floor area against the envelope's total floor area. Check how Planning counts shared areas (lobbies, circulation, parking) in a mixed-use building.
14. **The first story's height.** §134(d)(2)–(3) start the NC rear yard at the second story, but the code doesn't cap how tall a first story can be. The app draws it at the §145.1 minimum (14 ft, or 10 ft in 40- and 50-ft districts); a taller ground floor would fill more of the yard. Check how the ZA treats the first story's height in the rear yard.
15. **§263.20 conflicts with the tables.** As amended by Ord. 245-25, §263.20 lists no districts or parcels, so any NC project in a 30/40/50-X district with a ground floor over 10 ft clear could seem to qualify. Tables 710–712 still say "P(1) in some districts" with area notes, and §263.20(a) still refers to "specific districts listed below". It's a flag until a ZA interpretation settles it.
16. **Stale cross-references.** Table 712's rear-yard note "(6)" points at an unrelated note. The NC tables cite "§134(a)(e)". Table 713 note (1) cites the repealed §253.3.
17. **Nearest R district density.** NC density is the table value or the nearest R district's, whichever is greater. Which R district is "nearest" isn't computed.
18. **§134(l) on large RM lots.** Residential districts get 60% coverage at street grade and above on lots of 2 acres or more. It isn't flagged in the RM files because few RM lots are that big; check whether any are.
19. **§144.1 in RM-3 and RM-4.** The Table 209.2 row extracts as if it spans all four RM columns, but §144.1 itself names only RM-1 and RM-2. The files follow §144.1.
20. **Amendments after 2026-09-23.** The mirror's text is as of that date. Ord. 1-26, 13-26 (§134(d)(3)) and 37-26 amended NC tables or §134 earlier in 2026; their text should already be included.
21. **Bulk height reference.** §270(a) applies the limits "above the height indicated", and §102 defines Height by pointing to §260. The app measures the bulk height from the same §260 reference as the height limits. That reading is an inference: §270 doesn't say so in as many words.
22. **Length on irregular lots.** §102 measures length "parallel to an exterior wall". The app measures the envelope across and along the lot's front line, which matches the walls on rectangular lots and approximates them on irregular ones. The diagonal is exact (the two most separated points).
23. **Where the box goes.** Bulk limits fix size, not position. The app keeps the widest street front the limits allow, then the depth the diagonal allows, at the front and centered across. That is one allowed placement among many, and the card says so.
24. **Row T.** The mirror shows 80 / 110 / 125. Ord. 13-26 amended row T; the scanned page appears to strike "At setback height established pursuant to Section 132.2, but no higher then" and keep "80". Confirm.
25. **Row V.** The height cell is blank in the code (it once pointed at the repealed §253.2), so V is not modeled.
26. **§271 exceptions.** The Planning Commission may let a project exceed the limits (conditional use, or design review in the Eastern Neighborhoods). Not modeled; the envelope shows the limits as written.
27. **R-4 above the podium.** §270(i): above 85 ft, 15 ft interior setbacks, a 12,000 sq ft average floor plate, 130 ft length and 160 ft diagonal, tower spacing, and top-third reductions. Covered lots' R-4 base heights don't reach 85 ft, so the card says the limits don't apply. With Housing Choice-SF on, some program heights do (70//140-R-4, 55//100-R-4); there the card says the limits aren't modeled.
28. **"Large lots" in §206.10(d)(1)(E).** The 18% NC rear yard excludes "large lots subject to Section 134(d)(6)", but codified §134(d)(6) is C-district lot coverage; the two-acre rule is §134(l). The intended reference is probably §134(l). The app applies the 18% yard on every NC lot; NC-S lots of 2 acres or more already carry the `large-lot` flag.
29. **8,000 sq ft.** The code says "a Lot larger than 8,000 square feet"; Bulletin No. 11 says "8,000 square feet and larger". The files follow the code (a lot of exactly 8,000 sq ft doesn't qualify). The app measures lot area from the parcel shape, which can differ from a survey.
30. **Corner Lot.** §102: a corner lot is at the junction of two or more streets, and "no Corner Lot shall be considered wider or deeper than 125 feet". The app calls a lot a corner lot when two of its street sides (found from neighboring parcels) meet at an angle, and raises the whole lot to 65 ft. It doesn't apply the 125 ft limit. A lot beside unparcelled land, or at a sharp bend in one street (197–199 Graystone Ter, 2719020: street sides 54° apart), can be mistaken for a corner lot; the card says the corner was judged from the parcel map.
31. **The first story under the program.** §145.1's 10 ft exception is for "40- and 50-ft height districts". On an R-4 lot under the program, the app reads the height district as the program height (14 ft on 40//65-R-4). Check which number Planning uses.
32. **§260(a)(4) and §270(i).** §260(a)(4) applies the lateral-slope tables to R-4 parcels "at or below 85 feet" but excludes property subject to §§270–270.3, and §270(i) covers all of R-4. The cross-slope flag covers both readings.
33. **§263.20 on R-4 lots.** It names "R-4 ... with a height limit of 40, 50, or 80 feet" without saying base or program height; "80" may be meant as 85. Not modeled (the `notDrawn` list).
34. **§263.21 vertical elements.** (d)(1)(I) lets them exceed the height limit "consistent with" §263.21(c), which itself runs through §329, and (d)(3) switches §329 off. Not drawn.
35. **§261.1.** §206.10 switches off "Section 261" only; §261.1 (narrow streets and alleys) still applies by its text. It stays a flag.
36. **Citywide Design Standards.** Bulletin No. 11 says Design Standard C.6 limits many R-district HC-SF envelopes at the rear (side setbacks above the ground floor, 30 ft between 55% and 30% of lot depth). That's a design standard, not Planning Code, and wasn't read at its source; not drawn, and named in `notDrawn`.
