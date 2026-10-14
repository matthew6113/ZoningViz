import { createEngine, syntheticLot, type EnvelopeOptions } from "@zoningviz/engine";
import { loadDistrict } from "@zoningviz/jurisdictions/sf";
import { describe, expect, it } from "vitest";
import { withStills } from "../anim/stills";
import { ENVELOPE_OPACITY, initialState } from "../anim/timeline";
import type { LotFacts } from "../data/loadLot";
import type { OkResult } from "../state/steps";
import { fileName, HONESTY_LINE, shareLink, skippedLine, storyboardCaption, viewCaption, wrapText, type ShareContext } from "./content";

// Fixture A (SPEC.md), computed by the real engine: 11 rules, the rear yard is rule 6.
const engine = await createEngine();
const NO_SETBACK: EnvelopeOptions = { overrides: { "front-setback": { feet: 0 } } };
const compute = (district: string, heightDistrict: Parameters<typeof syntheticLot>[2], options: EnvelopeOptions = NO_SETBACK) =>
  engine.computeEnvelope(syntheticLot(25, 100, heightDistrict), loadDistrict(district)!, { ...NO_SETBACK, ...options }) as OkResult;
const fixtureA = compute("RH-2", { label: "40-X", heightFt: 40, bulk: "X" });

const facts = (title: string, zoningCode: string, label: string): LotFacts => ({
  title,
  blklot: null,
  synthetic: true,
  zoningCode,
  zoningName: null,
  heightDistricts: [{ label, detail: "", share: 1 }],
  lotAreaSqFt: 2500,
  unitCount: 0,
  asOf: [],
  warnings: [],
});
const ctxA: ShareContext = {
  facts: facts("Fixture A: synthetic 25 × 100 ft lot", "RH-2", "40-X"),
  result: fixtureA,
  href: "https://example.test/ZoningViz/?parcel=fixture-a&step=6&off=front-plane,bulk&at=-122.40779,37.76102,18.00",
  program: null,
};

describe("storyboard", () => {
  const board = storyboardCaption(ctxA);

  it("has a tile for the start, each rule that cuts, and the result", () => {
    expect(board.tiles.map((t) => [t.position, t.title])).toEqual([
      [0, "Start"],
      [4, "4. Height limit"],
      [6, "6. Rear yard"],
      [8, "8. Front height plane"],
      [12, "Result"],
    ]);
    expect(board.tiles[2]).toMatchObject({ detail: "30,000 cu ft removed", removedCuFt: 30_000 });
    expect(board.tiles[0]!.detail).toBe("The lot, up to 80 ft");
    expect(board.tiles[4]).toMatchObject({ detail: "68,750 cu ft · 4 stories · 6,875 sq ft", removedCuFt: null });
  });

  it("names the rules that didn't change the shape, then the honesty line", () => {
    expect(board.footer[0]).toBe(
      "Already satisfied: RH-2 dwelling cap, Front setback · Doesn't apply: Housing Choice-SF, Bulk limits · Not modeled: Narrow streets, Cross-slope",
    );
    expect(board.footer).toContain(HONESTY_LINE);
    expect(board.footer).toContain("All 11 rules are verified.");
    // A draft rule is counted and tagged.
    const draft = { ...fixtureA, steps: fixtureA.steps.map((s, i) => (i === 5 ? { ...s, rule: { ...s.rule, verified: false } } : s)) };
    expect(storyboardCaption({ ...ctxA, result: draft }).footer).toContain("1 of 11 rules are unverified drafts.");
    expect(viewCaption({ ...ctxA, result: draft }, 6).unverified).toBe(true);
  });

  it("links to the lot from the start, keeping the options but not the map view", () => {
    expect(board.link).toBe("https://example.test/ZoningViz/?parcel=fixture-a&off=front-plane,bulk");
  });
});

