import type { EnvelopeTotals, FrontCandidate } from "@zoningviz/engine";

export function num(value: number, digits = 0): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function facing(side: FrontCandidate): string {
  const [x, y] = side.outward;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return names[Math.round(bearing / 45) % 8]!;
}

/** What the program adds over the envelope without it, in floor area and stories. */
export function gain(withProgram: EnvelopeTotals, without: EnvelopeTotals): string {
  const area = withProgram.grossFloorAreaSqFt - without.grossFloorAreaSqFt;
  const stories = withProgram.stories - without.stories;
  if (Math.abs(area) < 0.5 && stories === 0) return "the program adds nothing here";
  const signed = (n: number, text: string) => `${n >= 0 ? "+" : "−"}${text}`;
  const parts = [signed(area, `${num(Math.abs(area))} sq ft`)];
  if (stories !== 0) parts.push(signed(stories, `${Math.abs(stories)} ${Math.abs(stories) === 1 ? "story" : "stories"}`));
  return `${parts.join(", ")} with the program`;
}
