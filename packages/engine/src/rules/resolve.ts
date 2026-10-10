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
  | { type: "plane"; fromDepthFt: number; startHeightFt: number; angleDeg: number };

export interface Resolved {
  status: "cut" | "info" | "not_modeled";
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
        ? `${rule.title}: ${ft(setbackFt)}, your setting. The rule follows the neighbors' setbacks, up to ${ft(maxFeet)}.`
        : `${rule.title}: up to ${ft(maxFeet)}, set by the neighbors' setbacks, which city data doesn't include. Showing the ${ft(maxFeet)} maximum.`;
      return {
        status: "cut",
        sentence,
        numbers: { setbackFt, maxFeet },
        cut: { type: "min_depth", depthFt: setbackFt },
      };
    }

    case "sky_plane": {
      const { fromLine, startHeightFeet, angleDeg } = rule.params;
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
  return `${Number(value.toFixed(1)).toLocaleString("en-US")} ft`;
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