describe("view caption", () => {
  it("shows the rule's sentence, removed volume, citation and unverified status", () => {
    const caption = viewCaption(ctxA, 6);
    expect(caption.heading).toBe("Fixture A: synthetic 25 × 100 ft lot");
    expect(caption.details).toBe("RH-2 · 40-X");
    expect(caption.step).toBe("Rule 6 of 11: Rear yard");
    expect(caption.body).toEqual(["Rear yard: 30% of 100 ft lot depth = 30 ft."]);
    expect(caption.removed?.cuFt).toBeCloseTo(30_000, 3);
    expect(caption.citation).toMatch(/§134/);
    expect(caption.unverified).toBe(false); // checked in the verification pass
    expect(caption.link).toBe("https://example.test/ZoningViz/?parcel=fixture-a&step=6&off=front-plane,bulk");
  });

  it("shows the totals at the result and the block at the start", () => {
    expect(viewCaption(ctxA, 12).body).toEqual([
      "Envelope 68,750 cu ft · footprint 1,750 sq ft",
      "4 stories · 6,875 sq ft of floor area",
      "34.4% of the block survived",
    ]);
    expect(viewCaption(ctxA, 12).removed).toBeNull();
    expect(viewCaption(ctxA, 0).step).toBe("Start: everything up to 80 ft");
  });

  it("says when Housing Choice-SF is on and what it adds (fixture Q)", () => {
    const r4 = { label: "40//65-R-4", heightFt: 40, localProgramHeightFt: 65, bulk: "R-4" };
    const on = compute("NC-2", r4, { localProgram: true });
    const off = compute("NC-2", r4);
    const caption = viewCaption(
      { ...ctxA, facts: facts("Q", "NC-2", "40//65-R-4"), result: on, program: { title: "Housing Choice-SF", without: off.totals } },
      on.steps.length + 1,
    );
    expect(caption.details).toBe("NC-2 · 40//65-R-4 · Housing Choice-SF on");
    expect(caption.body).toContain("Without Housing Choice-SF: 8,125 sq ft in 4 stories (+4,625 sq ft, +2 stories with the program)");
    expect(caption.body).toContain("Non-residential cap 6,250 sq ft (FAR 2.5; homes aren't limited)");
  });
});

describe("helpers", () => {
  it("names files after the lot and the step", () => {
    expect(fileName(ctxA.facts, fixtureA, "view", 6)).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-rule-6.png");
    expect(fileName(ctxA.facts, fixtureA, "view", 0)).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-start.png");
    expect(fileName(ctxA.facts, fixtureA, "view", 12)).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-result.png");
    expect(fileName(ctxA.facts, fixtureA, "storyboard", 6)).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-storyboard.png");
    expect(fileName({ ...ctxA.facts, title: "1345–1347 Clement St" }, fixtureA, "view", 7)).toBe("zoningviz-1345-1347-clement-st-rule-7.png");
  });

  it("strips the map view from links", () => {
    expect(shareLink("https://a.test/?parcel=1&at=1,2,3&program=1", "view")).toBe("https://a.test/?parcel=1&program=1");
  });

  it("wraps at word boundaries and ends a cut-off paragraph with an ellipsis", () => {
    const measure = (text: string) => text.length * 10;
    expect(wrapText(measure, "aaa bbb ccc", 70)).toEqual(["aaa bbb", "ccc"]);
    expect(wrapText(measure, "aaa bbb ccc", 70, 1)).toEqual(["aaa…"]);
    expect(wrapText(measure, "", 70)).toEqual([]);
  });

  it("has nothing to list when every rule cut", () => {
    expect(skippedLine(fixtureA.steps.filter((s) => s.status === "cut"))).toBeNull();
  });
});

describe("stills", () => {
  it("rests each requested step with its red piece showing, then restores the scene's state", () => {
    const anim = initialState(fixtureA);
    anim.camera = 0.42; // mid-arrival, say
    const before = { ...anim };
    const stills = withStills(fixtureA, "full", anim, [0, 6, 12], () => ({ ...anim }));
    expect(stills[0]).toMatchObject({ rule: -1, camera: 1, rise: 1 });
    expect(stills[1]).toMatchObject({ rule: 5, tint: 1, removedOpacity: ENVELOPE_OPACITY, labelOpacity: 1, lift: 0, camera: 1 });
    expect(stills[2]).toMatchObject({ finale: 1, floors: 4 });
    expect(anim).toMatchObject(before); // GSAP keeps a cache on the object too; every state field is back
  });
});
