// San Francisco jurisdiction: DataSF adapter and (from Phase 2) districts/*.json rule files.
// Browser-safe; the Node-only disk cache lives in ./node/cache.ts.
export { createSfAdapter, normalizeBlklot, type SfAdapter } from "./adapter";
export { DATASETS, DataSfError, EPSG_2227, fetchJson, type FetchJson } from "./datasf";
export { parseHeightLabel, type ParsedHeightLabel } from "./heightLabel";
export type * from "./types";
