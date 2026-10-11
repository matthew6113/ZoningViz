// San Francisco jurisdiction: DataSF adapter, engine input mapping and the
// districts/*.json rule files. Browser-safe; Node-only code lives in ./node/.
export { createSfAdapter, normalizeBlklot, type SfAdapter } from "./adapter";
export { displayAddress, normalizeAddressQuery } from "./address";
export { TILE_LAYERS, type ParcelTileProps, type ZoningTileProps } from "./tiles";
export { DATASETS, DataSfError, EPSG_2227, fetchJson, type FetchJson } from "./datasf";
export { parseHeightLabel, type ParsedHeightLabel } from "./heightLabel";
export type * from "./types";
export { toParcelInput } from "./engineInput";
export { availableDistricts, loadDistrict } from "./districts";
export { coverageNote, zoningCodes, zoningCoverage, type ZoningCoverage } from "./zoning";
