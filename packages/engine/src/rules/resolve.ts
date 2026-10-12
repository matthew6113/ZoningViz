import type { EnvelopeOptions } from "../types";
import type { DistrictFile, Rule } from "./schema";

// Turns a rule's params into concrete numbers for one lot, the sentence its
// card shows, and the cut the geometry stage should make. No geometry here.

export interface ZoneContext {
  label: string;
  heightFt: number | null;
  localProgramHeightFt: number | null;
  /** Fraction of the lot inside this zone. */
  share: number;
}

export interface ResolveContext {
  widthFt: number;
  depthFt: number;
  zones: ZoneContext[];
  /** The front setback in force, for planes measured from the setback line. Null if the district has none. */
  frontSetbackFt: number | null;
  /** Average ground along the front and rear lot lines (and the curb estimate), or null for a flat lot. */
  ground: { curbFt: number; frontAverageFt: number; rearAverageFt: number } | null;
  /** How heights are measured on this lot (from the height_reference rule and the ground). */
  reference: "flat" | "curb" | "upslope";
}

export type Cut =
  | { type: "none" }
  | { type: "uniform_height"; heightFt: number }
  /** One height per zone (same order as the context); null leaves that zone uncut. */
  | { type: "zone_heights"; heights: (number | null)[] }
  /** Keep only what lies within `depthFt` of the front line (rear yard). */
  | { type: "max_depth"; depthFt: number }
  /** Keep only what lies at least `depthFt` behind the front line (front setback). */
  | { type: "min_depth"; depthFt: number }
  /** Keep what lies under a plane rising at `angleDeg` from `startHeightFt`, `fromDepthFt` behind the front line. */
  | { type: "plane"; fromDepthFt: number; startHeightFt: number; angleDeg: number }
  /** Keep what lies at least `leftFt` from the left side of the lot and `rightFt` from the right (seen from the street). */
  | { type: "side_strips"; leftFt: number; rightFt: number };

export interface Resolved {
  status: "cut" | "info" | "not_applicable" | "not_modeled";
  sentence: string;
  numbers: Record<string, number>;
  cut: Cut;
}

export function resolveFrontSetback(district: DistrictFile, options: EnvelopeOptions): number | null {
  const rule = district.rules.find((r) => r.kind === "front_setback");
  if (!rule) return null;
  return frontSetbackFeet(rule, options);
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
      const { pctOfLotDepth, minFeet } = rule.params;
      const fromPct = pctOfLotDepth * ctx.depthFt;
      const rearYardFt = Math.max(fromPct, minFeet);
      const base = `${rule.title}: ${pct(pctOfLotDepth)} of ${ft(ctx.depthFt)} lot depth = ${ft(fromPct)}`;
      const sentence =
        fromPct >= minFeet
          ? `${base}.`
          : `${base}, below the ${ft(minFeet)} minimum, so ${ft(rearYardFt)}.`;
      return {
        status: "cut",
        sentence,
        numbers: { lotDepthFt: ctx.depthFt, pctOfLotDepth, minFeet, rearYardFt },
        cut: { type: "max_depth", depthFt: Math.max(ctx.depthFt - rearYardFt, 0) },
      };
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
      ? ` Past ${ft(downslopeCurbDepthFeet)} back, the code measures from the lower end of the lot instead; that part isn't modeled.`
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

  const describe = (z: ZoneContext) => {
    if (z.heightFt === null) return `${z.label} isn't modeled, so that part isn't cut`;
    const local =
      z.localProgramHeightFt !== null && z.localProgramHeightFt > z.heightFt
        ? `; up to ${ft(z.localProgramHeightFt)} only through the Housing Choice SF local program, not shown`
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
      numbers: { heightFt: zone.heightFt!, ...(zone.localProgramHeightFt ? { localProgramHeightFt: zone.localProgramHeightFt } : {}) },
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

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
