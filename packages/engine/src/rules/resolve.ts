import type { EnvelopeOptions } from "../types";
import type { DistrictFile, Rule } from "./schema";

// Turns a rule's params into concrete numbers for one lot, the sentence its
// card shows, and the cut the geometry stage should make. No geometry here.

export interface ZoneContext {
  label: string;
  /** The height that governs here: the local program's when it is on and covers this zone, else the mapped height. */
  heightFt: number | null;
  /** The mapped height without any local program. */
  baseHeightFt: number | null;
  localProgramHeightFt: number | null;
  /** True when the local program is on and sets this zone's height. */
  inProgram: boolean;
  /** Fraction of the lot inside this zone. */
  share: number;
  /** The mapped bulk district (e.g. "A", "X", "R-4"), or null when the label can't be read. */
  bulk: string | null;
}

export interface ResolveContext {
  widthFt: number;
  depthFt: number;
  lotAreaSqFt: number;
  zones: ZoneContext[];
  /** The front setback in force, for planes measured from the setback line. Null if the district has none. */
  frontSetbackFt: number | null;
  /** Average ground along the front and rear lot lines (and the curb estimate), or null for a flat lot. */
  ground: { curbFt: number; frontAverageFt: number; rearAverageFt: number } | null;
  /** How heights are measured on this lot (from the height_reference rule and the ground). */
  reference: "flat" | "curb" | "upslope";
  /** The first story's height from the district's ground_story rule, or null if it has none. */
  firstStory: FirstStory | null;
  /** The district's local program, or null if it has none. */
  program: LocalProgram | null;
  /** Plan areas measured on the lot, for rules that set how much of it may be built (filled in by the geometry stage). */
  areas: LotAreas;
}

export interface LotAreas {
  /** How far back from the front line the lot runs before the part behind that line has this area. */
  depthForRearArea(areaSqFt: number): number;
  /** The lot's area within this distance of a street side. */
  streetBandSqFt(withinFt: number): number;
}

/** A district's local program, resolved for one lot. */
export interface LocalProgram {
  title: string;
  /** Some zone of the lot carries a local-program height. */
  eligible: boolean;
  /** Switched on, and the lot is eligible: the program's heights and rule changes apply. */
  active: boolean;
  cornerLot: boolean;
  /** Larger than the program's large-lot area. */
  largeLot: boolean;
  /** True when the program's minimum height applies to this lot (corner or large lot). */
  minHeightApplies: boolean;
  /** The height the program allows in each zone (same order as the zones), or null where it doesn't apply. */
  heights: (number | null)[];
  /** Later rules the program waives or replaces, by id, with their titles and the program's citations. */
  waived: Map<string, { title: string; because: string; citation: string }>;
  replaced: Map<string, { title: string; params: unknown; citation: string }>;
}

export interface FirstStory {
  feet: number;
  /** The mapped height that chose it (the zone covering most of the lot), or null if none is readable. */
  heightDistrictFt: number | null;
  /** True when a height-district exception applied. */
  exception: boolean;
}

export type Cut =
  | { type: "none" }
  | { type: "uniform_height"; heightFt: number }
  /** One height per zone (same order as the context); null leaves that zone uncut. */
  | { type: "zone_heights"; heights: (number | null)[] }
  /** Keep only what lies within `depthFt` of the front line (rear yard); with `aboveFt`, only above that height (the first story may fill the yard). */
  | { type: "max_depth"; depthFt: number; aboveFt?: number }
  /** Keep only what lies within `withinFt` of a street side (lot coverage); with `aboveFt`, only above that height. */
  | { type: "street_band"; withinFt: number; aboveFt?: number }
  /** Keep only what lies at least `depthFt` behind the front line (front setback). */
  | { type: "min_depth"; depthFt: number }
  /** Keep what lies under a plane rising at `angleDeg` from `startHeightFt`, `fromDepthFt` behind the front line. */
  | { type: "plane"; fromDepthFt: number; startHeightFt: number; angleDeg: number }
  /** Keep what lies at least `leftFt` from the left side of the lot and `rightFt` from the right (seen from the street). */
  | { type: "side_strips"; leftFt: number; rightFt: number }
  /** Per height zone (same order as the context): plan limits above a height, or null for no limit there. Boxes are chosen by the geometry stage. */
  | { type: "bulk"; zones: (BulkZoneCut | null)[] };

