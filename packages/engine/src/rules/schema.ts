import { z } from "zod";

// District rule files: one JSON file per zoning district, rules in animation
// order. Every value a rule carries must come from the cited code section;
// nothing here supplies zoning numbers of its own.

const ruleId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase-kebab-case ids");

const common = {
  id: ruleId,
  title: z.string().min(1),
  /** One sentence a layperson understands. */
  plain: z.string().min(1),
  citation: z.string().min(1),
  url: z.url(),
  /** True only after a person has checked the value against the official code text. */
  verified: z.boolean(),
  /** ISO date the cited text took effect. May be null only while the rule is unverified. */
  effectiveDate: z.iso.date().nullable(),
};

const noParams = z.object({}).strict();

export const HeightCapParams = z.union([
  z.object({ source: z.literal("heightDistrict") }).strict(),
  z.object({ feet: z.number().positive() }).strict(),
]);

export const RearYardParams = z
  .object({
    pctOfLotDepth: z.number().gt(0).lt(1),
    minFeet: z.number().min(0),
    /**
     * "grade_and_every_story": the yard stays open from the ground up.
     * "above_first_story": the first story (its height set by an earlier ground_story rule) may fill the yard.
     */
    appliesAt: z.enum(["grade_and_every_story", "above_first_story"]),
  })
  .strict();

export const FrontSetbackParams = z
  .object({
    /** As deep as the adjacent building with the shallowest setback (neighbors' setbacks aren't in city data). */
    method: z.literal("shallowest_adjacent"),
    maxFeet: z.number().min(0),
    userOverride: z.boolean(),
  })
  .strict();

export const SkyPlaneParams = z
  .object({
    fromLine: z.enum(["front_setback", "front_lot_line"]),
    startHeightFeet: z.number().min(0),
    angleDeg: z.number().gt(0).lt(90),
    /** The plane doesn't apply when the rear lot line's average ground is this much higher than the front's. */
    skipWhenRearHigherByFeet: z.number().gt(0).optional(),
  })
  .strict();

/** Where heights are measured from (curb, or ground on upsloping lots). Sets the reference for every height rule after it. */
export const HeightReferenceParams = z
  .object({
    /** On a lot level with or sloping down from the street, the curb is the reference this deep. */
    downslopeCurbDepthFeet: z.number().gt(0),
    /** On a lot sloping up from the street, the curb is the reference only this close to the street. */
    upslopeCurbWithinFeet: z.number().min(0),
  })
  .strict();

/** A height cap that depends on how much higher or lower the rear lot line is than the front. */
export const HeightBySlopeParams = z
  .object({
    baseFeet: z.number().positive(),
    steps: z.array(
      z
        .object({
          rear: z.enum(["higher", "lower"]),
          byAtLeastFeet: z.number().gt(0),
          feet: z.number().positive(),
        })
        .strict(),
    ),
  })
  .strict();

