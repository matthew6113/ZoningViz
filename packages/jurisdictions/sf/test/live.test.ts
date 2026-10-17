import { describe, expect, it } from "vitest";
import { createSfAdapter } from "../adapter";
import { DATASETS, fetchJson, soqlUrl } from "../datasf";
import { SPECIAL_USE_NOTES } from "../specialUse";

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
    expect(byLot.specialUseDistricts).not.toBeNull();
  });

  it("still names the special use districts the notes refer to", async () => {
    const rows = (await fetchJson(soqlUrl(DATASETS.specialUseDistricts, { select: "name", group: "name", limit: 1000 }))) as { name: string }[];
    const names = new Set(rows.map((r) => r.name));
    for (const note of SPECIAL_USE_NOTES) {
      expect(names).toContain(note.name);
      for (const other of note.eligibility.excludedWith) expect(names).toContain(other.name);
    }
  });
});