export interface BulkZoneCut {
  label: string;
  aboveFt: number;
  lengthFt: number;
  diagonalFt: number;
  /** Filled in by the geometry stage (regions.planBulk). */
  plan?: BulkPlan;
}

export interface BulkPlan {
  /** The envelope above the bulk height, measured across (width) and along (depth) the lot frame, and corner to corner. Null if nothing is there. */
  measured: { widthFt: number; depthFt: number; diagonalFt: number } | null;
  /** The kept box in lot-frame coordinates (s across, d back from the front line), or null when the envelope already fits. */
  box: { s0: number; s1: number; d0: number; d1: number } | null;
}

export interface Resolved {
  status: "cut" | "info" | "not_applicable" | "not_modeled";
  sentence: string;
  numbers: Record<string, number>;
  cut: Cut;
}

/**
 * The district's local program for this lot: which zones it covers and the
 * height it allows there. `on` is the viewer's switch; nothing changes unless
 * it is on and some zone carries a local-program height.
 */
export function planLocalProgram(
  district: DistrictFile,
  zones: { localProgramHeightFt?: number | null }[],
  lot: { cornerLot: boolean; areaSqFt: number },
  on: boolean,
): LocalProgram | null {
  const rule = district.rules.find((r) => r.kind === "local_program");
  if (!rule) return null;
  const { minHeight, waives, replaces } = rule.params;
  const largeLot = lot.areaSqFt > minHeight.lotAreaOverSqFt;
  const minHeightApplies = (minHeight.onCornerLot && lot.cornerLot) || largeLot;
  const heights = zones.map(({ localProgramHeightFt: local }) =>
    local === null || local === undefined ? null : minHeightApplies ? Math.max(local, minHeight.feet) : local,
  );
  const eligible = heights.some((h) => h !== null);
  const title = (id: string) => district.rules.find((r) => r.id === id)?.title ?? id;
  return {
    title: rule.title,
    eligible,
    active: on && eligible,
    cornerLot: lot.cornerLot,
    largeLot,
    minHeightApplies,
    heights,
    waived: new Map(waives.map((w) => [w.ruleId, { title: title(w.ruleId), because: w.because, citation: w.citation }])),
    replaced: new Map(replaces.map((r) => [r.ruleId, { title: title(r.ruleId), params: r.params, citation: r.citation }])),
  };
}

export function resolveFrontSetback(district: DistrictFile, options: EnvelopeOptions): number | null {
  const rule = district.rules.find((r) => r.kind === "front_setback");
  if (!rule) return null;
  return frontSetbackFeet(rule, options);
}

/** The first story's height for this lot, from the district's ground_story rule (null if it has none). */
export function resolveFirstStory(district: DistrictFile, zones: ZoneContext[]): FirstStory | null {
  const rule = district.rules.find((r) => r.kind === "ground_story");
  if (!rule) return null;
  const readable = zones.filter((z) => z.heightFt !== null).sort((a, b) => b.share - a.share);
  const heightDistrictFt = readable[0]?.heightFt ?? null;
  const exception = heightDistrictFt === null ? undefined : rule.params.exceptions.find((e) => e.heightDistrictFeet.includes(heightDistrictFt));
  return { feet: exception?.minFloorToFloorFeet ?? rule.params.minFloorToFloorFeet, heightDistrictFt, exception: exception !== undefined };
}

function frontSetbackFeet(rule: Extract<Rule, { kind: "front_setback" }>, options: EnvelopeOptions): number {
  const override = options.overrides?.[rule.id]?.feet;
  if (rule.params.userOverride && override !== undefined && Number.isFinite(override)) {
    return Math.min(Math.max(override, 0), rule.params.maxFeet);
  }
  return rule.params.maxFeet;
}