/** Sets the first story's height, used by rear yards that start above it and by floor slicing. */
export const GroundStoryParams = z
  .object({
    minFloorToFloorFeet: z.number().positive(),
    /** A different minimum in some height districts (by the mapped height, in feet). */
    exceptions: z
      .array(
        z
          .object({
            heightDistrictFeet: z.array(z.number().positive()).min(1),
            minFloorToFloorFeet: z.number().positive(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

/**
 * A share of the lot that levels with homes may cover (SF: C districts, §134(d)(6)).
 * Levels whose homes all lie within `streetExemptionFeet` of a lot line on a
 * street may cover the whole lot.
 */
export const LotCoverageParams = z
  .object({
    maxCoverage: z.number().gt(0).lt(1),
    /** As for rear yards: "above_first_story" lets the first story (set by an earlier ground_story rule) cover the whole lot. */
    appliesAt: z.enum(["grade_and_every_story", "above_first_story"]),
    streetExemptionFeet: z.number().min(0),
  })
  .strict();

/** A floor-area budget for some uses, shown against the envelope's floor area; it doesn't cut the volume. */
export const FarParams = z
  .object({
    ratio: z.number().positive(),
    /**
     * Which floor area the ratio limits. Residential floor area is exempt in SF's R, RC, NC and mixed-use
     * districts (§124(b)), so there it limits non-residential uses only; in C districts it limits all of it.
     */
    appliesTo: z.enum(["non_residential", "all_uses"]),
  })
  .strict();

/** One row of a bulk table: above `aboveFeet`, every floor stays within these plan dimensions. */
export const BulkLimit = z
  .object({ aboveFeet: z.number().min(0), lengthFeet: z.number().positive(), diagonalFeet: z.number().positive() })
  .strict()
  .refine((limit) => limit.lengthFeet <= limit.diagonalFeet, { message: "a length can't be longer than its diagonal" });

/** Bulk limits by the bulk district's letter (the letter is mapped per height zone, e.g. "A" in "65-A"). */
export const BulkParams = z
  .object({
    letters: z.record(z.string().min(1), BulkLimit),
    /** Letters with no length or diagonal limit. */
    noLimit: z.array(z.string().min(1)),
    /** Letters whose limits start above a podium height and aren't modeled above it. */
    podiumOnly: z.record(z.string().min(1), z.number().positive()),
  })
  .strict();

/** One row of a side-yard table: applies to lots at least `minWidthFeet` wide, up to the next row. */
export const SideYardBracket = z.union([
  z.object({ minWidthFeet: z.number().min(0), eachSideFeet: z.number().min(0) }).strict(),
  z
    .object({
      minWidthFeet: z.number().min(0),
      /** One yard, as wide as the lot width minus this. */
      totalLotWidthMinusFeet: z.number().min(0),
      layout: z.literal("one_side"),
    })
    .strict(),
]);

export const SideYardParams = z
  .object({ byLotWidth: z.array(SideYardBracket).min(1) })
  .strict()
  .superRefine((params, ctx) => {
    const rows = params.byLotWidth;
    if (rows[0]!.minWidthFeet !== 0) {
      ctx.addIssue({ code: "custom", path: ["byLotWidth", 0, "minWidthFeet"], message: "the first row must start at 0 ft" });
    }
    rows.forEach((row, i) => {
      if (i > 0 && row.minWidthFeet <= rows[i - 1]!.minWidthFeet) {
        ctx.addIssue({ code: "custom", path: ["byLotWidth", i, "minWidthFeet"], message: "rows must go from narrow to wide" });
      }
    });
  });

/**
 * A local program a project may opt into (SF: Housing Choice-SF on R-4 lots).
 * It applies where a height zone carries a local-program height; when it is
 * switched on, those zones take that height and the listed rules change.
 */
export const LocalProgramParams = z
  .object({
    /** A height floor for some lots: at least `feet` on corner lots (when `onCornerLot`) and lots larger than `lotAreaOverSqFt`. */
    minHeight: z
      .object({ feet: z.number().positive(), onCornerLot: z.boolean(), lotAreaOverSqFt: z.number().positive() })
      .strict(),
    /** Later rules that don't apply under the program. */
    waives: z.array(z.object({ ruleId, because: z.string().min(1), citation: z.string().min(1) }).strict()),
    /** Later rules (cutting or floor-area rules) that keep their kind but take the program's params. */
    replaces: z.array(z.object({ ruleId, params: z.record(z.string(), z.unknown()), citation: z.string().min(1) }).strict()),
    /** What the drawn envelope assumes about the project (eligibility the app can't check). */
    assumes: z.string().min(1),
    /** What the program allows that isn't drawn. */
    notDrawn: z.string().min(1),
  })
  .strict();

/** Params schemas of the kinds that cut volume: the ones a local program may waive or replace. */
const CUTTING_PARAMS = {
  height_cap: HeightCapParams,
  rear_yard: RearYardParams,
  front_setback: FrontSetbackParams,
  sky_plane: SkyPlaneParams,
  side_yard: SideYardParams,
  height_by_slope: HeightBySlopeParams,
  bulk: BulkParams,
  lot_coverage: LotCoverageParams,
} as const;
type CuttingKind = keyof typeof CUTTING_PARAMS;
const isCutting = (kind: string): kind is CuttingKind => kind in CUTTING_PARAMS;

/** Params schemas of the kinds a local program may replace: the cutting kinds and the floor-area budget. */
const REPLACEABLE_PARAMS = { ...CUTTING_PARAMS, far: FarParams } as const;
type ReplaceableKind = keyof typeof REPLACEABLE_PARAMS;
const isReplaceable = (kind: string): kind is ReplaceableKind => kind in REPLACEABLE_PARAMS;

export const RuleSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...common, kind: z.literal("info"), params: noParams }).strict(),
    z.object({ ...common, kind: z.literal("flag"), params: noParams }).strict(),
    z.object({ ...common, kind: z.literal("height_cap"), params: HeightCapParams }).strict(),
    z.object({ ...common, kind: z.literal("rear_yard"), params: RearYardParams }).strict(),
    z.object({ ...common, kind: z.literal("front_setback"), params: FrontSetbackParams }).strict(),
    z.object({ ...common, kind: z.literal("sky_plane"), params: SkyPlaneParams }).strict(),
    z.object({ ...common, kind: z.literal("side_yard"), params: SideYardParams }).strict(),
    z.object({ ...common, kind: z.literal("height_reference"), params: HeightReferenceParams }).strict(),
    z.object({ ...common, kind: z.literal("height_by_slope"), params: HeightBySlopeParams }).strict(),
    z.object({ ...common, kind: z.literal("ground_story"), params: GroundStoryParams }).strict(),
    z.object({ ...common, kind: z.literal("far"), params: FarParams }).strict(),
    z.object({ ...common, kind: z.literal("bulk"), params: BulkParams }).strict(),
    z.object({ ...common, kind: z.literal("local_program"), params: LocalProgramParams }).strict(),
    z.object({ ...common, kind: z.literal("lot_coverage"), params: LotCoverageParams }).strict(),
  ])
  .superRefine((rule, ctx) => {
    if (rule.verified && rule.effectiveDate === null) {
      ctx.addIssue({ code: "custom", path: ["effectiveDate"], message: "a verified rule needs its effective date" });
    }
  });

export const DistrictFileSchema = z
  .object({
    jurisdiction: z.string().min(1),
    district: z.string().min(1),
    name: z.string().min(1),
    rules: z.array(RuleSchema).min(1),
  })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    let groundStory = false;
    const needsGroundStory = (params: unknown) =>
      typeof params === "object" && params !== null && "appliesAt" in params && params.appliesAt === "above_first_story";
    file.rules.forEach((rule, index) => {
      if (seen.has(rule.id)) {
        ctx.addIssue({ code: "custom", path: ["rules", index, "id"], message: `duplicate rule id "${rule.id}"` });
      }
      seen.add(rule.id);
      if (rule.kind === "ground_story") groundStory = true;
      if ((rule.kind === "rear_yard" || rule.kind === "lot_coverage") && needsGroundStory(rule.params) && !groundStory) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", index, "params", "appliesAt"],
          message: `a ${rule.kind === "rear_yard" ? "rear yard" : "lot coverage limit"} above the first story needs a ground_story rule before it`,
        });
      }
    });

    const programs = file.rules.flatMap((rule, index) => (rule.kind === "local_program" ? [{ rule, index }] : []));
    if (programs.length > 1) {
      ctx.addIssue({ code: "custom", path: ["rules", programs[1]!.index], message: "a district file can have only one local_program rule" });
    }
    for (const { rule, index } of programs) {
      const later = (ruleId: string, path: (string | number)[], allowed: (kind: string) => boolean, what: string) => {
        const target = file.rules.findIndex((r) => r.id === ruleId);
        const found = target > index ? file.rules[target]! : undefined;
        if (!found || !allowed(found.kind)) {
          ctx.addIssue({ code: "custom", path: ["rules", index, "params", ...path], message: `"${ruleId}" must name a later rule that ${what}` });
          return undefined;
        }
        return { target: found, targetIndex: target };
      };
      rule.params.waives.forEach((waiver, i) => later(waiver.ruleId, ["waives", i, "ruleId"], isCutting, "cuts volume"));
      rule.params.replaces.forEach((replacement, i) => {
        const found = later(replacement.ruleId, ["replaces", i, "ruleId"], isReplaceable, "cuts volume or sets a floor-area ratio");
        if (!found) return;
        const parsed = REPLACEABLE_PARAMS[found.target.kind as ReplaceableKind].safeParse(replacement.params);
        if (!parsed.success) {
          ctx.addIssue({
            code: "custom",
            path: ["rules", index, "params", "replaces", i, "params"],
            message: `these params don't fit a ${found.target.kind} rule: ${z.prettifyError(parsed.error)}`,
          });
        } else if (
          (found.target.kind === "rear_yard" || found.target.kind === "lot_coverage") &&
          needsGroundStory(parsed.data) &&
          !file.rules.slice(0, found.targetIndex).some((r) => r.kind === "ground_story")
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["rules", index, "params", "replaces", i, "params", "appliesAt"],
            message: `a ${found.target.kind === "rear_yard" ? "rear yard" : "lot coverage limit"} above the first story needs a ground_story rule before it`,
          });
        }
      });
    }
  });

export type Rule = z.infer<typeof RuleSchema>;
export type RuleKind = Rule["kind"];
export type DistrictFile = z.infer<typeof DistrictFileSchema>;

/** The rule with a local program's replacement params (already checked by the schema) and both citations. */
export function withReplacedParams(rule: Rule, params: unknown, citation: string): Rule {
  if (!isReplaceable(rule.kind)) throw new Error(`a ${rule.kind} rule can't take replacement params`);
  return { ...rule, params: REPLACEABLE_PARAMS[rule.kind].parse(params), citation: `${rule.citation}; ${citation}` } as Rule;
}

/** Validates a district file, throwing a readable error that names the bad fields. */
export function parseDistrictFile(data: unknown, source = "district file"): DistrictFile {
  const result = DistrictFileSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid ${source}:\n${z.prettifyError(result.error)}`);
  return result.data;
}
