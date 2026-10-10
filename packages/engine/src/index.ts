// @zoningviz/engine — resolves district rules against a parcel and builds the
// step-by-step envelope solids. Pure TypeScript + WebAssembly; no browser APIs.
export { createEngine, DEFAULT_FLOOR_TO_FLOOR_FT, START_HEIGHT_MULTIPLE, type Engine } from "./envelope";
export { syntheticLot } from "./fixtures";
export * from "./geometry/projection";
export { DistrictFileSchema, parseDistrictFile, RuleSchema, type DistrictFile, type Rule, type RuleKind } from "./rules/schema";
export type * from "./types";