export function resolveRule(rule: Rule, ctx: ResolveContext, options: EnvelopeOptions): Resolved {
  switch (rule.kind) {
    case "info":
      return { status: "info", sentence: rule.plain, numbers: {}, cut: { type: "none" } };

    case "flag":
      return { status: "not_modeled", sentence: `Not modeled: ${rule.plain}`, numbers: {}, cut: { type: "none" } };

    case "height_cap": {
      if ("feet" in rule.params) {
        const feet = rule.params.feet;
        return {
          status: "cut",
          sentence: `${rule.title}: no part of the building above ${ft(feet)}.`,
          numbers: { heightFt: feet },
          cut: { type: "uniform_height", heightFt: feet },
        };
      }
      return resolveMappedHeight(rule, ctx);
    }

    case "rear_yard": {
      const { pctOfLotDepth, minFeet, appliesAt } = rule.params;
      const fromPct = pctOfLotDepth * ctx.depthFt;
      const rearYardFt = Math.max(fromPct, minFeet);
      const base = `${rule.title}: ${pct(pctOfLotDepth)} of ${ft(ctx.depthFt)} lot depth = ${ft(fromPct)}`;
      const sentence =
        fromPct >= minFeet
          ? `${base}.`
          : `${base}, below the ${ft(minFeet)} minimum, so ${ft(rearYardFt)}.`;
      const depthFt = Math.max(ctx.depthFt - rearYardFt, 0);
      const numbers = { lotDepthFt: ctx.depthFt, pctOfLotDepth, minFeet, rearYardFt };
      if (appliesAt === "above_first_story") {
        // The schema requires a ground_story rule first, so the first story is known.
        const aboveFt = ctx.firstStory!.feet;
        return {
          status: "cut",
          sentence:
            `${sentence} It starts above the ${ft(aboveFt)} first story, assuming a shop or other non-residential use there; ` +
            "a first story with homes would need the yard at ground level too.",
          numbers: { ...numbers, aboveFt },
          cut: { type: "max_depth", depthFt, aboveFt },
        };
      }
      return { status: "cut", sentence, numbers, cut: { type: "max_depth", depthFt } };
    }

    case "front_setback": {
      const setbackFt = frontSetbackFeet(rule, options);
      const { maxFeet } = rule.params;
      const overridden = rule.params.userOverride && options.overrides?.[rule.id]?.feet !== undefined;
      const sentence = overridden
        ? `${rule.title}: ${ft(setbackFt)}, your setting. The rule matches the shallower neighbor's setback, up to ${ft(maxFeet)}.`
        : `${rule.title}: as deep as the shallower neighbor's setback, up to ${ft(maxFeet)}. City data doesn't include neighbors' setbacks, so this shows the ${ft(maxFeet)} maximum.`;
      return {
        status: "cut",
        sentence,
        numbers: { setbackFt, maxFeet },
        cut: { type: "min_depth", depthFt: setbackFt },
      };
    }

    case "side_yard":
      return resolveSideYard(rule, ctx);

    case "height_reference":
      return resolveHeightReference(rule, ctx);

    case "height_by_slope":
      return resolveHeightBySlope(rule, ctx);

    case "ground_story": {
      const story = ctx.firstStory!;
      if (rule.params.exceptions.length === 0) {
        return {
          status: "info",
          sentence:
            `${rule.title}: a shop or other non-residential ground floor must be at least ${ft(story.feet)} floor to floor, in every height district. ` +
            `The first story is drawn ${ft(story.feet)} tall; a taller one is allowed.`,
          numbers: { firstStoryFt: story.feet, ...(story.heightDistrictFt === null ? {} : { heightDistrictFt: story.heightDistrictFt }) },
          cut: { type: "none" },
        };
      }
      const where =
        story.heightDistrictFt === null
          ? "the mapped height can't be read here"
          : story.exception
            ? `this lot is in a ${ft(story.heightDistrictFt)} height district (${ft(rule.params.minFloorToFloorFeet)} elsewhere)`
            : `this lot is in a ${ft(story.heightDistrictFt)} height district`;
      return {
        status: "info",
        sentence:
          `${rule.title}: a shop or other non-residential ground floor must be at least ${ft(story.feet)} floor to floor, because ${where}. ` +
          `The first story is drawn ${ft(story.feet)} tall; a taller one is allowed.`,
        numbers: { firstStoryFt: story.feet, ...(story.heightDistrictFt === null ? {} : { heightDistrictFt: story.heightDistrictFt }) },
        cut: { type: "none" },
      };
    }

    case "bulk":
      return resolveBulk(rule, ctx);

    case "lot_coverage":
      return resolveLotCoverage(rule, ctx);

    case "local_program":
      return resolveLocalProgram(rule, ctx);

    case "far": {
      const { ratio, appliesTo } = rule.params;
      const budgetSqFt = ratio * ctx.lotAreaSqFt;
      if (appliesTo === "all_uses") {
        return {
          status: "info",
          sentence:
            `${rule.title}: ${ratio} to 1, so all floor area, homes included, may total ${ratio} × ${sqft(ctx.lotAreaSqFt)} = ${sqft(budgetSqFt)}. ` +
            "It limits how much of the envelope may be built, not its shape.",
          numbers: { ratio, lotAreaSqFt: ctx.lotAreaSqFt, budgetSqFt },
          cut: { type: "none" },
        };
      }
      return {
        status: "info",
        sentence:
          `${rule.title}: ${ratio} to 1 for non-residential uses, so shops, offices and other non-residential floor area may total ` +
          `${ratio} × ${sqft(ctx.lotAreaSqFt)} = ${sqft(budgetSqFt)}. Homes don't count toward it.`,
        numbers: { ratio, lotAreaSqFt: ctx.lotAreaSqFt, budgetSqFt },
        cut: { type: "none" },
      };
    }

    case "sky_plane": {
      const { fromLine, startHeightFeet, angleDeg, skipWhenRearHigherByFeet: skip } = rule.params;
      if (skip !== undefined && ctx.ground) {
        const rise = ctx.ground.rearAverageFt - ctx.ground.frontAverageFt;
        if (rise >= skip) {
          return {
            status: "not_applicable",
            sentence: `${rule.title}: doesn't apply, because the rear lot line averages ${ft(rise)} higher than the front (${ft(skip)} or more).`,
            numbers: { rearMinusFrontFt: rise },
            cut: { type: "none" },
          };
        }
      }
      const fromDepthFt = fromLine === "front_setback" ? (ctx.frontSetbackFt ?? 0) : 0;
      const where =
        fromLine === "front_setback"
          ? ctx.frontSetbackFt === null
            ? "the front lot line (this district has no front setback rule)"
            : `the front setback line, ${ft(fromDepthFt)} back`
          : "the front lot line";
      return {
        status: "cut",
        sentence: `${rule.title}: above ${ft(startHeightFeet)}, the building steps back at ${angleDeg}° from ${where}.`,
        numbers: { fromDepthFt, startHeightFt: startHeightFeet, angleDeg },
        cut: { type: "plane", fromDepthFt, startHeightFt: startHeightFeet, angleDeg },
      };
    }
  }
}

