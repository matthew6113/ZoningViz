# Verification checklist for the district files

Every rule starts as an **unverified draft** (`verified: false`, `effectiveDate: null`) in:
- RH: `RH-1(D).json`, `RH-1.json`, `RH-1(S).json`, `RH-2.json`, `RH-3.json`
- RM: `RM-1.json` to `RM-4.json`
- NC: `NC-1.json`, `NC-2.json`, `NC-3.json`, `NC-S.json`

The values were drafted from secondary sources. To verify a rule:

1. Read the cited section's text.
2. Check the value against it.
3. Set `verified: true` and set `effectiveDate` (see the convention below). The schema refuses `verified: true` without a date.

**NCT-1, NCT-2 and NCT-3 (2026-10-19): drafts** (section below). Their own rules carry `verified: false`; their shared rules are copies of the verified ones.

**Status: every rule in the other 60 files is verified**: the 13 RH, RM and NC files on 2026-10-14; RTO-1, RTO-M and RTO-C on 2026-10-17 (batch 6); the first five named NC districts (NCD-EXCELSIOR, NCD-GEARY BOULEVARD, NCD-NORTH BEACH, NCT-MISSION, NCT-VALENCIA) on 2026-10-17 (batch 7); the next five (NCD-INNER SUNSET, NCD-POLK, NCD-TARAVAL, NCD-UNION, NCT-HAYES) on 2026-10-17 (batch 8); five more (NCD-INNER CLEMENT, NCD-24TH-NOE-VALLEY, NCD-MISSION BERNAL, NCD-SAN BRUNO AVENUE, NCT-DIVISADERO) on 2026-10-17 (batch 9); five more (NCD-OUTER CLEMENT, NCD-UPPER FILLMORE, NCD-NORIEGA, NCT-24TH-MISSION, NCT-UPPER MARKET) on 2026-10-17 (batch 10); five more (NCT-OCEAN, NCD-BAYVIEW, NCD-PACIFIC, NCD-HAIGHT, NCD-CASTRO) on 2026-10-17 (batch 11); and five more (NCD-SACRAMENTO, NCD-WEST PORTAL, NCD-IRVING, NCD-OUTER BALBOA STREET, NCD-INNER TARAVAL STREET) on 2026-10-18 (batch 12); five more (NCD-CORTLAND AVENUE, NCT-FILLMORE, NCT-SOMA, NCT-GLEN PARK, NCT-FOLSOM) on 2026-10-19 (batch 13); five more (NCD-BROADWAY, NCD-JAPANTOWN, NCD-LELAND, NCD-LOWER HAIGHT STREET, NCD-JUDAH) on 2026-10-19 (batch 14); and the last four named districts (NCD-INNER BALBOA STREET, NCD-LOWER POLK STREET, NCD-LAKESIDE VILLAGE, NCD-COLE VALLEY) on 2026-10-19 (batch 15). Later files' shared rules (height reference, mapped height, bulk, narrow streets, cross-slope, Housing Choice-SF) are copies of the verified ones, kept identical by the consistency tests. Rules were checked against the official Planning Code text (amlegal, current through Ord. 131-26, effective 8/23/2026). The verification log at the end of this file lists each batch, what changed and how each rule is dated. The tables below are the drafting record.

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
| `height-reference` | Height is measured from the curb at the building's centerline. Level or downslope lots: the curb, for the first 100 ft of depth or halfway to the street behind, whichever is greater. Upslope lots: the curb within 10 ft of the street, then the average of the ground at either side of each cross-section | §260(a)(1)(A)–(C), §261(a) | S8 | **Verified** (log, batch 1) |
| `mapped-height` | The height and bulk district's mapped height (from DataSF) | §250, and the height map | — | **Verified** (log, batch 1) |
| `rear-yard` | 30% of lot depth, never less than 15 ft, at grade and every story | §134(c)(1), §134(d)(1) | S1, S5, S7 | **Verified** (log, batch 2) |
| `front-setback` | As deep as the adjacent building with the shallowest setback (half a lone neighbor's setback, and half on a corner lot), up to 10 ft. The 15 ft exception for some block faces isn't modeled | §132(a), (c)(1), (d) | S1, S5 | **Verified** (log, batch 2) |
| `narrow-street` (flag) | Frontages on streets 40 ft wide or narrower step back upper stories; not modeled | §261.1 | S2 | 5/17/2021 (Ord. 47-21) |
| `bulk` (every district) | Table 270 by the bulk letter mapped for each height zone: above the listed height, every floor's length and diagonal stay within the limits. A 40/110/125, B 50/110/125, C 80/110/125, D 40/110/140, E 65/110/140, F 80/110/140, G 80/170/200, H 100/170/200, I 150/170/200, J 40/250/300, K 60/250/300, L 80/250/300, M 100/250/300, N 40/50/100, T 80/110/125 (height / length / diagonal, ft). X: no limits. R-4: limits start above the 85 ft podium (§270(i)); not modeled above it. Other letters (R, R-2, R-3, S, S-2, CS, V, TB, CP, HP, PM, TI, EP, IB, PY, OS) are governed elsewhere and not modeled. Where the envelope is too big, the app keeps one box (widest allowed street front, then the depth the diagonal allows, at the front and centered) | §270(a)–(c), Table 270, §102 (Plan Dimensions), §270(i) | S13 | Table 270 amended by Ord. 245-25 (1/12/2026; R-3, R-4 rows) and Ord. 13-26 (3/16/2026; row T) |
| `cross-slope` (flag) | Where the height limit is 65 ft or less and the street slopes along the front, or the ground slopes across a lot that rises from the street, by more than 5%, the building is measured from several points, each covering a limited width (Table 260-1: 65 / 55 / 45 / 35 ft for slopes over 5 / 15 / 20 / 25%; R-4 parcels up to 85 ft, Table 260-2: 85 / 75 / 65 / 55 ft). Not where §270 bulk limits apply; not modeled | §260(a)(3)–(4), Tables 260-1 and 260-2 | S8 | **Verified** (log, batch 1) |

## RH-1(D)

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | 1 unit per lot, or 1 per 3,000 sq ft of lot area, up to 3. Up to 4 units (6 on corner lots) under the density exception, plus ADUs | §209.1 (Table 209.1), §207(c)(8) | S3, S4 | Check |
| `rh-dwelling-height` (`height_by_slope`) | 35 ft; 40 ft when the rear lot line's average ground is 20 ft or more higher than the front's; 30 ft when 20 ft or more lower; 25 ft when 40 ft or more lower | §261(b)(1)(A)–(C) | S2, S5, S8 | **Verified** (log, batch 1) |
| `side-yards` | Lots under 28 ft wide: none. 28 to under 31 ft: one yard of lot width − 25 ft. 31 to under 40 ft: 3 ft each side. 40 to under 50 ft: 4 ft each side. 50 ft or more: 5 ft each side | §133(a)–(c), Table 209.1 | S1, S3, S5 | **Verified** (log, batch 2) |
| `front-plane` | 30 ft at the front lot line (or the required front setback), rising at 45° toward the rear; doesn't apply when the rear is 20 ft or more higher | §261(c), (c)(1), (c)(2) | S2, S5, S8 | **Verified** (log, batch 1) |

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
| `rh-dwelling-height` (`height_by_slope`) | 40 ft; 35 ft when the rear lot line's average ground is 20 ft or more lower than the front's (no uphill increase) | §261(b)(2) | S2, S5, S8 | **Verified** (log, batch 1) |
| `front-plane` | 30 ft at the front lot line (or the required front setback), then 45°; doesn't apply when the rear is 20 ft or more higher | §261(c), (c)(1), (c)(2) | S2, S5, S8 | **Verified** (log, batch 1) |

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
| `use` | Density: 1 unit per 800 / 600 / 400 / 200 sq ft of lot area (RM-4: a unit of 500 sq ft or less with one room plus kitchen and bath counts as ¾, note (8)). Open space per unit: 100 / 80 / 60 / 36 sq ft private, or 133 / 106 / 80 / 48 sq ft common | Table 209.2, §207, Table 135A | S10, S12 | **Verified** (log, batch 4). The tables keep a "Minimum Dwelling Unit Densities, if applicable" row (§207.9, generally 50–100 units per acre); an earlier note here said Ord. 245-25 removed it, which was wrong. It isn't on the cards: it depends on location and doesn't change the envelope |
| `rear-yard` | RM-1, RM-2: 30% of lot depth, at least 15 ft. RM-3, RM-4: 25%, at least 15 ft. At grade and every story | §134(c)(1), (c)(2), (d)(1) | S5, S12 | **Verified** (log, batch 2) |
| `front-setback` | Same rule as RH: the adjacent building with the shallowest setback, up to 10 ft (15 ft exception not modeled). Table 209.2 still says "no case greater than 10 feet" without the 15 ft exception | §132(a), (c), (d) | S5, S12 | **Verified** (log, batch 2) |
| `front-modulation` (flag, RM-1 and RM-2) | On lots wider than 35 ft, the front steps at least 2 ft in height or depth every 35 ft or less, or has a pedestrian entrance every 25 ft | §144.1 | S12 | Check |
| *(absent)* | No side yards (Table 209.2: "Not Required"; §133 is RH-1(D) only). No §261 dwelling cap or front plane (RH only) | §133, §261 | S10, S13 | — |

## RTO-1, RTO-M, RTO-C (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Table 209.4 covers all three. It was last amended by Ord. 37-26 ("Table 209.4 amended", 4/11/2026). The `use` cards' link is built from the §209.1 and §209.2 pages' pattern and hasn't been opened.

| Rule id | Value | Check | `effectiveDate` (batch 6) |
|---|---|---|---|
| `use` | RTO-1: 1 unit per 600 sq ft of lot area as of right, C above (§207(a)); a unit of 500 sq ft or less with one room plus kitchen and bath counts as ¾ (note (8)); corner shops reaching ≤ 50 ft from the corner (§231). RTO-M and RTO-C: form-based density; RTO-M corner shops ≤ 100 ft; RTO-C allows more non-residential uses, ground floor commercial not required. Open space per unit: 80/106, 100/133, 60/80 sq ft private/common. All: new buildings on lots of 10,000 sq ft or more need C (§303(r)) | Table 209.4, §207, §303(r) | 2026-04-11 (Ord. 37-26, as for the other use cards) |
| `rear-yard` | RTO-1, RTO-M: 30% of lot depth, at least 15 ft, at grade and every story (§134(c)(1) and (d)(1) name both; the rule is RM-1's unchanged). RTO-C: 25%, at least 15 ft, from the second story up and at the first story if it has a dwelling ((c)(2), (d)(2)); drawn at every level, because §145.1(c)(4) sets no ground-floor height for RTO (question 39) | §134(c)(1)–(2), (d)(1)–(2); Table 209.4 | 2026-01-12 (Ord. 245-25 amended (c)(1), (d)(1)–(2)) |
| `front-setback` | RM's rule unchanged: the adjacent building with the shallowest setback, up to 10 ft (§132 applies "in all RH, RTO, and RM Districts"). Table 209.4 also says "in no case … greater than 10 feet", as Table 209.2 does | §132(a), (c), (d); Table 209.4 | 2025-01-19 (as RM) |
| `sidewalk-setback` (flag, RTO-C) | Where the sidewalk is narrower than the Better Streets Plan width, set the first 15 ft of height back to widen it. NC's flag text, which follows §132(e)(1)'s criteria (50 ft frontage, corner lot, next to a set-back building); Table 209.4 states it for RTO-C without them | §132(e); Table 209.4 | 2026-01-12 (Ord. 245-25 added (e)) |
| `far` | 1.8 for non-residential floor area in all three (Table 124 lists RTO at 1.8; Table 209.4 puts FAR under non-residential standards). See question 38 for RTO-C | §124(a)–(b), Table 124; Table 209.4 | 2026-01-12 (as RM) |
| `local-program` (RTO-C) | As NC's, but the replacement rear yard (18%, at least 15 ft, none at the ground floor, §206.10(d)(1)(E)(i)–(ii)) is drawn at every level for the reason in question 39. RTO-1 and RTO-M carry RM's card unchanged: (E)(i) excludes "lots in Residential Districts other than" RTO-C, so their 30% yard stays | §206.10(d)(1)(E) | 2026-01-12 (as the other files) |
| *(absent)* | No side yards (Table 209.4: "Not Required"). No §261 cap or front plane (RH only). No §144.1 front modulation (RM-1 and RM-2 only). No §145.1 ground-floor height (not an NC, RC, C or Mixed Use district) | §133, §261, §144.1, §145.1 | — |

Shared rules copied unchanged and why they reach RTO: §250 and §260 apply to every height district; Table 270 to every bulk district; §261.1(c) names "RH, RM, RTO, NC, NCT"; §260(a)(3)–(4) apply wherever the height limit is 65 ft or less (or R-4 up to 85 ft).

## Named NC districts, batch 1 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Parcels label every named district "NCD" or "NCT"; the app takes the specific code from the zoning layer by name (sf/DATA-NOTES.md). Files are keyed by that code. All five tables were last amended by Ord. 37-26 (4/11/2026).

| Rule id | NCD-EXCELSIOR (§720) | NCD-GEARY BOULEVARD (§739) | NCD-NORTH BEACH (§722) | NCT-MISSION (§754) | NCT-VALENCIA (§762) | `effectiveDate` (batch 7) |
|---|---|---|---|---|---|---|
| `use` | 1 home per 600 sq ft; open space 80/100; lots of 10,000 sq ft or more C (§121.1) | Form-based density; open space 80/100 | 1 per 400 sq ft or nearest R district (form-based in R-4); residential NP on the 1st story; ground floor commercial required district-wide (§145.4); open space 60/80; lot mergers ≤ 25 ft frontage (§121.7) | Form-based; GF commercial required on Mission St and parts of 16th/22nd (§145.4), GF residential C there (note (1)); open space 80/100; lots ≥ 10,000 sq ft C | Form-based; GF commercial required on parts of Valencia, 16th, 22nd; GF residential C there (note (1)); open space 80/100 | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | 14 ft in every district (§145.1(c)(4)(B), NCT) | same as Mission | (C) 2018-09-10; (B) 2019-01-12 (Ord. 296-18) |
| `rear-yard` | 25%, ≥ 15 ft, from the 2nd story ((d)(2)) | from the lowest story with a dwelling ((d)(3)) | (d)(2) | (d)(3) | (d)(2) | (d)(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 3.6 (Table 124 "Excelsior-Outer Mission") | 3.6 (Table 739; Geary isn't in Table 124, §124(a) defers to the district table) | 1.8 | 3.6 | 2.5 | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: P | P(1) in some districts (question 41) | NP: no flag | P | P | 2026-01-12 |

Shared rules copied unchanged: height reference, Housing Choice-SF (NC variant: 18% rear yard, none at the ground floor; §206.10(d)(1)(E)(ii) names "Named Neighborhood Commercial"), mapped height, bulk, narrow streets, cross-slope.

## Named NC districts, batch 2 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Same layout as batch 1. Hayes-Gough is NCT-HAYES in the zoning layer ("HAYES NCT"). All five tables were last amended by Ord. 37-26 (4/11/2026).

| Rule id | NCD-INNER SUNSET (§730) | NCD-POLK (§723) | NCD-TARAVAL (§733) | NCD-UNION (§725) | NCT-HAYES (§761) | `effectiveDate` (batch 8) |
|---|---|---|---|---|---|---|
| `use` | 1 home per 800 sq ft or nearest R district (form-based in R-4, note (1)); open space 100/133 | 1 per 400 sq ft or nearest R district (form-based in R-4, note (14)); ground floor commercial required on every frontage (§145.4(b)(28)); open space 60/80; lot mergers ≤ 25 ft frontage (§121.7); lots of 2,500 sq ft or more C in the Priority Equity Geographies SUD (note (12), §121.1; question 44) | Form-based density; open space 100/133 | 1 per 600 sq ft or nearest R district (form-based in R-4, note (2)); open space 80/100 | Form-based; GF commercial required on Hayes St and Octavia Blvd between Fell and Hayes (§145.4(b)(8)–(9)), GF residential C there (note (1)); open space 60/80; lots of 10,000 sq ft or more C (question 45); lot mergers on Hayes ≤ 50 ft (§121.7) | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | 14 ft in every district (§145.1(c)(4)(B), NCT) | (C) 2018-09-10; (B) 2019-01-12 |
| `rear-yard` | 25%, ≥ 15 ft, at grade and every story ((d)(1)) | from the lowest story with a dwelling ((d)(3)) | from the 2nd story ((d)(2)) | (d)(2) | (d)(3), with the Octavia parcels exception (question 46) | (d)(1) and (d)(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 1.8 | 2.5 | 2.5 | 3.0 | 3.0 | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same (table says "See § (e)", question 47) | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: NP, no flag | NP, no flag | P | NP, no flag | P | 2026-01-12 |

Shared rules copied unchanged, as in batch 1. Under Housing Choice-SF, Inner Sunset's ground-level yard becomes the program's 18% yard with none at the ground floor (question 48).

## Named NC districts, batch 3 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Same layout as batches 1 and 2. 24th Street – Noe Valley's zoning-layer code is "NCD-24TH-NOE-VALLEY" (hyphens, no spaces). All five tables were last amended by Ord. 37-26 (4/11/2026). Tables 740 and 741 (added by Ord. 7-20) have no Housing Choice-SF row (question 51).

| Rule id | NCD-INNER CLEMENT (§716) | NCD-24TH-NOE-VALLEY (§728) | NCD-MISSION BERNAL (§740) | NCD-SAN BRUNO AVENUE (§741) | NCT-DIVISADERO (§759) | `effectiveDate` (batch 9) |
|---|---|---|---|---|---|---|
| `use` | Form-based density; open space 80/100; lot mergers ≤ 50 ft frontage (§121.7) | Form-based; open space 80/100 | 1 home per 600 sq ft or nearest R district; open space 80/100 | 1 per 800 sq ft or nearest R district; open space 100/133; lots of 10,000 sq ft or more C (§121.1) | Form-based; GF commercial required district-wide (§145.4(b)(26)), GF residential C (note (1)); open space 100/133; lot mergers ≤ 100 ft except the blocks between Oak and Fell (§121.7, question 52); lots of 10,000 sq ft or more C in the Priority Equity Geographies SUD (note (11), §121.1) | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | 14 ft in every district (§145.1(c)(4)(B), NCT) | (C) 2018-09-10; (B) 2019-01-12 |
| `rear-yard` | 25%, ≥ 15 ft, from the 2nd story ((d)(2)) | at grade and every story ((d)(1)) | from the lowest story with a dwelling ((d)(3); the row's note (6) is stale, question 50) | (d)(2) | (d)(2) | (d)(1) and (d)(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 1.8 (Table 124) | 1.8 (Table 124) | 3.6 (Table 740; not in Table 124) | 2.5 (Table 741; not in Table 124) | 2.5 (Table 759; not in Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: P | P | "P in some districts" (question 49) | P | P | 2026-01-12 |

## Named NC districts, batch 4 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Same layout as the earlier batches. All five tables were last amended by Ord. 37-26 (4/11/2026). Upper Market Street NCT's rear yard is §134(d)(4), at grade and every story like (d)(1).

| Rule id | NCD-OUTER CLEMENT (§717) | NCD-UPPER FILLMORE (§718) | NCD-NORIEGA (§731) | NCT-24TH-MISSION (§763) | NCT-UPPER MARKET (§764) | `effectiveDate` (batch 10) |
|---|---|---|---|---|---|---|
| `use` | Form-based density; open space 80/100; lot mergers ≤ 50 ft frontage (§121.7) | 1 home per 600 sq ft or nearest R district (form-based in R-4, note (2)); open space 80/100 | Form-based; open space 100/133 | Form-based; GF commercial required on 24th Street (§145.4(b)(15)), GF residential C there (note (1)); open space 80/100; lots of 5,000 sq ft or more C (§121.1) | Form-based; GF commercial required on Market and Church Streets (§145.4(b)(5), (11)), GF residential C there (note (1)); open space 60/80; lots of 10,000 sq ft or more C (§121.1); lot mergers on Market ≤ 150 ft (§121.7) | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | 14 ft in every district (§145.1(c)(4)(B), NCT) | same as 24th Street – Mission | (C) 2018-09-10; (B) 2019-01-12 |
| `rear-yard` | 25%, ≥ 15 ft, at grade and every story ((d)(1)) | from the 2nd story ((d)(2)) | (d)(2) | (d)(2) | at grade and every story ((d)(4)); a waiver for buildings without homes is named, not drawn (question 53) | (d)(1) and (d)(2) 2026-01-12; (d)(4) 2024-01-14 (question 54) |
| `far` | 1.8 (Table 124) | 2.5 | 2.5 | 2.5 | 3.0 | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: P | NP, no flag | P | P | P | 2026-01-12 |

## Named NC districts, batch 5 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Same layout as the earlier batches. Ocean Avenue NCT's zoning-layer code is "NCT-OCEAN". Tables 715, 719, 726 and 755 were last amended by Ord. 37-26 (4/11/2026); Table 737 by Ord. 130-26 (8/23/2026, question 58). Table 737, like Table 740 (Mission Bernal), has no Housing Choice-SF row.

| Rule id | NCT-OCEAN (§755) | NCD-BAYVIEW (§737) | NCD-PACIFIC (§726) | NCD-HAIGHT (§719) | NCD-CASTRO (§715) | `effectiveDate` (batch 11) |
|---|---|---|---|---|---|---|
| `use` | Form-based density; GF commercial required on Ocean Avenue except its north side between Plymouth and Brighton (§145.4(b)(19)), GF residential C there (note (1)); open space 100/133; lot mergers on Ocean Avenue ≤ 50 ft except corner lots by C (§121.7(b)(5)) | 1 home per 600 sq ft or nearest R district; open space 80/100; lots of 10,000 sq ft or more C (§121.1) | Form-based; open space 100/133; GF commercial on lots last used commercially (§145.4(b)(29), question 56); lots of 2,500 sq ft or more C (question 57); lot mergers ≤ 25 ft (§121.7) | 1 per 600 sq ft or nearest R district (form-based in R-4, note (1)); open space 80/100 | 1 per 600 sq ft or nearest R district (form-based in R-4, note (2)); open space 80/100 | Bayview 2026-08-23; others 2026-04-11 |
| `ground-floor` | 14 ft in every district (§145.1(c)(4)(B), NCT) | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | (B) 2019-01-12; (C) 2018-09-10 |
| `rear-yard` | 25%, ≥ 15 ft, from the 2nd story ((d)(2)) | from the lowest story with a dwelling ((d)(3); the row's note (6) is stale, question 55) | at grade and every story ((d)(1)) | (d)(1) | (d)(2) | (d)(1) and (d)(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 2.5 (Table 124) | 3.6 (Table 737; not in Table 124) | 1.5 (Table 124) | 1.8 (Table 124) | 3.0 (Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: P | "P in some districts" (question 55) | NP, no flag | NP, no flag | P | 2026-01-12 |

## Named NC districts, batch 6 (drafted 2026-10-17 from the official PDF, through Ord. 131-26)

Same layout as the earlier batches; all five are NCDs. Zoning-layer codes: NCD-SACRAMENTO, NCD-WEST PORTAL, NCD-IRVING, "NCD-OUTER BALBOA STREET" and "NCD-INNER TARAVAL STREET". All five tables were last amended by Ord. 37-26 (4/11/2026).

| Rule id | NCD-SACRAMENTO (§724) | NCD-WEST PORTAL (§729) | NCD-IRVING (§732) | NCD-OUTER BALBOA STREET (§736) | NCD-INNER TARAVAL STREET (§745) | `effectiveDate` (batch 12) |
|---|---|---|---|---|---|---|
| `use` | Form-based density; open space 100/133 | same | same | same | same | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | same | 2018-09-10 |
| `rear-yard` | 25%, ≥ 15 ft, at grade and every story ((d)(1)) | (d)(1) | from the 2nd story ((d)(2)) | (d)(2) | (d)(2) | 2026-01-12 |
| `far` | 1.8 (Table 124) | 1.8 (Table 124) | 2.5 (Table 124) | 2.5 (Table 736; not in Table 124) | 2.5 (Table 745; not in Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: NP, no flag | NP, no flag | P | P on lots zoned 40-X or 50-X (question 59) | same as Outer Balboa | 2026-01-12 |

## Named NC districts, batch 7 (drafted 2026-10-18 from the official PDF, through Ord. 131-26)

Same layout as the earlier batches. Zoning-layer codes: "NCD-CORTLAND AVENUE", NCT-FILLMORE, NCT-SOMA, "NCT-GLEN PARK" and NCT-FOLSOM. All five tables were last amended by Ord. 37-26 (4/11/2026). Table 738 (Cortland, added by Ord. 7-20) has no Housing Choice-SF row (question 60).

| Rule id | NCD-CORTLAND AVENUE (§738) | NCT-FILLMORE (§760) | NCT-SOMA (§753) | NCT-GLEN PARK (§756) | NCT-FOLSOM (§757) | `effectiveDate` (batch 13) |
|---|---|---|---|---|---|---|
| `use` | 1 home per 800 sq ft or nearest R district; open space 100/133 | Form-based; GF commercial required on Fillmore from Bush to McAllister (§145.4(b)(21)), GF residential C there (note (1)); open space 80/100; lot mergers ≤ 100 ft (§121.7); lots of 10,000 sq ft or more C in the Priority Equity Geographies SUD (note (7), §121.1) | Form-based; GF commercial required on 6th Street (§145.4(b)(18)), GF residential C there (note (1)); open space 80/100; lots of 10,000 sq ft or more C (§121.1) | Form-based; GF commercial required on Diamond and Chenery (§145.4(b)(22)–(23)), GF residential C there (note (1)); open space 100/133 | Form-based; open space 80/100, roof decks don't qualify (question 61); lots of 10,000 sq ft or more C (§121.1); lot mergers ≤ 100 ft (§121.7) | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | 14 ft in every district (§145.1(c)(4)(B), NCT) | same | same | same | (C) 2018-09-10; (B) 2019-01-12 |
| `rear-yard` | 25%, ≥ 15 ft, from the 2nd story ((d)(2)) | from the lowest story with a dwelling ((d)(3)) | (d)(3) | (d)(2) | (d)(2) (question 61) | (d)(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 2.5 (Table 738; not in Table 124) | 3.6 (Table 124) | 2.5 (Table 124) | 2.5 (Table 124) | 2.5 (Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | "P in some districts" (question 60) | §263.20: P | P | P | NP, no flag | 2026-01-12 |

## Named NC districts, batch 8 (drafted 2026-10-19 from the official PDF, through Ord. 131-26)

Same layout as the earlier batches; all five are NCDs. Zoning-layer codes: NCD-BROADWAY, NCD-JAPANTOWN, NCD-LELAND, "NCD-LOWER HAIGHT STREET" and NCD-JUDAH. All five tables were last amended by Ord. 37-26 (4/11/2026). Tables 714 (Broadway), 721 (Japantown) and 746 (Leland, added by Ord. 23-25) have no Housing Choice-SF row and state density per lot area (question 51); Tables 743 (Lower Haight, added by Ord. 7-20) and 734 (Judah) are form-based with a Housing Choice-SF row.

| Rule id | NCD-BROADWAY (§714) | NCD-JAPANTOWN (§721) | NCD-LELAND (§746) | NCD-LOWER HAIGHT STREET (§743) | NCD-JUDAH (§734) | `effectiveDate` (batch 14) |
|---|---|---|---|---|---|---|
| `use` | 1 home per 400 sq ft or nearest R district; open space 60/80; lots of 5,000 sq ft or more C (§121.1, question 65) | 1 home per 400 sq ft, no nearest-R clause (question 63); GF commercial required on Buchanan (Post–Sutter) and Post (§145.4(b)(24)–(25)); open space 100/133; lots of 10,000 sq ft or more C (§121.1) | 1 home per 800 sq ft or nearest R district; open space 100/133; lots of 10,000 sq ft or more C in the Priority Equity Geographies SUD (note (1), §121.1) | Form-based; open space 100/133 | Form-based; open space 100/133 | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | same | 2018-09-10 |
| `rear-yard` | 25%, ≥ 15 ft, from the lowest story with a dwelling ((d)(3)) | (d)(3) | from the 2nd story, as the table words it; §134(d) doesn't list Leland (question 62) | from the 2nd story ((d)(2)) | (d)(2) | (d)(2) 2026-01-12; (d)(3) 2026-03-16; Leland 2026-04-11 (question 62) |
| `far` | 2.5 (Table 124) | 3.6 (Table 721; not in Table 124) | 2.5 (Table 746; not in Table 124) | 2.5 (Table 743; not in Table 124) | 2.5 (Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | same | 2026-01-12 |
| `buchanan-setback` (flag, Japantown) | — | Upper stories on Buchanan Street between Post and Sutter step back 1 ft per ft above 35 ft from the front property line (Table 721's height row; question 64) | — | — | — | 2026-04-11 |
| `ground-floor-bonus` (flag) | §263.20: NP, no flag | P | P | P on lots zoned 40-X or 50-X (question 59) | P | 2026-01-12 |

## Named NC districts, batch 9 (drafted 2026-10-19 from the official PDF, through Ord. 131-26)

The last four named districts; all are NCDs. Zoning-layer codes: "NCD-INNER BALBOA STREET", "NCD-LOWER POLK STREET", "NCD-LAKESIDE VILLAGE" and "NCD-COLE VALLEY". All four tables were added by Ord. 7-20 and last amended by Ord. 37-26 (4/11/2026). None is in Table 124, and §145.4(b) lists no street in any of them (question 66). Inner Balboa, Lakeside Village and Cole Valley are form-based with a Housing Choice-SF row; Lower Polk states density per lot area without one (question 51).

| Rule id | NCD-INNER BALBOA STREET (§735) | NCD-LOWER POLK STREET (§744) | NCD-LAKESIDE VILLAGE (§727) | NCD-COLE VALLEY (§742) | `effectiveDate` (batch 15) |
|---|---|---|---|---|---|
| `use` | Form-based; open space 100/133 (question 69) | 1 home per 600 sq ft or nearest R district; open space 80/100; lots of 10,000 sq ft or more C (Table 744's lot-size row, §121.1) | Form-based; open space 100/133 | Form-based; open space 100/133 | 2026-04-11 |
| `ground-floor` | 14 ft, 10 ft in 40/50 ft districts (§145.1(c)(4)(C)) | same | same | same | 2018-09-10 |
| `rear-yard` | 25%, ≥ 15 ft, from the 2nd story ((d)(2)) | from the lowest story with a dwelling ((d)(3); question 67) | at grade and every story ((d)(1)) | (d)(1) | (d)(1)–(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 2.5 (Table 735) | 3.6 (Table 744) | 1.8 (Table 727) | 1.8 (Table 742) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | P on lots zoned 40-X or 50-X (question 59) | "P in some districts" (question 68) | same as Lower Polk | same as Lower Polk | 2026-01-12 |

## NCT-1, NCT-2, NCT-3 (drafted 2026-10-19 from the official PDF, through Ord. 131-26)

The generic transit districts, the NCT counterparts of NC-1 to NC-3. Parcels carry these codes directly (no name lookup). All three tables were last amended by Ord. 37-26 (4/11/2026), are form-based with a Housing Choice-SF row, are in Table 124, and have a lot-size row whose note matches §121.1's (*) limits (only inside the Priority Equity Geographies SUD). Note (1) in each makes ground-floor homes conditional on the §145.4(b) frontages.

| Rule id | NCT-1 (§750) | NCT-2 (§751) | NCT-3 (§752) | `effectiveDate` (batch 16) |
|---|---|---|---|---|
| `use` | Form-based; GF commercial required on Geneva Avenue, I-280 to Delano (§145.4(b)(20)); open space 100/133; lots of 5,000 sq ft or more C in the PEG SUD (note (12)) | Form-based; GF commercial on 22nd Street, Third to Minnesota, and Geneva Avenue (§145.4(b)(12), (20)); open space 100/133; 10,000 sq ft or more C in the PEG SUD (note (10)) | Form-based; GF commercial on Market and Church Streets and other §145.4(b) frontages (question 70); open space 80/100; 10,000 sq ft or more C in the PEG SUD (note (11)) | 2026-04-11 |
| `ground-floor` | 14 ft in every district (§145.1(c)(4)(B), NCT) | same | same | 2019-01-12 |
| `rear-yard` | 25%, ≥ 15 ft, at grade and every story ((d)(1)) | from the 2nd story ((d)(2)) | from the lowest story with a dwelling ((d)(3)) | (d)(1)–(2) 2026-01-12; (d)(3) 2026-03-16 |
| `far` | 1.8 (Table 124) | 2.5 (Table 124) | 3.6 (Table 124) | 2026-01-12 |
| `front-setback` (flag) | §132(e), as NC | same | same | 2026-01-12 |
| `ground-floor-bonus` (flag) | §263.20: P | P | P | 2026-01-12 |

## NC-1, NC-2, NC-3, NC-S

| Rule id | Value | Check | Drafted from | Likely effective date |
|---|---|---|---|---|
| `use` | 1 home per 800 sq ft of lot area (NC-3: 600), or the nearest R district's density if greater (not compared in the app). Form-based density only on R-4 lots | Tables 710–713, §207(b)(6) | S11 | Ord. 245-25 kept the numbers and added the R-4 sentence |
| `ground-floor` (`ground_story`) | Non-residential ground floors at least 14 ft floor to floor; 10 ft in 40- and 50-ft height districts. The app draws the first story at this minimum | §145.1(c)(4)(C) | S12 | Check |
| `rear-yard` | 25% of lot depth, at least 15 ft. NC-1: at grade and every story ((d)(1)). NC-2 and NC-S: from the second story up, and at the first story if it has a dwelling ((d)(2)). NC-3: from the lowest story with a dwelling ((d)(3)). NC-2, NC-3 and NC-S are drawn with a non-residential first story | §134(c)(2), (d)(1)–(3) | S11, S12 | **Verified** (log, batch 2) |
| `front-setback` (flag) | Required only where the sidewalk is narrower than the Better Streets Plan width, for frontages of 50 ft or more, corner lots and lots next to a set-back building, up to 15 ft above grade. Not modeled | §132(e) | S11, S12 | **Verified** (log, batch 2) |
| `ground-floor-bonus` (flag, not NC-S) | Up to 5 ft of extra height for a ground floor taller than 10 ft clear. NC-S: "NP" | §263.20 | S11, S13 | Amended by Ord. 245-25 |
| `large-lot` (flag, NC-S) | On lots of 2 acres or more, 65% coverage from the second story up (35% unbuilt) replaces the rear yard | §134(l) | S12 | **Verified** (log, batch 2) |

## Open questions to settle while verifying

1. **Corner-lot side yards (RH-1(D)).** The engine puts side yards along every lot line that runs front to back, including a second street side. Does §133 require a side yard along a street side?
2. **Corner-lot front setback.** §132(c) gives a corner lot half the adjacent setback, on the frontage the owner elects. That case isn't modeled; the user can set the setback with the slider. Since batch 2 the card names it, with (a)'s half setback for a lot with one neighbor.
3. **Density figures.** Table 209.1's columns were garbled in both copies read. Confirm the units per lot and lot area per unit for each district.
4. **§261(c)(2).** Next to taller neighbors, the front plane is raised to the average height of the adjacent buildings. That isn't modeled because neighbor heights aren't reliable enough.
5. **§133(b) and (c).** Buildings 25 ft tall or less may shift width so that one side yard is 3 ft, and neighbors may agree to build to a shared line. Neither is modeled.
6. **Overlays that change these rules for opted-in projects.**
   - The §249.94 Family and Senior Housing Opportunity SUD covers the high- and highest-resource areas of the Housing Element's map (§249.94(b)), which hold many RH lots. It changes height (40 ft where mapped 40, over §261(b)), allows a rear-yard unit, and on corner lots with 5 or more homes allows 65 ft with a 25% rear yard and no front plane. Since 2026-10-16 every special use district a lot lies in is listed on the fact card (not modeled), and §249.94 has a note (`sf/specialUse.json`, below; confirmed in batch 6). Its envelope isn't drawn.
   - Housing Choice-SF (§206.10) on R-4 lots is modeled on request (the `local-program` card; questions 28–36).
7. **URLs.** The drafts' `url`s point at amlegal section pages found by search (node ids from a dev mirror for §133, §260 and §261.1). None was opened, because amlegal blocks automated access. *Settled for verified rules:* they link to the gocodebook page their text was checked against.
8. **"Average ground elevation" (§261(b), (c)).** The code doesn't define it. The engine averages the ground along each lot line from a 1 m LiDAR terrain model (USGS 3DEP, 2023). The 2590 Pacific Ave determination (S9) averaged surveyed spot elevations at the lot corners and let a retaining wall just inside the rear line stand in for it. Check which method the Planning Department uses, and whether existing or finished grade.
9. **The curb.** §260 measures from the curb; there is no curb data, so the engine uses the ground at the middle of the front lot line. A sidewalk's cross-slope usually puts the curb a few inches lower.
10. **"As measured at curb" in §261(b)(1)(A).** On an upslope lot, the 40 ft limit is described as measured at curb, but §260(a)(1)(C) measures upslope lots from the ground at the sides beyond 10 ft of the street. The engine follows §260 for every height rule. Confirm. *Settled (batch 1):* "per Section 260" defers to §260, so the engine's reading stands.
11. **Which way a lot slopes (§260(a)(1)(B)–(C)).** The engine calls a lot upsloping when the ground along its centerline averages higher than the curb. The code speaks of the slope "at the centerline of the building or building step"; check how small a rise still counts.
12. **Deep downslope lots.** Past 100 ft or the line halfway to the street behind, whichever is deeper, §260(a)(1)(B) measures from the lower end of the lot. On most SF blocks the halfway line is at or behind the rear lot line, so the curb covers the whole lot. The engine uses the curb for the whole lot; on lots deeper than 100 ft the card says what the code does and that it isn't modeled. *Card text corrected in batch 1* (it used to say the lower end governs past 100 ft).
13. **FAR on mixed-use buildings.** §124(b) exempts residential uses, so the app shows FAR as a budget for non-residential floor area against the envelope's total floor area. Check how Planning counts shared areas (lobbies, circulation, parking) in a mixed-use building.
14. **The first story's height.** §134(d)(2)–(3) start the NC rear yard at the second story, but the code doesn't cap how tall a first story can be. The app draws it at the §145.1 minimum (14 ft, or 10 ft in 40- and 50-ft districts); a taller ground floor would fill more of the yard. Check how the ZA treats the first story's height in the rear yard.
15. **§263.20 conflicts with the tables.** As amended by Ord. 245-25, §263.20 lists no districts or parcels, so any NC project in a 30/40/50-X district with a ground floor over 10 ft clear could seem to qualify. Tables 710–712 still say "P(1) in some districts" with area notes, and §263.20(a) still refers to "specific districts listed below". It's a flag until a ZA interpretation settles it.
16. **Stale cross-references.** Table 712's rear-yard note "(6)" points at an unrelated note. The NC tables cite "§134(a)(e)". Table 713 note (1) cites the repealed §253.3.
17. **Nearest R district density.** NC density is the table value or the nearest R district's, whichever is greater. Which R district is "nearest" isn't computed.
18. **§134(l) on large RM lots.** Residential districts get 60% coverage at street grade and above on lots of 2 acres or more. It isn't flagged in the RM files because few RM lots are that big; check whether any are.
19. **§144.1 in RM-3 and RM-4.** The Table 209.2 row extracts as if it spans all four RM columns, but §144.1 itself names only RM-1 and RM-2. The files follow §144.1.
20. **Amendments after 2026-09-23.** The mirror's text is as of that date. Ord. 1-26, 13-26 (§134(d)(3)) and 37-26 amended NC tables or §134 earlier in 2026; their text should already be included. *Settled:* the official text (through Ord. 131-26) includes them, and every value matches. Check the amlegal update notice for ordinances after 131-26 before the next review.
21. **Bulk height reference.** §270(a) applies the limits "above the height indicated", and §102 defines Height by pointing to §260. The app measures the bulk height from the same §260 reference as the height limits. That reading is an inference: §270 doesn't say so in as many words.
22. **Length on irregular lots.** §102 measures length "parallel to an exterior wall". The app measures the envelope across and along the lot's front line, which matches the walls on rectangular lots and approximates them on irregular ones. The diagonal is exact (the two most separated points).
23. **Where the box goes.** Bulk limits fix size, not position. The app keeps the widest street front the limits allow, then the depth the diagonal allows, at the front and centered across. That is one allowed placement among many, and the card says so.
24. **Row T.** The mirror shows 80 / 110 / 125. Ord. 13-26 amended row T; the scanned page appears to strike "At setback height established pursuant to Section 132.2, but no higher then" and keep "80". Confirm. *Settled (batch 3):* the official Table 270 reads T: 80 / 110 / 125.
25. **Row V.** The height cell is blank in the code (it once pointed at the repealed §253.2), so V is not modeled.
26. **§271 exceptions.** The Planning Commission may let a project exceed the limits (conditional use, or design review in the Eastern Neighborhoods). Not modeled; the envelope shows the limits as written.
27. **R-4 above the podium.** §270(i): above 85 ft, 15 ft interior setbacks, a 12,000 sq ft average floor plate, 130 ft length and 160 ft diagonal, tower spacing, and top-third reductions. Covered lots' R-4 base heights don't reach 85 ft, so the card says the limits don't apply. With Housing Choice-SF on, some program heights do (70//140-R-4, 55//100-R-4); there the card says the limits aren't modeled.
28. **"Large lots" in §206.10(d)(1)(E).** The 18% NC rear yard excludes "large lots subject to Section 134(d)(6)", but codified §134(d)(6) is C-district lot coverage; the two-acre rule is §134(l). The intended reference is probably §134(l). The app applies the 18% yard on every NC lot; NC-S lots of 2 acres or more already carry the `large-lot` flag.
29. **8,000 sq ft.** The code says "a Lot larger than 8,000 square feet"; Bulletin No. 11 says "8,000 square feet and larger". The files follow the code (a lot of exactly 8,000 sq ft doesn't qualify). The app measures lot area from the parcel shape, which can differ from a survey.
30. **Corner Lot.** §102: a corner lot is at the junction of two or more streets, and "no Corner Lot shall be considered wider or deeper than 125 feet". The app calls a lot a corner lot when two of its street sides (found from neighboring parcels) meet at an angle, and raises the whole lot to 65 ft. It doesn't apply the 125 ft limit. A lot beside unparcelled land, or at a sharp bend in one street (197–199 Graystone Ter, 2719020: street sides 54° apart), can be mistaken for a corner lot; the card says the corner was judged from the parcel map.
31. **The first story under the program.** §145.1's 10 ft exception is for "40- and 50-ft height districts". On an R-4 lot under the program, the app reads the height district as the program height (14 ft on 40//65-R-4). Check which number Planning uses.
32. **§260(a)(4) and §270(i).** §260(a)(4) applies the lateral-slope tables to R-4 parcels "at or below 85 feet" but excludes property subject to §§270–270.3, and §270(i) covers all of R-4. The cross-slope flag covers both readings; since batch 1 it names Table 260-2 for R-4 lots.
33. **§263.20 on R-4 lots.** It names "R-4 ... with a height limit of 40, 50, or 80 feet" without saying base or program height; "80" may be meant as 85. Not modeled (the `notDrawn` list).
34. **§263.21 vertical elements.** (d)(1)(I) lets them exceed the height limit "consistent with" §263.21(c), which itself runs through §329, and (d)(3) switches §329 off. Not drawn.
35. **§261.1.** §206.10 switches off "Section 261" only; §261.1 (narrow streets and alleys) still applies by its text. It stays a flag.
36. **Citywide Design Standards.** Bulletin No. 11 says Design Standard C.6 limits many R-district HC-SF envelopes at the rear (side setbacks above the ground floor, 30 ft between 55% and 30% of lot depth). That's a design standard, not Planning Code, and wasn't read at its source; not drawn, and named in `notDrawn`.

37. **§249.94's exclusions.** (c)(1)(A) leaves out lots in the Telegraph Hill – North Beach Residential SUD (§249.49), which the note checks by name, and the North Beach SUD (§780.3), which has been repealed and isn't on the map. (c)(1)(B) and (c)(4)(B)(ii)–(iii) depend on the area bounded by the Great Highway, Lincoln Way, 19th Avenue and Sloat Boulevard; the app doesn't check it and says so.

38. **RTO-C and §124(b).** §124(b) exempts residential uses from FAR "in R, RC, NC, and Mixed Use Districts", and §102 defines "R District" as RH, RM, "RTO, RTO-M" and RC, without RTO-C (probably not updated when Ord. 245-25 created RTO-C; §206.10(d)(1)(E)(i) calls RTO-C a Residential District). The draft follows Table 209.4, which puts RTO-C's 1.8 FAR under non-residential standards.
39. **RTO-C's first story.** §134(d)(2) requires the RTO-C rear yard from the second story up (and at the first story only if it has a dwelling), and Housing Choice-SF waives it at the ground floor, but no section gives RTO-C a ground-floor height: §145.1 lists NC, RC, C-2 and Mixed Use districts, not RTO. Without a height to cut at, both yards are drawn at every level, as for a building with homes on the ground floor; the cards say so.
40. **§134(l) on large RTO lots.** As with RM (question 18), the 2-acre lot coverage rule isn't flagged in the RTO files. §134(l) gives RTO-C the 65%-from-the-second-story variant and RTO-1/RTO-M the 60%-at-grade one.

41. **Geary's ground-floor bonus.** Table 739 says "P(1) in some districts", and note (1) gives "Additional 5 feet for NC-3 parcels zoned 40' or 50' with an Active Use on the ground floor" along Geary from Masonic Avenue to 28th Avenue, except the north side between Palm and Parker Avenues. Geary lots are NCD, not NC-3; the flag quotes the note as written.
42. **Geary's rear-yard note.** Table 739's rear-yard row points at note (6), which is about car washing at service stations, the same kind of stale reference as question 16.
43. **NCT ground floors.** §145.1(c)(4)(B) gives NCT districts 14 ft with no 40/50-ft exception, so a 40-X NCT lot gets a 14 ft first story (fixture W) where an NCD lot gets 10 ft.

44. **Polk's lot-size row.** Table 723 gives "Lot Size (Per Development): P(12)", and note (12) reads "C for 2,500 square feet and above if located within the Priority Equity Geographies Special Use District", which matches §121.1's 2,500 sq ft limit for Polk Street (marked (*): only the part of the district in that SUD). The use card says so; whether a lot is in the SUD shows on the fact card's special use list.
45. **Hayes-Gough's lot-size row.** Table 761 requires conditional use for developments on lots of 10,000 sq ft or more and cites §121.1, but §121.1's table (now limited to NC districts in the Priority Equity Geographies SUD) doesn't list Hayes-Gough. The card follows the district table.
46. **Hayes-Gough's Octavia parcels.** §134(d)(3) lets lots on the east side of Octavia Boulevard between Linden and Market Streets (Central Freeway Parcels L, M, N, R, S, T, U and V) skip the rear yard if the project meets §135 open space and §140 exposure and considers its neighbors' light and air. The app can't tell those lots apart or check the conditions; the yard is drawn and the card says so.
47. **Union's setback row.** Table 725's front-setback row ends "See § (e)", without the "132" the other tables have. The flag cites §132(e).
48. **Inner Sunset under Housing Choice-SF.** §134(d)(1) puts Inner Sunset's rear yard at grade, but §206.10(d)(1)(E)(ii) says no rear yard is required at the ground floor in "Named Neighborhood Commercial" districts, so with the program on the 18% yard starts above the first story (fixture X; the same volume as fixture Q).
49. **Mission Bernal's ground-floor bonus.** Table 740 says "P in some districts" without a note, and §263.20 no longer lists districts (Ord. 245-25 deleted its list; (a) still speaks of "specific districts listed below"). The flag quotes the table and gives §263.20(b)'s height-district test.
50. **Mission Bernal's rear-yard note.** The rear-yard row points at note (6), which is about automotive uses ("So in Ord. 7-20"), like question 42.
51. **Mission Bernal and San Bruno Avenue without R-4.** Tables 740 and 741 state density per lot area with no form-based R-4 sentence and have no Housing Choice-SF row. The sampled lots are all 40-X, so their Housing Choice-SF card says it doesn't apply; if an R-4 label ever reaches these districts, §206.10 would apply by its own terms.
52. **Divisadero's lot-merger exception.** §121.7 limits merged frontage in the Divisadero Street NCT to 100 ft "except for the east and west blocks between Oak and Fell". The card says so; which blocks a lot is on isn't checked.
53. **Upper Market's rear-yard waiver.** Table 764's rear-yard row says "See § 134(a)(1)(D) for waiver", a subsection that no longer exists since Ord. 248-23 reorganized §134. §134(d)(4) itself lets the Zoning Administrator waive or reduce the yard for buildings without Residential Uses that don't abut a pattern of rear yards, "pursuant to the procedures of subsection (h)", which is about corner lots (the NC modification procedure is (k)). The card names the waiver and draws the yard.
54. **Upper Market's rear-yard date.** §134(c)(2) and (d)(4) were last changed by Ord. 248-23 (1/14/2024); (d)(1)–(2) were amended by Ord. 245-25 and (d)(3) by Ord. 13-26. So this file's rear yard is dated 2024-01-14.
55. **Bayview's table.** Table 737 (added by Ord. 7-20 with Table 740) has Mission Bernal's quirks: the bonus row says "P in some districts" (question 49), the rear-yard row points at the automotive-use note (question 50), and there's no Housing Choice-SF row with density stated per lot area (question 51). The cards treat them the same way.
56. **Pacific Avenue's ground floor.** Table 726 says ground-floor commercial is "Not Required", but §145.4(b)(29) requires it on Pacific Avenue between Van Ness Avenue and Jones Street "on lots where the last known ground floor use was a commercial or retail use". The use card follows §145.4.
57. **Pacific Avenue's lot-size row.** Table 726 requires conditional use for developments on lots of 2,500 sq ft or more and cites §121.1, which doesn't list Pacific Avenue (as question 45). The card follows the district table.
58. **Bayview's use-card date.** Ord. 130-26 (eff. 8/23/2026) amended Table 737 and its note (7) on the Third Street Alcohol Restricted Use District, so the use card would be dated 2026-08-23 rather than Ord. 37-26's 2026-04-11.
59. **The 40-X/50-X bonus rows.** Tables 736 (Outer Balboa) and 745 (Inner Taraval) permit the §263.20 bonus only for "Active Ground Floor Uses zoned 40-X or 50-X", narrower than §263.20(b)(1)'s 30-X, 40-X, 50-X and R-4 (40, 50 or 80 ft) districts. Their flags quote the table.
60. **Cortland Avenue's table.** Table 738 (added by Ord. 7-20, like Tables 737, 740 and 741) says "P in some districts" for the ground-floor bonus (question 49) and has no Housing Choice-SF row, with density stated per lot area (question 51). Treated the same way.
61. **Folsom Street NCT's §823 references.** Table 757's rear-yard and open-space rows cite "§ 823(c)", which Ord. 70-23 (6/3/2023) redesignated as §249.39, the Western SoMa Special Use District. §249.39(c)(1) keeps §134's rear yard except a RED-MX front-setback credit and limits rear-yard modifications to corner lots; (c)(2)(B) says roof decks don't qualify as required open space. The use card cites §249.39(c)(2)(B) for the roof-deck rule; the rear yard is §134(d)(2), drawn as for the other (d)(2) districts. (§145.4(b)(21) also calls Fillmore "the Fillmore Street NCD"; it's an NCT.)
62. **Leland Avenue's rear yard.** §134(d) doesn't list Leland Avenue, though Table 746 (added by Ord. 23-25, 4/7/2025) predates Ord. 245-25's and Ord. 13-26's amendments of (d). The table's rear-yard row has (d)(2)'s words ("Required at the Second Story and at each succeeding level or Story of the building, and at the First Story if it contains a Dwelling Unit: 25% of lot depth, but in no case less than 15 feet"), so the file follows the table, cites §134(c)(2) and Table 746, and would be dated by the table (2026-04-11).
63. **Japantown's density row.** Table 721's row reads "Dwelling Units, General: 1 unit per 400 square foot lot area", with codification note 2 ("So in Ord. 245-25") and without the "or the density permitted in the nearest R District, whichever is greater" that the other per-lot-area tables have. The card states only the 400 sq ft figure. Group housing is 1 bedroom per 210 sq ft.
64. **Japantown's Buchanan Street setback.** Table 721's height row adds: "Along Buchanan Street between Post and Sutter, an upper story setback of one foot for every foot above 35 feet in height from the front property line is required." That is a 45-degree plane from the front lot line at 35 ft, which the engine could draw, but the app doesn't know which street a lot faces, so it is a flag on every Japantown lot. (The row also says "Height Sculpting on Alleys per § 261.1", the shared narrow-street flag.)
65. **Broadway's lot-size limit.** Table 714 has no lot-size row, but §121.1's table lists Broadway (without the (*) mark) in the group whose limit is 5,000 sq ft, with NC-1/NCT-1 and 24th Street-Mission (the value sits beside 24th Street-Mission, the middle row of the three). The card says lots of 5,000 sq ft or more need conditional use approval, as it does for 24th Street – Mission. Broadway's height districts are 40-X and 65-A-1; bulk district A-1 isn't modeled (the bulk card says so).
66. **"Required on some streets."** Tables 743 (Lower Haight) and 746 (Leland) say ground-floor commercial is "Required on some streets, see § 145.4 for specific districts", but §145.4(b) lists no street in either district, so their use cards don't mention it.
67. **Lower Polk's rear-yard note.** Table 744's rear-yard row ends "(6)", but note (6) is about tobacco paraphernalia establishments; codification note 1 says "So in Ord. 7-20" (as question 50). The card uses §134(d)(3), which lists Lower Polk Street. Its height districts are "generally 130-E" (the sampled lot's bulk E is checked by the bulk rule).
68. **"P in some districts" again.** Tables 744 (Lower Polk), 727 (Lakeside Village) and 742 (Cole Valley), all added by Ord. 7-20, permit the §263.20 bonus "in some districts" without saying which (question 49). Their flags quote the table, as Mission Bernal's, Bayview's and Cortland's do.
69. **Balboa Street lot mergers.** §121.7's table limits merged frontage to 50 ft for "NC-2 districts on Balboa Street between 2nd Avenue and 8th Avenue, and between 32nd Avenue and 38th Avenue". Those stretches are now the Inner Balboa (2nd–8th Avenues, §735) and Outer Balboa (32nd–39th Avenues, §736) NCDs, not NC-2. Read literally, the limit no longer applies, so neither use card mentions it (Outer Balboa's was verified that way in batch 12); if it should be read as carrying over, both cards would add that lot mergers can't create a frontage wider than 50 feet.
70. **NCT-3's ground-floor commercial frontages.** Table 752 says "Required on certain streets, see § 145.4". §145.4(b) names NCT-3 for Market Street ((b)(5)) and Church Street ((b)(11)); other listed frontages, such as 16th Street between Guerrero and Capp ((b)(16)) or the Van Ness & Market Residential SUD streets ((b)(3), (4), (14)), may cross NCT-3 lots too. The card names Market and Church and points to §145.4 for the rest. (Table 752's note (13) speaks of "portions of the NC-1 District" in the Calle 24 SUD; it concerns uses in historic buildings and doesn't change a card.)

## Special use district notes (`sf/specialUse.json`)

Held to the same rules as the district files. Each note's text was drafted from the official PDF (through Ord. 131-26); the §249.94 note was confirmed 2026-10-17.

| Note | Citation | Values | `effectiveDate` |
|---|---|---|---|
| Family and Senior Housing Opportunity SUD | §249.94(c)(1), (c)(4)(A), (d)(1)–(3), (d)(6) | Who: RH districts in the SUD except the Telegraph Hill – North Beach Residential SUD; RM-1 only in the Great Highway / Lincoln Way / 19th Avenue / Sloat Boulevard area. Up to 4 homes; corner lots 6 or 1 per 1,000 sq ft, whichever is more. The 4th home must be a rear-yard building ((c)(4)(A)(i)); corner lots can't build there ((ii)). Rear-yard building: lot ≥ 2,400 sq ft, 4 ft from side and rear lines, 25 ft from the main building, ≤ 20 ft tall. Height 40 ft where the map allows 40, notwithstanding §261(b); §261(c) still applies. Corner lots with ≥ 5 homes: 65 ft, no §261(c), rear yard 25% (≥ 15 ft) | 2024-04-13 (Ord. 41-24 amended (c)(1), (c)(4)(A), (d)(1)(A)–(B), (d)(3) and added (d)(6); Ord. 170-25 changed only (e)(2)) |

## Verification log

**Method.** Batches 1 and 2 were first checked in chat against the gocodebook mirror of the Planning Code ("2026-08 edition", text as of 2026-09-23). On 2026-10-14 the user supplied the official Planning Code PDF from amlegal (current through Ord. 131-26, effective 8/23/2026; kept in a private repo, not in this one, because amlegal's terms bar redistribution). Every rule in batches 1–5 was then compared with the official text: every value, every quoted sentence and every amendment-history date matches. The user confirmed each batch and each wording change in chat. Rules link to the gocodebook page with the same text (amlegal's section links couldn't be opened from the build sandbox).

**Effective dates.** `effectiveDate` is the effective date of the latest ordinance that amended a cited subsection, from the section's amendment history. Where the history never names the subsection, it's the date of the section's latest amendment (the current text of the section has been in force since then).

### Batch 1: height measurement and the RH height caps (§250, §260, §261), confirmed 2026-10-13

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `mapped-height` | all 13 | §250 | Matches §250(b) | 2016-08-28 (Ord. 143-16 amended (b)) |
| `height-reference` | all 13 | §260(a)(1)(A)–(C), §261(a) | 100 ft and 10 ft match. The text and the card's deep-lot note now add "or halfway to the street behind, whichever is greater" from (a)(1)(B) | 2026-01-12 (Ord. 245-25 amended (a)(1)(A)–(B)) |
| `rh-dwelling-height` | RH-1(D), RH-1, RH-1(S) | §261(b)(1) | Matches (35 / 40 / 30 / 25 ft at ±20 / 40 ft) | 2015-12-04 (Ord. 188-15 amended (b)(1)(A)) |
| `rh-dwelling-height` | RH-2 | §261(b)(2) | Matches (40 ft, 35 ft at −20 ft) | 2015-12-04 (section's latest amendment) |
| `front-plane` | RH-1(D), RH-1, RH-1(S), RH-2 | §261(c)(1), (c)(2) | Matches. Text now says the plane starts at the front lot line, or at the required setback where there is one | 2015-12-04 (section's latest amendment) |
| `cross-slope` (flag) | all 13 | §260(a)(3)–(4), Tables 260-1 and 260-2 | Widths match. Text now adds the 65 ft height condition, the upslope condition for ground cross-slopes, the §270 exclusion and the R-4 table | 2026-01-12 (Ord. 245-25 amended Table 260 and added (a)(4)) |

### Batch 2: yards and setbacks (§132, §133, §134), confirmed 2026-10-13

The NC tables (710–713) only restate §134's rear yards, and their history notes say just "Zoning Control Table amended" (latest Ord. 37-26, 4/11/2026), so NC rear yards are dated by §134 (decided with the user).

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `rear-yard` | RH-1(D), RH-1, RH-1(S), RH-2, RH-3, RM-1, RM-2 | §134(c)(1), (d)(1) | Matches (30%, at least 15 ft, at grade and every story) | 2026-01-12 (Ord. 245-25 amended (c)(1), (d)(1)) |
| `rear-yard` | RM-3, RM-4 | §134(c)(2), (d)(1) | Matches (25%, at least 15 ft, every story) | 2026-01-12 ((d)(1)) |
| `rear-yard` | NC-1 | §134(c)(2), (d)(1); Table 710 | Matches; the table row says the same | 2026-01-12 ((d)(1)) |
| `rear-yard` | NC-2, NC-S | §134(c)(2), (d)(2); Tables 711, 713 | Matches (second story up, and the first story if it has a dwelling) | 2026-01-12 (Ord. 245-25 amended (d)(2)) |
| `rear-yard` | NC-3 | §134(c)(2), (d)(3); Table 712 | Matches (lowest story with a dwelling up) | 2026-03-16 (Ord. 13-26 amended (d)(3)) |
| `front-setback` | RH-1(D), RH-1, RH-1(S), RH-2, RH-3, RM-1 to RM-4 | §132(a), (c), (d) | Values match (shallowest adjacent setback; 10 ft, or 15 ft on qualifying block faces). Text now names (a)'s half setback for a lone neighbor and (c)(1)'s half setback on corner lots | 2025-01-19 (Ord. 297-24 amended (a)) |
| `side-yards` | RH-1(D) | §133(a)–(c) | Matches (a)(1)–(5). Text now says lots under 31 ft get one strip | 1978-10-06: Ord. 443-78's approval date; the history records no effective date (decided with the user) |
| `front-setback` (flag) | NC-1, NC-2, NC-3, NC-S | §132(e) | Matches | 2026-01-12 (Ord. 245-25 added (e)) |
| `large-lot` (flag) | NC-S | §134(l) | Matches (65% coverage from the second story up, 35% unbuilt) | 2026-01-12 (Ord. 245-25 added (l)) |

### Batch 3: bulk, narrow streets, FAR and the NC ground floor, confirmed 2026-10-14

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `bulk` | all 13 | §270(a), Table 270; §102 (Plan Dimensions); §270(i) | Matches: all 15 lettered rows, X ("not applicable"), R-4 (§270(i), 85 ft podium), the §102 length and diagonal definitions | 2026-03-16 (Ord. 13-26 amended row T) |
| `narrow-street` (flag) | all 13 | §261.1 | Matches. Text now gives the 10 ft step-back above 1.25 × the street's width, the two-story exemption, the 20/60 ft distance from a wider street and the 45° plane on the south side of east-west streets | 2021-05-17 (Ord. 47-21, the section's latest amendment) |
| `far` | RM-1 to RM-4, NC-1 to NC-S | §124(a)–(b), Table 124; district tables | Matches (1.8, 1.8, 3.6, 4.8; 1.8, 2.5, 3.6, 1.8; residential uses exempt). District tables restate Table 124, so dated by §124 | 2026-01-12 (Ord. 245-25 amended Table 124 and (b)) |
| `ground-floor` | NC-1 to NC-S | §145.1(c)(4)(C) | Matches (14 ft; 10 ft in 40- and 50-ft districts) | 2018-09-10 (Ord. 202-18 amended (c)(4)(C)) |
| `ground-floor-bonus` (flag) | NC-1, NC-2, NC-3 | §263.20 | Matches. Text now names (b)(1)'s districts (30-X, 40-X, 50-X; R-4 at 40, 50 or 80 ft) and the raised ground-floor homes in (b)(2), and says the district tables still limit it | 2026-01-12 (Ord. 245-25) |
| `front-modulation` (flag) | RM-1, RM-2 | §144.1 | Matches | 2011-05-07 (Ord. 63-11 renumbered it from §145) |

### Batch 4: use and density cards, confirmed 2026-10-14

The tables were last amended by Ord. 37-26 ("Table amended", 4/11/2026); the tables are the source of these values, so every `use` card takes that date.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | RH-1(D), RH-1, RH-1(S), RH-2, RH-3 | §209.1 (Table 209.1, notes (6) and (11)), §207(c)(8) | Matches: 1 per lot or 1 per 3,000 sq ft up to 3 (RH-1(D)); 1 per lot or 1 per 3,000 sq ft (RH-1); 2 per lot if the second is 600 sq ft or less, or 1 per 3,000 sq ft up to 3 (RH-1(S)); 2 or 1 per 1,500 sq ft (RH-2); 3 or 1 per 1,000 sq ft (RH-3); 4 units, 6 on corner lots under the density exception; accessory units | 2026-04-11 |
| `use` | RM-1 to RM-4 | §209.2 (Table 209.2, note (8)), §207, Table 135A | Matches: 1 per 800 / 600 / 400 / 200 sq ft; RM-4 ¾-unit note; open space 100 / 80 / 60 / 36 sq ft private, common at 1.33× (rounded on the cards) | 2026-04-11 |
| `use` | NC-1 to NC-S | Tables 710–713, §207(b)(6) | Matches: 1 per 800 / 800 / 600 / 800 sq ft or the nearest R district's density, whichever is greater. Text now adds the tables' "Form-Based Density applies within the R-4 Height and Bulk District" (§102: units limited only by the allowed building) | 2026-04-11 |

### Batch 5: Housing Choice-SF, confirmed 2026-10-14

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `local-program` | all 13 (three variants: RH-1(D)/RH-1/RH-1(S)/RH-2 waive the §261 rules; NC replace the rear yard; RH-3 and RM change neither) | §206.10(b), (d)(1)(A), (C), (E), (F), (G); §263.19(b)(2) | Matches: the height after "//"; 65 ft on a Corner Lot or a Lot larger than 8,000 sq ft; "Section 261 shall not apply"; NC rear yard 18% or 15 ft with none at the ground floor; §135 and §140 don't apply; FAR doesn't limit residential uses; the (b)(1)–(10) eligibility list; the not-drawn bonuses ((e)(7): +10 ft, or +30 ft with (e)(6); +20 ft for 100% affordable; 15% adjustments under (d)(1)(M)) | 2026-01-12 (Ord. 245-25 added §206.10 and §263.19(b)) |

### Batch 6: RTO districts and the §249.94 note, confirmed 2026-10-17

Drafted the same day from the official PDF (Table 209.4 and the sections it cites) and confirmed by the user in chat with the dates proposed in the RTO and special-use tables above.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | RTO-1, RTO-M, RTO-C | Table 209.4, §207, §303(r) | Matches the table's density, open space, corner-commercial and large-project rows | 2026-04-11 (Ord. 37-26, as for the other use cards) |
| `rear-yard` | RTO-1, RTO-M / RTO-C | §134(c)(1), (d)(1) / (c)(2), (d)(2) | 30% (at least 15 ft) at every level / 25% (at least 15 ft) from the second story, drawn at every level (question 39) | 2026-01-12 |
| `front-setback` | all three | §132(a), (c), (d); Table 209.4 | As RM: shallowest adjacent setback, up to 10 ft | 2025-01-19 |
| `sidewalk-setback` (flag) | RTO-C | §132(e); Table 209.4 | As NC's flag | 2026-01-12 |
| `far` | all three | §124(a)–(b), Table 124; Table 209.4 | 1.8, non-residential only (question 38) | 2026-01-12 |
| `local-program` | RTO-C | §206.10(d)(1)(E)(i)–(ii) | 18% rear yard (at least 15 ft), drawn at every level | 2026-01-12 |
| §249.94 note | `sf/specialUse.json` | §249.94(c)(1), (c)(4)(A), (d)(1)–(3), (d)(6) | Who qualifies, homes per lot, rear-yard building, 40 ft over §261(b), corner-lot 65 ft option | 2024-04-13 (Ord. 41-24) |

### Batch 7: named NC districts, batch 1, confirmed 2026-10-17

Drafted the same day from the official PDF (Tables 720, 722, 739, 754 and 762 and the sections they cite) and confirmed by the user in chat with the dates in the named-district table above.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §720 / §722 / §739 / §754 / §762, §207 (and §121.1, §121.7, §145.4 where the table cites them) | Matches each table's density, open space, ground-floor commercial and lot-size rows | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | NCDs / NCTs | §145.1(c)(4)(C) / (c)(4)(B) | 14 ft, 10 ft in 40- and 50-ft districts / 14 ft in every district (question 43) | 2018-09-10 / 2019-01-12 (Ord. 296-18) |
| `rear-yard` | Excelsior, North Beach, Valencia / Geary, Mission | §134(c)(2), (d)(2) / (d)(3) | 25%, at least 15 ft, above a non-residential first story | 2026-01-12 / 2026-03-16 |
| `far` | all five | §124(a)–(b), Table 124 (not Geary); district table | 3.6 (Excelsior, Geary, Mission), 1.8 (North Beach), 2.5 (Valencia), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | all but North Beach | §263.20; Geary: Table 739 note (1) (question 41) | Up to 5 ft for a tall ground floor; NP in North Beach | 2026-01-12 |

### Batch 8: named NC districts, batch 2, confirmed 2026-10-17

Drafted the same day from the official PDF (Tables 723, 725, 730, 733 and 761 and the sections they cite) and confirmed by the user in chat with the dates in the batch 2 table above; questions 44–48 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §723 / §725 / §730 / §733 / §761, §207 (and §121.1, §121.7, §145.4 where cited) | Matches each table's density, open space, ground-floor commercial, lot-size and lot-merger rows | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | four NCDs / Hayes-Gough | §145.1(c)(4)(C) / (c)(4)(B) | 14 ft, 10 ft in 40- and 50-ft districts / 14 ft in every district | 2018-09-10 / 2019-01-12 |
| `rear-yard` | Inner Sunset / Taraval, Union / Polk, Hayes-Gough | §134(c)(2), (d)(1) / (d)(2) / (d)(3) | 25%, at least 15 ft: at grade and every story / above a non-residential first story (the Octavia parcels exception named on Hayes-Gough's card) | 2026-01-12 / 2026-01-12 / 2026-03-16 |
| `far` | all five | §124(a)–(b), Table 124; district table | 1.8 (Inner Sunset), 2.5 (Polk, Taraval), 3.0 (Union, Hayes-Gough), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | Taraval, Hayes-Gough | §263.20 | Up to 5 ft for a tall ground floor; NP in the other three | 2026-01-12 |

### Batch 9: named NC districts, batch 3, confirmed 2026-10-17

Drafted the same day from the official PDF (Tables 716, 728, 740, 741 and 759 and the sections they cite) and confirmed by the user in chat with the dates in the batch 3 table above; questions 49–52 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §716 / §728 / §740 / §741 / §759, §207 (and §121.1, §121.7, §145.4 where cited) | Matches each table's density, open space, ground-floor commercial, lot-size and lot-merger rows | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | four NCDs / Divisadero | §145.1(c)(4)(C) / (c)(4)(B) | 14 ft, 10 ft in 40- and 50-ft districts / 14 ft in every district | 2018-09-10 / 2019-01-12 |
| `rear-yard` | 24th Street – Noe Valley / Inner Clement, San Bruno Avenue, Divisadero / Mission Bernal | §134(c)(2), (d)(1) / (d)(2) / (d)(3) | 25%, at least 15 ft: at grade and every story / above a non-residential first story | 2026-01-12 / 2026-01-12 / 2026-03-16 |
| `far` | all five | §124(a)–(b) (Table 124 for Inner Clement and Noe Valley); district table | 1.8 (Inner Clement, Noe Valley), 3.6 (Mission Bernal), 2.5 (San Bruno Avenue, Divisadero), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | all five | §263.20; Mission Bernal's "P in some districts" (question 49) | Up to 5 ft for a tall ground floor | 2026-01-12 |

### Batch 10: named NC districts, batch 4, confirmed 2026-10-17

Drafted the same day from the official PDF (Tables 717, 718, 731, 763 and 764 and the sections they cite) and confirmed by the user in chat with the dates in the batch 4 table above; questions 53–54 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §717 / §718 / §731 / §763 / §764, §207 (and §121.1, §121.7, §145.4 where cited) | Matches each table's density, open space, ground-floor commercial, lot-size and lot-merger rows | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | three NCDs / two NCTs | §145.1(c)(4)(C) / (c)(4)(B) | 14 ft, 10 ft in 40- and 50-ft districts / 14 ft in every district | 2018-09-10 / 2019-01-12 |
| `rear-yard` | Outer Clement / Upper Fillmore, Noriega, 24th Street – Mission / Upper Market | §134(c)(2), (d)(1) / (d)(2) / (d)(4) | 25%, at least 15 ft: at grade and every story / above a non-residential first story / at grade and every story, waiver named | 2026-01-12 / 2026-01-12 / 2024-01-14 (Ord. 248-23) |
| `far` | all five | §124(a)–(b), Table 124; district table | 1.8 (Outer Clement), 2.5 (Upper Fillmore, Noriega, 24th Street – Mission), 3.0 (Upper Market), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | all but Upper Fillmore | §263.20 | Up to 5 ft for a tall ground floor; NP in Upper Fillmore | 2026-01-12 |

### Batch 11: named NC districts, batch 5, confirmed 2026-10-17

Drafted the same day from the official PDF (Tables 715, 719, 726, 737 and 755 and the sections they cite) and confirmed by the user in chat with the dates in the batch 5 table above; questions 55–58 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | Ocean, Pacific, Haight, Castro / Bayview | §755 / §726 / §719 / §715 / §737, §207 (and §121.1, §121.7, §145.4 where cited) | Matches each table's density, open space, ground-floor commercial, lot-size and lot-merger rows (Pacific's ground floor per §145.4(b)(29)) | 2026-04-11 (Ord. 37-26) / 2026-08-23 (Ord. 130-26) |
| `ground-floor` | Ocean NCT / four NCDs | §145.1(c)(4)(B) / (c)(4)(C) | 14 ft in every district / 14 ft, 10 ft in 40- and 50-ft districts | 2019-01-12 / 2018-09-10 |
| `rear-yard` | Pacific, Haight / Ocean, Castro / Bayview | §134(c)(2), (d)(1) / (d)(2) / (d)(3) | 25%, at least 15 ft: at grade and every story / above a non-residential first story | 2026-01-12 / 2026-01-12 / 2026-03-16 |
| `far` | all five | §124(a)–(b) (Table 124 except Bayview); district table | 2.5 (Ocean), 3.6 (Bayview), 1.5 (Pacific), 1.8 (Haight), 3.0 (Castro), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | Ocean, Bayview, Castro | §263.20; Bayview's "P in some districts" (question 55) | Up to 5 ft for a tall ground floor; NP in Pacific and Haight | 2026-01-12 |

### Batch 12: named NC districts, batch 6, confirmed 2026-10-18

Drafted 2026-10-17 from the official PDF (Tables 724, 729, 732, 736 and 745 and the sections they cite) and confirmed by the user in chat with the dates in the batch 6 table above; question 59 stands as the cards describe it.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §724 / §729 / §732 / §736 / §745, §207 | Form-based density; open space 100/133 | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | all five | §145.1(c)(4)(C) | 14 ft, 10 ft in 40- and 50-ft districts | 2018-09-10 |
| `rear-yard` | Sacramento, West Portal / Irving, Outer Balboa, Inner Taraval | §134(c)(2), (d)(1) / (d)(2) | 25%, at least 15 ft: at grade and every story / above a non-residential first story | 2026-01-12 |
| `far` | all five | §124(a)–(b) (Table 124 for Sacramento, West Portal, Irving); district table | 1.8 (Sacramento, West Portal), 2.5 (Irving, Outer Balboa, Inner Taraval), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | Irving, Outer Balboa, Inner Taraval | §263.20; district table | Up to 5 ft for a tall ground floor (40-X/50-X lots in Outer Balboa and Inner Taraval); NP in Sacramento and West Portal | 2026-01-12 |

### Batch 13: named NC districts, batch 7, confirmed 2026-10-19

Drafted 2026-10-18 from the official PDF (Tables 738, 753, 756, 757 and 760 and the sections they cite) and confirmed by the user in chat with the dates in the batch 7 table above; questions 60–61 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §738 / §760 / §753 / §756 / §757, §207 (and §121.1, §121.7, §145.4, §249.39(c)(2)(B) where cited) | Matches each table's density, open space, ground-floor commercial, lot-size and lot-merger rows | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | Cortland / four NCTs | §145.1(c)(4)(C) / (c)(4)(B) | 14 ft, 10 ft in 40- and 50-ft districts / 14 ft in every district | 2018-09-10 / 2019-01-12 |
| `rear-yard` | Cortland, Glen Park, Folsom / Fillmore, SoMa | §134(c)(2), (d)(2) / (d)(3) | 25%, at least 15 ft, above a non-residential first story | 2026-01-12 / 2026-03-16 |
| `far` | all five | §124(a)–(b) (Table 124 except Cortland); district table | 2.5 (Cortland, SoMa, Glen Park, Folsom), 3.6 (Fillmore), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | Cortland, Fillmore, SoMa, Glen Park | §263.20; Cortland's "P in some districts" (question 60) | Up to 5 ft for a tall ground floor; NP in Folsom | 2026-01-12 |

### Batch 14: named NC districts, batch 8, confirmed 2026-10-19

Drafted 2026-10-19 from the official PDF (Tables 714, 721, 734, 743 and 746 and the sections they cite) and confirmed by the user in chat with the dates in the batch 8 table above; questions 62–66 stand as the cards describe them.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all five | §714 / §721 / §746 / §743 / §734, §207 (and §121.1, §145.4 where cited) | Matches each table's density, open space and ground-floor commercial rows and §121.1's lot-size limits | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | all five | §145.1(c)(4)(C) | 14 ft, 10 ft in 40- and 50-ft districts | 2018-09-10 |
| `rear-yard` | Broadway, Japantown / Lower Haight, Judah / Leland | §134(c)(2), (d)(3) / (d)(2) / §134(c)(2) and Table 746 (question 62) | 25%, at least 15 ft, above a non-residential first story | 2026-03-16 / 2026-01-12 / 2026-04-11 |
| `far` | all five | §124(a)–(b) (Table 124 for Broadway and Judah); district table | 2.5 (Broadway, Leland, Lower Haight, Judah), 3.6 (Japantown), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all five | §132(e) | As NC | 2026-01-12 |
| `buchanan-setback` (flag) | Japantown | Table 721 (question 64) | 1 ft back per ft above 35 ft on Buchanan Street between Post and Sutter; not drawn | 2026-04-11 |
| `ground-floor-bonus` (flag) | Japantown, Leland, Lower Haight, Judah | §263.20; Lower Haight's 40-X/50-X row (question 59) | Up to 5 ft for a tall ground floor; NP in Broadway | 2026-01-12 |

### Batch 15: named NC districts, batch 9, confirmed 2026-10-19

Drafted 2026-10-19 from the official PDF (Tables 727, 735, 742 and 744 and the sections they cite) and confirmed by the user in chat with the dates in the batch 9 table above; questions 67–69 stand as the cards describe them. Every named NCD/NCT district now has a verified file.

| Rule | Files | Citation | Result | `effectiveDate` |
|---|---|---|---|---|
| `use` | all four | §735 / §744 / §727 / §742, §207 (and §121.1 for Lower Polk) | Matches each table's density and open space rows and Lower Polk's lot-size row | 2026-04-11 (Ord. 37-26) |
| `ground-floor` | all four | §145.1(c)(4)(C) | 14 ft, 10 ft in 40- and 50-ft districts | 2018-09-10 |
| `rear-yard` | Lakeside Village, Cole Valley / Inner Balboa / Lower Polk | §134(c)(2), (d)(1) / (d)(2) / (d)(3) (question 67) | 25%, at least 15 ft: at grade and every story / above a non-residential first story | 2026-01-12 / 2026-01-12 / 2026-03-16 |
| `far` | all four | §124(a)–(b); district table (none is in Table 124) | 2.5 (Inner Balboa), 3.6 (Lower Polk), 1.8 (Lakeside Village, Cole Valley), non-residential only | 2026-01-12 |
| `front-setback` (flag) | all four | §132(e) | As NC | 2026-01-12 |
| `ground-floor-bonus` (flag) | all four | §263.20; Inner Balboa's 40-X/50-X row (question 59), the others' "P in some districts" (question 68) | Up to 5 ft for a tall ground floor; not drawn | 2026-01-12 |
