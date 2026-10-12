import { loadDistrict, type SfAdapter } from "@zoningviz/jurisdictions/sf";

/**
 * Every city request a lot needs, in one place: the lot view runs it, and
 * `pnpm build-demo` runs it to record the example lots for the hosted demo.
 */
export async function fetchLotData(adapter: SfAdapter, blklot: string) {
  const parcel = await adapter.getParcelByBlockLot(blklot);
  if (!parcel) return null;
  // Split-zoned lots ("RH-1|RH-2") get no district: they aren't modeled yet.
  const district = parcel.zoning.codes.length === 1 ? loadDistrict(parcel.zoning.codes[0]!) : null;
  const [neighbors, buildings, terrain] = await Promise.all([
    district ? adapter.getNeighbors(parcel) : Promise.resolve([]),
    adapter.getBuildings(parcel),
    district ? adapter.getTerrain(parcel) : Promise.resolve(null),
  ]);
  return { parcel, district, neighbors, buildings, terrain };
}