// A street band within this much of the lot's area counts as the whole lot (outline noise).
const WHOLE_LOT_TOLERANCE_SQFT = 0.5;

/**
 * Lot coverage leaves the code two ways to build a level with homes: cover the
 * allowed share anywhere, or cover the whole level where every home is within
 * the street distance. The card draws whichever builds more: the open share
 * across the back (where the neighbors' rear yards are), or the street band.
 */
function resolveLotCoverage(rule: Extract<Rule, { kind: "lot_coverage" }>, ctx: ResolveContext): Resolved {
  const { maxCoverage, appliesAt, streetExemptionFeet: withinFt } = rule.params;
  const lotSqFt = ctx.lotAreaSqFt;
  const coveredSqFt = maxCoverage * lotSqFt;
  const openSqFt = lotSqFt - coveredSqFt;
  const bandSqFt = Math.min(ctx.areas.streetBandSqFt(withinFt), lotSqFt);
  const numbers = { maxCoverage, lotAreaSqFt: lotSqFt, coveredSqFt, openSqFt, withinFt, streetBandSqFt: bandSqFt };
  const limit =
    `${rule.title}: levels with homes may cover at most ${pct(maxCoverage)} of the ${sqft(lotSqFt)} lot (${sqft(coveredSqFt)}), ` +
    `or all of it where every home on the level is within ${ft(withinFt)} of a street`;
  if (bandSqFt >= lotSqFt - WHOLE_LOT_TOLERANCE_SQFT) {
    return {
      status: "not_applicable",
      sentence: `${limit}. Every part of this lot is within ${ft(withinFt)} of a street, so it may be fully built.`,
      numbers,
      cut: { type: "none" },
    };
  }
  // The schema requires a ground_story rule before an above-first-story limit, so the first story is known.
  const aboveFt = appliesAt === "above_first_story" ? ctx.firstStory!.feet : undefined;
  const above =
    aboveFt === undefined
      ? ""
      : ` It starts above the ${ft(aboveFt)} first story, assuming a shop or other non-residential use there; a first story with homes would be limited too.`;
  const withAbove: { aboveFt?: number } = aboveFt === undefined ? {} : { aboveFt };
  const numbersAbove: Record<string, number> = aboveFt === undefined ? {} : { aboveFt };
  if (bandSqFt > coveredSqFt) {
    return {
      status: "cut",
      sentence:
        `${limit}. Here the ${ft(withinFt)} band (${sqft(bandSqFt)}) builds more, so it is drawn and the ${sqft(lotSqFt - bandSqFt)} beyond it stays open, ` +
        `one allowed layout.${above}`,
      numbers: { ...numbers, ...numbersAbove },
      cut: { type: "street_band", withinFt, ...withAbove },
    };
  }
  const depthFt = ctx.areas.depthForRearArea(openSqFt);
  const openDepthFt = Math.max(ctx.depthFt - depthFt, 0);
  return {
    status: "cut",
    sentence:
      `${limit} (here that band is only ${sqft(bandSqFt)}). The open ${sqft(openSqFt)} is drawn across the back, ${ft(openDepthFt)} deep, ` +
      `since it must adjoin the neighbors' rear yards where they have them; that is one allowed layout, as the code sets its area, not its shape.${above}`,
    numbers: { ...numbers, openDepthFt, ...numbersAbove },
    cut: { type: "max_depth", depthFt, ...withAbove },
  };
}

