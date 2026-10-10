import { describe, expect, it } from "vitest";
import { parseHeightLabel } from "../heightLabel";
import recorded from "./fixtures/height-labels.json";

describe("parseHeightLabel", () => {
  it.each([
    ["40-X", { kind: "standard", heightFt: 40, bulk: "X" }],
    ["65-A-1", { kind: "standard", heightFt: 65, bulk: "A-1" }],
    ["1000-S-2", { kind: "standard", heightFt: 1000, bulk: "S-2" }],
    ["40//85-R-4", { kind: "r4", baseHeightFt: 40, localProgramHeightFt: 85 }],
    ["40//40-R-4", { kind: "r4", baseHeightFt: 40, localProgramHeightFt: 40 }],
  ])("parses %s", (label, expected) => {
    expect(parseHeightLabel(label)).toEqual(expected);
  });

  it.each(["120/400//120/650-R4", "140/400//140/450-R-4", "40/55-X", "45-TI", "OS", "None Stated", "CP", "Special Height District"])(
    "leaves %s unparsed rather than guessing",
    (label) => {
      expect(parseHeightLabel(label).kind).toBe("unparsed");
    },
  );

  it("handles every label in the live layer without throwing", () => {
    expect(recorded.rows).toHaveLength(269);
    const kinds = recorded.rows.map((row) => parseHeightLabel(row.height).kind);
    expect(kinds.filter((k) => k === "standard").length).toBeGreaterThan(100);
    expect(kinds.filter((k) => k === "r4").length).toBeGreaterThan(30);
  });

  it("matches the layer's gen_hght: standard = height, R-4 = local program height", () => {
    for (const row of recorded.rows) {
      const parsed = parseHeightLabel(row.height);
      const gen = Number(row.gen_hght);
      if (parsed.kind === "standard") expect(gen, row.height).toBe(parsed.heightFt);
      if (parsed.kind === "r4") {
        expect(parsed.baseHeightFt, row.height).toBeLessThanOrEqual(parsed.localProgramHeightFt);
        // The layer's numeric column holds the local program height, not the base.
        expect(gen, row.height).toBe(parsed.localProgramHeightFt);
      }
    }
  });
});
