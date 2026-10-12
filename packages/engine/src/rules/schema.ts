import { z } from "zod";

// District rule files: one JSON file per zoning district, rules in animation
// order. Every value a rule carries must come from the cited code section;
// nothing here supplies zoning numbers of its own.

const common = {
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase-kebab-case ids"),
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
    appliesAt: z.literal("grade_and_every_story"),
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
    file.rules.forEach((rule, index) => {
      if (seen.has(rule.id)) {
        ctx.addIssue({ code: "custom", path: ["rules", index, "id"], message: `duplicate rule id "${rule.id}"` });
      }
      seen.add(rule.id);
    });
  });

export type Rule = z.infer<typeof RuleSchema>;
export type RuleKind = Rule["kind"];
export type DistrictFile = z.infer<typeof DistrictFileSchema>;

/** Validates a district file, throwing a readable error that names the bad fields. */
export function parseDistrictFile(data: unknown, source = "district file"): DistrictFile {
  const result = DistrictFileSchema.safeParse(data);
  if (!result.success) throw new Error(`Invalid ${source}:\n${z.prettifyError(result.error)}`);
  return result.data;
}