function resolveHeightReference(rule: Extract<Rule, { kind: "height_reference" }>, ctx: ResolveContext): Resolved {
  const { downslopeCurbDepthFeet, upslopeCurbWithinFeet } = rule.params;
  const base = { status: "info" as const, cut: { type: "none" as const } };
  if (!ctx.ground || ctx.reference === "flat") {
    return { ...base, sentence: `${rule.title}: no ground elevations for this lot, so it is treated as flat.`, numbers: {} };
  }
  const curb = `the curb (estimated at ${ft(ctx.ground.curbFt)}, the ground at the middle of the front lot line)`;
  if (ctx.reference === "upslope") {
    return {
      ...base,
      sentence:
        `${rule.title}: the lot slopes up from the street, so heights are measured from ${curb} within ${ft(upslopeCurbWithinFeet)} ` +
        "of the front lot line and, farther back, from the average ground at the two side lot lines of each cross-section.",
      numbers: { curbFt: ctx.ground.curbFt, curbWithinFt: upslopeCurbWithinFeet },
    };
  }
  const deep =
    ctx.depthFt > downslopeCurbDepthFeet
      ? ` The curb applies to the first ${ft(downslopeCurbDepthFeet)}, or halfway to the street behind if that's farther; beyond that, the code measures from the lower end of the lot. That isn't modeled: the curb is used for the whole lot.`
      : "";
  return {
    ...base,
    sentence: `${rule.title}: the lot is level with or slopes down from the street, so heights are measured from ${curb}.${deep}`,
    numbers: { curbFt: ctx.ground.curbFt },
  };
}

function resolveHeightBySlope(rule: Extract<Rule, { kind: "height_by_slope" }>, ctx: ResolveContext): Resolved {
  const { baseFeet, steps } = rule.params;
  const cap = (heightFt: number, sentence: string, numbers: Record<string, number>): Resolved => ({
    status: "cut",
    sentence,
    numbers: { baseFeet, heightFt, ...numbers },
    cut: { type: "uniform_height", heightFt },
  });
  if (!ctx.ground) {
    return cap(baseFeet, `${rule.title}: no ground elevations for this lot, so this assumes a flat lot: ${ft(baseFeet)}.`, {});
  }
  const { frontAverageFt: front, rearAverageFt: rear } = ctx.ground;
  const rise = rear - front;
  const direction = rise >= 0 ? "higher" : "lower";
  const candidates = steps.filter((step) => step.rear === direction);
  const matched = candidates
    .filter((step) => Math.abs(rise) >= step.byAtLeastFeet)
    .sort((a, b) => b.byAtLeastFeet - a.byAtLeastFeet)[0];
  const where = `the rear lot line averages ${ft(Math.abs(rise))} ${direction} than the front (${ft(rear)} vs ${ft(front)})`;
  const numbers = { rearMinusFrontFt: rise, frontAverageFt: front, rearAverageFt: rear };
  if (matched) {
    return cap(
      matched.feet,
      `${rule.title}: ${where}, ${ft(matched.byAtLeastFeet)} or more, so ${ft(matched.feet)} instead of ${ft(baseFeet)}.`,
      numbers,
    );
  }
  const nearest = candidates.map((step) => step.byAtLeastFeet).sort((a, b) => a - b)[0];
  return cap(
    baseFeet,
    nearest === undefined ? `${rule.title}: ${where}, so ${ft(baseFeet)}.` : `${rule.title}: ${where}, less than ${ft(nearest)}, so ${ft(baseFeet)}.`,
    numbers,
  );
}

