import type { FrontCandidate } from "@zoningviz/engine";

export function num(value: number, digits = 0): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function facing(side: FrontCandidate): string {
  const [x, y] = side.outward;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return names[Math.round(bearing / 45) % 8]!;
}
