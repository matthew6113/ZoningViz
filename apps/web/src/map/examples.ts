// Lots the map offers under "Try one". The hosted demo build (`pnpm build-demo`)
// records the city data for exactly these, so they're the lots it can open.

export interface Example {
  id: string;
  label: string;
  note: string;
  /** Lot centroid; absent for synthetic fixtures, which open without a flight. */
  at?: [number, number];
}

export const EXAMPLES: Example[] = [
  { id: "4025007", label: "667 Hampshire St", note: "RH-2, mid-block", at: [-122.40779, 37.76102] },
  { id: "4025006", label: "2550 19th St", note: "RH-2 corner lot: you pick the front", at: [-122.40787, 37.76079] },
  { id: "4276045", label: "1391 Hampshire St", note: "RH-2 across two height districts", at: [-122.40674, 37.75021] },
  { id: "0044030", label: "766–772 Francisco St", note: "RH-2 condo lot in an R-4 district", at: [-122.41787, 37.80438] },
  { id: "2687029", label: "124 Clarendon Ave", note: "RH-1(D) falling 35 ft from the street: 30 ft cap", at: [-122.45195, 37.75864] },
  { id: "2820020", label: "118 Dellbrook Ave", note: "RH-1(D) rising 37 ft: 40 ft cap, no front plane", at: [-122.45381, 37.74876] },
  { id: "1646023", label: "752 4th Ave", note: "RH-1", at: [-122.46134, 37.77465] },
  { id: "0982019", label: "2120 Lyon St", note: "RH-3: no front height plane", at: [-122.44576, 37.79064] },
  { id: "0065024", label: "619–621 Chestnut St", note: "RM-2: 30% rear yard; floor-area limit for shops only", at: [-122.41359, 37.80349] },
  { id: "3593008", label: "2385–2389 Folsom St", note: "NC-2: shops below, rear yard from the second story up", at: [-122.41441, 37.7592] },
  { id: "0243017", label: "800 Powell St", note: "RM-4, 65-A: bulk limits trim the upper floors to 110 ft", at: [-122.40902, 37.79234] },
  { id: "1446048", label: "1345–1347 Clement St", note: "NC-1, 40//65-R-4: switch on Housing Choice-SF for 65 ft", at: [-122.47379, 37.78227] },
  { id: "0492027", label: "3249 Webster St", note: "RTO-C: 25% rear yard; 65 ft under Housing Choice-SF", at: [-122.43478, 37.80071] },
  { id: "3568002", label: "518–522 Valencia St", note: "Valencia Street NCT: a 14 ft shop floor in every height district", at: [-122.42214, 37.7645] },
  { id: "1738025", label: "1144 Irving St", note: "Inner Sunset NCD: rear yard at ground level too", at: [-122.47036, 37.76411] },
  { id: "fixture-a", label: "Fixture A", note: "synthetic 25 × 100 ft RH-2 lot (SPEC.md)" },
];