function resolveLocalProgram(rule: Extract<Rule, { kind: "local_program" }>, ctx: ResolveContext): Resolved {
  const program = ctx.program;
  const none = { type: "none" as const };
  if (!program?.eligible) {
    return {
      status: "not_applicable",
      sentence: `${rule.title}: doesn't apply, because no part of this lot has a local-program height.`,
      numbers: {},
      cut: none,
    };
  }
  const { minHeight, assumes, notDrawn } = rule.params;
  const on = program.active;
  const covered = ctx.zones.flatMap((zone, i) => {
    const height = program.heights[i];
    return height === null || height === undefined ? [] : [{ zone, height }];
  });
  const heights = covered.map(({ zone, height }) => {
    const base = zone.baseHeightFt;
    const where = covered.length > 1 || ctx.zones.length > 1 ? ` in ${zone.label}` : "";
    if (base === height) return `${on ? "stays" : "would stay"} ${ft(height)}${where}`;
    return `${on ? "is" : "would be"} ${ft(height)}${where} instead of ${base === null ? "an unreadable base height" : ft(base)}`;
  });
  const why = [program.cornerLot && minHeight.onCornerLot ? "a corner lot (two of its street sides meet at an angle on the parcel map)" : null, program.largeLot ? `larger than ${sqft(minHeight.lotAreaOverSqFt)}` : null].filter(
    (w): w is string => w !== null,
  );
  const floor = program.minHeightApplies ? ` (at least ${ft(minHeight.feet)}, because this lot is ${why.join(" and ")})` : "";
  const parts = [`the height limit ${heights.join("; ")}${floor}`];
  const waived = [...program.waived.values()];
  if (waived.length) {
    const verb = on ? (waived.length > 1 ? "don't apply" : "doesn't apply") : "wouldn't apply";
    parts.push(`${list(waived.map((w) => titleInSentence(w.title)))} ${verb} (${unique(waived.map((w) => w.citation)).join(", ")})`);
  }
  const replaced = [...program.replaced.values()];
  if (replaced.length) {
    const verb = on ? (replaced.length > 1 ? "follow" : "follows") : "would follow";
    parts.push(`${list(replaced.map((r) => titleInSentence(r.title)))} ${verb} the program's own rule (${unique(replaced.map((r) => r.citation)).join(", ")})`);
  }
  const changes = parts.join("; ");
  const top = Math.max(...covered.map((c) => c.height));
  const bases = covered.map((c) => c.zone.baseHeightFt).filter((h): h is number => h !== null);
  const numbers = {
    programHeightFt: top,
    ...(bases.length ? { baseHeightFt: Math.max(...bases) } : {}),
    ...(program.minHeightApplies ? { minHeightFt: minHeight.feet } : {}),
  };
  return {
    status: "info",
    sentence: on
      ? `${rule.title}: on. Under it, ${changes}. This assumes ${assumes}. Not drawn: ${notDrawn}.`
      : `${rule.title}: off. Under it, ${changes}. Turn it on to see that envelope.`,
    numbers,
    cut: none,
  };
}

