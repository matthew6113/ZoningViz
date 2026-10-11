import { syntheticLot, type DistrictFile, type ParcelInput } from "@zoningviz/engine";
import {
  createSfAdapter,
  loadDistrict,
  toParcelInput,
  type SfAdapter,
  type SfBuilding,
  type SfParcel,
} from "@zoningviz/jurisdictions/sf";

/** What the fact card shows, for real lots and synthetic fixtures alike. */
export interface LotFacts {
  title: string;
  blklot: string | null;
  synthetic: boolean;
  zoningCode: string | null;
  zoningName: string | null;
  heightDistricts: { label: string; detail: string; share: number | null }[];
  lotAreaSqFt: number;
  unitCount: number;
  asOf: { label: string; date: string | null }[];
  warnings: string[];
}

export interface LoadedLot {
  id: string;
  facts: LotFacts;
  /** Null when no rule file covers this lot's zoning yet. */
  district: DistrictFile | null;
  input: ParcelInput | null;
  /** Nearby buildings for context, in the same coordinates as `input`. */
  buildings: SfBuilding[];
  /** Front setback to use when the URL doesn't set one (fixtures follow SPEC.md: none). */
  defaultSetbackFt: number | null;
  /** Where the lot is, for returning to it on the map. Null for synthetic fixtures. */
  center: { lon: number; lat: number } | null;
}

export class LotNotFoundError extends Error {}

const FIXTURES: Record<string, { title: string; width: number; depth: number }> = {
  "fixture-a": { title: "Fixture A: synthetic 25 × 100 ft lot", width: 25, depth: 100 },
  "fixture-b": { title: "Fixture B: synthetic 25 × 40 ft shallow lot", width: 25, depth: 40 },
};
// SPEC.md's fixtures A and B: RH-2 in a 40-X height district, no front setback.
const FIXTURE_ZONING = "RH-2";
const FIXTURE_HEIGHT_DISTRICT = { label: "40-X", heightFt: 40 };

export const isFixture = (id: string) => id in FIXTURES;

/** "4025007" → "4025"; "0792T001A" → "0792T". */
export function blockOf(blklot: string): string | null {
  return /^(\d{4}[A-Z]?)\d{3}[A-Z]?$/.exec(blklot)?.[1] ?? null;
}

let sharedAdapter: SfAdapter | null = null;
/** The one DataSF adapter the app uses (lot loading and address search). */
export const sfAdapter = () => (sharedAdapter ??= createSfAdapter());
const adapter = sfAdapter;

// One load per lot per visit: the map starts loading while it flies in, and the
// lot view picks up the same promise. Failures are forgotten so a retry refetches.
const loads = new Map<string, Promise<LoadedLot>>();

export function loadLot(id: string): Promise<LoadedLot> {
  let pending = loads.get(id);
  if (!pending) {
    pending = fetchLot(id);
    pending.catch(() => loads.delete(id));
    loads.set(id, pending);
  }
  return pending;
}

/** Starts loading a lot without waiting for it (errors surface when the lot view asks). */
export function prefetchLot(id: string): void {
  loadLot(id).catch(() => {});
}

async function fetchLot(id: string): Promise<LoadedLot> {
  const fixture = FIXTURES[id];
  if (fixture) return loadFixture(id, fixture);

  const parcel = await adapter().getParcelByBlockLot(id);
  if (!parcel) throw new LotNotFoundError(`No San Francisco parcel has block/lot ${id}.`);
  // Split-zoned lots ("RH-1|RH-2") get no district: they aren't modeled yet.
  const district = parcel.zoning.codes.length === 1 ? loadDistrict(parcel.zoning.codes[0]!) : null;
  const [neighbors, buildings] = await Promise.all([
    district ? adapter().getNeighbors(parcel) : Promise.resolve([]),
    adapter().getBuildings(parcel),
  ]);
  return {
    id,
    facts: parcelFacts(parcel, buildings.asOf),
    district,
    input: district ? toParcelInput(parcel, neighbors) : null,
    // Only buildings on the lot's own block: across-the-street buildings would
    // stand between the street-side camera and the lot.
    buildings: buildings.buildings.filter((b) => b.block !== null && b.block === blockOf(parcel.blklot)),
    defaultSetbackFt: null,
    center: parcel.centroid,
  };
}

function loadFixture(id: string, fixture: { title: string; width: number; depth: number }): LoadedLot {
  const district = loadDistrict(FIXTURE_ZONING)!;
  return {
    id,
    facts: {
      title: fixture.title,
      blklot: null,
      synthetic: true,
      zoningCode: FIXTURE_ZONING,
      zoningName: district.name,
      heightDistricts: [{ label: FIXTURE_HEIGHT_DISTRICT.label, detail: `${FIXTURE_HEIGHT_DISTRICT.heightFt} ft`, share: 1 }],
      lotAreaSqFt: fixture.width * fixture.depth,
      unitCount: 0,
      asOf: [],
      warnings: ["A synthetic test lot from SPEC.md, not a real parcel. Its neighbors are placeholders."],
    },
    district,
    input: syntheticLot(fixture.width, fixture.depth, FIXTURE_HEIGHT_DISTRICT),
    buildings: [],
    defaultSetbackFt: 0,
    center: null,
  };
}

function parcelFacts(parcel: SfParcel, buildingsAsOf: string | null): LotFacts {
  return {
    title: parcel.address.label ?? `Block/lot ${parcel.blklot}`,
    blklot: parcel.blklot,
    synthetic: false,
    zoningCode: parcel.zoning.code,
    zoningName: parcel.zoning.name,
    heightDistricts: parcel.heightDistricts.map((d) => ({
      label: d.label,
      share: d.shareOfLot,
      detail:
        d.parsed.kind === "standard"
          ? `${d.parsed.heightFt} ft, bulk ${d.parsed.bulk}`
          : d.parsed.kind === "r4"
            ? `base ${d.parsed.baseHeightFt} ft; local program ${d.parsed.localProgramHeightFt} ft`
            : "not modeled",
    })),
    lotAreaSqFt: parcel.lotAreaSqFt,
    unitCount: parcel.unitBlklots.length,
    asOf: [
      { label: "Parcels", date: parcel.asOf.parcels },
      { label: "Height districts", date: parcel.asOf.heightDistricts },
      { label: "Buildings (2010 LiDAR heights)", date: buildingsAsOf },
    ],
    warnings: parcel.warnings,
  };
}

