import type { Step } from "@zoningviz/engine";
import type { LotFacts } from "../data/loadLot";
import { farBudget, farCapText, lastPosition, positionLabel, type OkResult, type ProgramComparison } from "../state/steps";
import { gain, num } from "../ui/format";

// What a share image says, as plain data: no drawing here, so it can be tested
// in Node. compose.ts lays it out on a canvas.

export type ShareKind = "view" | "storyboard";

export const HONESTY_LINE = "Illustrative. Not a zoning determination. Verify with SF Planning.";

export interface ViewCaption {
  heading: string;
  details: string;
  step: string;
  /** Paragraphs: the rule's sentence, or the result's totals. */
  body: string[];
  /** Volume this step removed (shown with the red removed-volume swatch), or null. */
  removed: { cuFt: number; percentLeft: number } | null;
  citation: string | null;
  unverified: boolean;
  footer: string[];
  /** Reopens this view. */
  link: string;
}

export interface StoryTile {
  position: number;
  title: string;
  detail: string;
  /** Volume removed (cut tiles only): shown with the red swatch. */
  removedCuFt: number | null;
}

export interface StoryboardCaption {
  heading: string;
  details: string;
  tiles: StoryTile[];
  footer: string[];
  /** Reopens this lot at the start. */
  link: string;
}

export interface ShareContext {
  facts: LotFacts;
  result: OkResult;
  /** The page URL; share images print it without the map view. */
  href: string;
  /** Set while a local program (Housing Choice-SF) is switched on. */
  program: ProgramComparison | null;
}

export function viewCaption(ctx: ShareContext, position: number): ViewCaption {
  const { result } = ctx;
  const last = lastPosition(result);
  const step = position >= 1 && position < last ? result.steps[position - 1]! : null;
  let body: string[];
  if (step) body = [step.sentence];
  else if (position <= 0) body = [`The lot extruded to ${result.start.heightFt} ft, twice the mapped height: all the space you might imagine using, before any rule.`];
  else body = resultLines(ctx);
  return {
    heading: ctx.facts.title,
    details: details(ctx),
    step: positionLabel(result, position),
    body,
    removed:
      step && step.status === "cut" ? { cuFt: step.measurements.removedVolume, percentLeft: step.measurements.percentOfStart } : null,
    citation: step ? step.rule.citation : null,
    unverified: step ? !step.rule.verified : false,
    footer: footer(ctx),
    link: shareLink(ctx.href, "view"),
  };
}

export function storyboardCaption(ctx: ShareContext): StoryboardCaption {
  const { result } = ctx;
  const { totals } = result;
  const tiles: StoryTile[] = [
    { position: 0, title: "Start", detail: `The lot, up to ${result.start.heightFt} ft`, removedCuFt: null },
    ...result.steps.flatMap((step, i) =>
      step.status === "cut"
        ? [{ position: i + 1, title: `${i + 1}. ${step.rule.title}`, detail: `${num(step.measurements.removedVolume)} cu ft removed`, removedCuFt: step.measurements.removedVolume }]
        : [],
    ),
    {
      position: lastPosition(result),
      title: "Result",
      detail: `${num(totals.volume)} cu ft · ${storiesText(totals.stories)} · ${num(totals.grossFloorAreaSqFt)} sq ft`,
      removedCuFt: null,
    },
  ];
  const skipped = skippedLine(result.steps);
  return {
    heading: ctx.facts.title,
    details: details(ctx),
    tiles,
    footer: [...(skipped ? [skipped] : []), ...footer(ctx)],
    link: shareLink(ctx.href, "storyboard"),
  };
}

/** The rules that didn't change the shape, grouped by why: "Already satisfied: … · Doesn't apply: …". */
export function skippedLine(steps: Step[]): string | null {
  const groups: [Step["status"], string][] = [
    ["already_satisfied", "Already satisfied"],
    ["not_applicable", "Doesn't apply"],
    ["not_modeled", "Not modeled"],
    ["disabled", "Switched off"],
  ];
  const parts = groups.flatMap(([status, name]) => {
    const titles = steps.filter((s) => s.status === status).map((s) => s.rule.title);
    return titles.length ? [`${name}: ${titles.join(", ")}`] : [];
  });
  return parts.length ? parts.join(" · ") : null;
}

/** The page URL without the map view; the storyboard's link also opens at the start rather than a step. */
export function shareLink(href: string, kind: ShareKind): string {
  const url = new URL(href);
  url.searchParams.delete("at");
  if (kind === "storyboard") url.searchParams.delete("step");
  return url.toString().replace(/%2C/g, ",");
}

/** "zoningviz-667-hampshire-st-rule-6.png", "…-result.png", "…-storyboard.png". */
export function fileName(facts: LotFacts, result: OkResult, kind: ShareKind, position: number): string {
  const slug = facts.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const suffix =
    kind === "storyboard" ? "storyboard" : position <= 0 ? "start" : position >= lastPosition(result) ? "result" : `rule-${position}`;
  return `zoningviz-${slug || "lot"}-${suffix}.png`;
}

/**
 * Greedy word wrap with an injected measurer (so it runs without a canvas).
 * Past `maxLines`, the last line ends in an ellipsis.
 */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number, maxLines = Infinity): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let lastLine = `${kept[maxLines - 1]!}…`;
  while (measure(lastLine) > maxWidth && lastLine.includes(" ")) lastLine = `${lastLine.slice(0, lastLine.lastIndexOf(" "))}…`;
  kept[maxLines - 1] = lastLine;
  return kept;
}

function details(ctx: ShareContext): string {
  const { facts } = ctx;
  const heights = facts.heightDistricts.map((d) => d.label).join(" / ");
  return [
    facts.blklot ? `Block/lot ${facts.blklot}` : null,
    facts.zoningCode,
    heights || null,
    ctx.program ? `${ctx.program.title} on` : null,
  ]
    .filter((part): part is string => !!part)
    .join(" · ");
}

function resultLines({ result, program }: ShareContext): string[] {
  const { totals } = result;
  const lines = [
    `Envelope ${num(totals.volume)} cu ft · footprint ${num(totals.footprintSqFt)} sq ft`,
    `${storiesText(totals.stories)} · ${num(totals.grossFloorAreaSqFt)} sq ft of floor area`,
    `${num(totals.percentSurvived, 1)}% of the block survived`,
  ];
  const far = farBudget(result.steps);
  if (far) {
    const { label, note } = farCapText(far);
    lines.push(`${label} ${num(far.budgetSqFt)} sq ft (${note})`);
  }
  if (program) {
    lines.push(
      `Without ${program.title}: ${num(program.without.grossFloorAreaSqFt)} sq ft in ${storiesText(program.without.stories)} (${gain(totals, program.without)})`,
    );
  }
  return lines;
}

function footer(ctx: ShareContext): string[] {
  const rules = ctx.result.steps.map((s) => s.rule);
  const unverified = rules.filter((r) => !r.verified).length;
  const dated = ctx.facts.asOf.filter((a) => a.date);
  return [
    HONESTY_LINE,
    unverified > 0 ? `${unverified} of ${rules.length} rules are unverified drafts.` : `All ${rules.length} rules are verified.`,
    ...(ctx.facts.specialUse?.length ? [`Special use districts (not modeled): ${ctx.facts.specialUse.map((f) => f.title).join(", ")}.`] : []),
    ...(dated.length ? [`Data as of: ${dated.map((a) => `${a.label} ${a.date}`).join(" · ")}`] : []),
  ];
}

function storiesText(stories: number): string {
  return `${stories} ${stories === 1 ? "story" : "stories"}`;
}