function resolveBulk(rule: Extract<Rule, { kind: "bulk" }>, ctx: ResolveContext): Resolved {
  const { letters, noLimit, podiumOnly } = rule.params;
  type Outcome = { cut: BulkZoneCut | null; text: string; status: "cut" | "not_applicable" | "not_modeled" };
  const outcomes = ctx.zones.map((zone): Outcome => {
    const letter = zone.bulk;
    const limit = letter === null ? undefined : letters[letter];
    const height = zone.heightFt;
    if (height === null) return { cut: null, text: `${zone.label} can't be read, so its bulk limits aren't modeled`, status: "not_modeled" };
    if (letter === null) return { cut: null, text: `${zone.label}: no bulk district is given, so bulk limits aren't modeled`, status: "not_modeled" };
    if (limit) {
      if (height <= limit.aboveFeet) {
        return { cut: null, text: `${zone.label}: its limits start above ${ft(limit.aboveFeet)}, but the height limit here is ${ft(height)}`, status: "not_applicable" };
      }
      return {
        cut: { label: zone.label, aboveFt: limit.aboveFeet, lengthFt: limit.lengthFeet, diagonalFt: limit.diagonalFeet },
        text: `${zone.label}: above ${ft(limit.aboveFeet)}, no floor may be longer than ${ft(limit.lengthFeet)} or measure more than ${ft(limit.diagonalFeet)} corner to corner`,
        status: "cut",
      };
    }
    if (noLimit.includes(letter)) return { cut: null, text: `${zone.label}: bulk district ${letter} has no length or diagonal limits`, status: "not_applicable" };
    const podium = podiumOnly[letter];
    if (podium !== undefined) {
      return height <= podium
        ? { cut: null, text: `${zone.label}: ${letter} bulk limits start above the ${ft(podium)} podium, and the height limit here is ${ft(height)}`, status: "not_applicable" }
        : { cut: null, text: `${zone.label}: ${letter} bulk limits above the ${ft(podium)} podium (setbacks, floor plates, tower spacing) aren't modeled`, status: "not_modeled" };
    }
    return { cut: null, text: `${zone.label}: bulk district ${letter} has rules this app doesn't model`, status: "not_modeled" };
  });
  const status = outcomes.some((o) => o.status === "cut") ? "cut" : outcomes.some((o) => o.status === "not_modeled") ? "not_modeled" : "not_applicable";
  const first = outcomes.find((o) => o.cut)?.cut;
  return {
    status,
    sentence: `${rule.title}: ${outcomes.map((o) => o.text).join("; ")}.`,
    numbers: first ? { aboveFt: first.aboveFt, lengthFt: first.lengthFt, diagonalFt: first.diagonalFt } : {},
    cut: status === "cut" ? { type: "bulk", zones: outcomes.map((o) => o.cut) } : { type: "none" },
  };
}

/** What the geometry stage found, for the card: one sentence and its numbers. */
export function describeBulkPlan(cut: Extract<Cut, { type: "bulk" }>): { sentence: string; numbers: Record<string, number> } {
  const parts: string[] = [];
  const numbers: Record<string, number> = {};
  for (const zone of cut.zones) {
    const plan = zone?.plan;
    if (!zone || !plan) continue;
    const above = `${cut.zones.filter(Boolean).length > 1 ? `In ${zone.label}, above` : "Above"} ${ft(zone.aboveFt)}`;
    if (!plan.measured) {
      parts.push(`${above} nothing is left.`);
      continue;
    }
    const { widthFt, depthFt, diagonalFt } = plan.measured;
    const size = `${above} the envelope is ${ft(widthFt)} wide and ${ft(depthFt)} deep (${ft(diagonalFt)} corner to corner)`;
    if (!plan.box) {
      parts.push(`${size}, within both limits.`);
    } else {
      const boxWidth = plan.box.s1 - plan.box.s0;
      const boxDepth = plan.box.d1 - plan.box.d0;
      parts.push(
        `${size}, so the upper floors are drawn as a ${ft(boxWidth)} × ${ft(boxDepth)} box at the front; ` +
          "they could sit anywhere on the lot within those dimensions.",
      );
      Object.assign(numbers, { boxWidthFt: boxWidth, boxDepthFt: boxDepth });
    }
    Object.assign(numbers, { measuredWidthFt: widthFt, measuredDepthFt: depthFt, measuredDiagonalFt: diagonalFt });
  }
  return { sentence: parts.join(" "), numbers };
}

