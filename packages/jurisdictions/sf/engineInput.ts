import type { HeightZoneInput, ParcelInput } from "@zoningviz/engine";
import { EPSG_2227 } from "./datasf";
import type { SfNeighbor, SfParcel } from "./types";

/** Builds the engine's city-agnostic input from an SF parcel and its neighbors. */
export function toParcelInput(parcel: SfParcel, neighbors: SfNeighbor[]): ParcelInput {
  const heightZones = parcel.heightDistricts.flatMap((d): HeightZoneInput[] => {
    if (!d.geometry) return [];
    const { parsed } = d;
    return [
      {
        label: d.label,
        // R-4: the base height governs; the local program height is shown, never cut to.
        heightFt: parsed.kind === "standard" ? parsed.heightFt : parsed.kind === "r4" ? parsed.baseHeightFt : null,
        localProgramHeightFt: parsed.kind === "r4" ? parsed.localProgramHeightFt : null,
        geometry: d.geometry,
      },
    ];
  });
  return {
    id: parcel.blklot,
    projection: EPSG_2227,
    footprint: parcel.geometry,
    neighbors: neighbors.map((n) => n.geometry),
    heightZones,
  };
}
