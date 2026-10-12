// Records real SF parcels as engine inputs for offline tests:
//   pnpm record-fixtures [blklot ...]
// Writes packages/engine/test/fixtures/parcels/<blklot>.json.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createSfAdapter } from "../packages/jurisdictions/sf/adapter";
import { toParcelInput } from "../packages/jurisdictions/sf/engineInput";
import { devFetchJson } from "../packages/jurisdictions/sf/node/cache";

const DEFAULT = ["4025007", "4025006", "4276045", "0044030"];
const OUT = join(import.meta.dirname, "..", "packages", "engine", "test", "fixtures", "parcels");

const adapter = createSfAdapter({ fetchJson: devFetchJson() });
await mkdir(OUT, { recursive: true });
for (const blklot of process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT) {
  const parcel = await adapter.getParcelByBlockLot(blklot);
  if (!parcel) throw new Error(`No parcel ${blklot}`);
  const [neighbors, terrain] = await Promise.all([adapter.getNeighbors(parcel), adapter.getTerrain(parcel)]);
  const input = toParcelInput(parcel, neighbors, terrain);
  const meta = {
    source: "DataSF acdm-wktn + h9wh-cg3m, USGS 3DEP elevations, via scripts/record-engine-fixtures.mts",
    address: parcel.address.label,
    zoning: parcel.zoning.code,
    asOf: { ...parcel.asOf, terrain: terrain?.asOf ?? null },
  };
  await writeFile(join(OUT, `${blklot}.json`), JSON.stringify({ _meta: meta, ...input }));
  console.log(`${blklot}  ${parcel.address.label}  ${input.neighbors.length} neighbors  ${input.heightZones.map((z) => z.label).join(", ")}`);
}
