import { describe, expect, it } from "vitest";
import { createSfAdapter } from "../adapter";

// Opt-in smoke test against the real DataSF API: LIVE=1 pnpm test
describe.skipIf(process.env.LIVE !== "1")("DataSF live", () => {
  const adapter = createSfAdapter();

  it("still serves the fields and query syntax the adapter relies on", async () => {
    const byLot = (await adapter.getParcelByBlockLot("4025007"))!;
    expect(byLot.zoning.code).toBe("RH-2");
    expect(byLot.lotAreaSqFt).toBeGreaterThan(2400);
    expect(byLot.heightDistricts.length).toBeGreaterThan(0);

    const atPoint = (await adapter.getParcelAt(byLot.centroid.lon, byLot.centroid.lat))!;
    expect(atPoint.blklot).toBe("4025007");
  });
});