function resolveSideYard(rule: Extract<Rule, { kind: "side_yard" }>, ctx: ResolveContext): Resolved {
  const rows = rule.params.byLotWidth;
  let index = 0;
  while (index + 1 < rows.length && rows[index + 1]!.minWidthFeet <= ctx.widthFt) index++;
  const row = rows[index]!;
  const next = rows[index + 1];
  const range =
    row.minWidthFeet === 0
      ? next
        ? `under ${ft(next.minWidthFeet)}`
        : "any width"
      : next
        ? `${ft(row.minWidthFeet)} to under ${ft(next.minWidthFeet)}`
        : `${ft(row.minWidthFeet)} or more`;
  const lot = `this lot is ${ft(ctx.widthFt)} wide (${range})`;

  if ("layout" in row) {
    const yardFt = Math.max(ctx.widthFt - row.totalLotWidthMinusFeet, 0);
    return {
      status: "cut",
      sentence:
        `${rule.title}: ${lot}, so one yard of ${ft(ctx.widthFt)} − ${ft(row.totalLotWidthMinusFeet)} = ${ft(yardFt)}. ` +
        "It's drawn on the left; the owner may put it on either side or split it in two.",
      numbers: { lotWidthFt: ctx.widthFt, leftFt: yardFt, rightFt: 0 },
      cut: { type: "side_strips", leftFt: yardFt, rightFt: 0 },
    };
  }
  if (row.eachSideFeet === 0) {
    return {
      status: "info",
      sentence: `${rule.title}: none required, because ${lot}.`,
      numbers: { lotWidthFt: ctx.widthFt, leftFt: 0, rightFt: 0 },
      cut: { type: "none" },
    };
  }
  return {
    status: "cut",
    sentence: `${rule.title}: ${lot}, so ${ft(row.eachSideFeet)} on each side.`,
    numbers: { lotWidthFt: ctx.widthFt, leftFt: row.eachSideFeet, rightFt: row.eachSideFeet },
    cut: { type: "side_strips", leftFt: row.eachSideFeet, rightFt: row.eachSideFeet },
  };
}

function resolveMappedHeight(rule: Rule, ctx: ResolveContext): Resolved {
  const zones = ctx.zones;
  if (zones.length === 0 || zones.every((z) => z.heightFt === null)) {
    const labels = zones.map((z) => z.label).join(", ") || "none found";
    return {
      status: "not_modeled",
      sentence: `${rule.title}: the mapped height district (${labels}) can't be read here, so it isn't modeled. Check the limit with SF Planning.`,
      numbers: {},
      cut: { type: "none" },
    };
  }

  const program = ctx.program?.title ?? "the local program";
  const describe = (z: ZoneContext) => {
    if (z.heightFt === null) return `${z.label} isn't modeled, so that part isn't cut`;
    if (z.inProgram) {
      const without = z.baseHeightFt === z.heightFt ? "the same without it" : `${z.baseHeightFt === null ? "unreadable" : ft(z.baseHeightFt)} without it`;
      return `${ft(z.heightFt)} under ${program} (${z.label}; ${without})`;
    }
    const local =
      z.localProgramHeightFt !== null && z.localProgramHeightFt > z.heightFt
        ? `; up to ${ft(z.localProgramHeightFt)} under ${program}, which isn't switched on`
        : "";
    return `${ft(z.heightFt)} (${z.label}${local})`;
  };

  const numbers: Record<string, number> = {};
  zones.forEach((z, i) => {
    if (z.heightFt !== null) numbers[`zone${i}HeightFt`] = z.heightFt;
  });

  if (zones.length === 1) {
    const zone = zones[0]!;
    return {
      status: "cut",
      sentence: `${rule.title}: ${describe(zone)}.`,
      numbers: {
        heightFt: zone.heightFt!,
        ...(zone.localProgramHeightFt ? { localProgramHeightFt: zone.localProgramHeightFt } : {}),
        ...(zone.inProgram && zone.baseHeightFt !== null ? { baseHeightFt: zone.baseHeightFt } : {}),
      },
      cut: { type: "uniform_height", heightFt: zone.heightFt! },
    };
  }

  const parts = zones.map((z) => `${describe(z)} on ${pct(z.share)} of the lot`);
  return {
    status: "cut",
    sentence: `${rule.title}: the lot spans ${zones.length} height districts: ${parts.join("; ")}.`,
    numbers,
    cut: { type: "zone_heights", heights: zones.map((z) => z.heightFt) },
  };
}

export function ft(value: number): string {
  return `${(Number(value.toFixed(1)) || 0).toLocaleString("en-US")} ft`; // "|| 0" turns -0 into 0
}

function sqft(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} sq ft`;
}

function list(items: string[]): string {
  return items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A card title inside a sentence: "the front height plane", "the RH-2 dwelling cap". */
function titleInSentence(title: string): string {
  return `the ${/^[A-Z][a-z]/.test(title) ? title.charAt(0).toLowerCase() + title.slice(1) : title}`;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
