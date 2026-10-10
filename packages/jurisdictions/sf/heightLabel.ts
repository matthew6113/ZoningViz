/**
 * Parses a label from the Height and Bulk Districts layer (h9wh-cg3m `height`).
 *
 * Only unambiguous shapes are parsed; everything else is returned as
 * `unparsed` so the app can flag it instead of guessing a height.
 *
 *   "40-X"        -> standard: 40 ft, bulk X
 *   "65-A-1"      -> standard: 65 ft, bulk A-1
 *   "40//85-R-4"  -> Family Zoning Plan R-4: base 40 ft, local program 85 ft
 *
 * Note: for R-4 rows the layer's numeric `gen_hght` column holds the local
 * program height, not the base, so it must never be used as the R-4 cap.
 */
export type ParsedHeightLabel =
  | { kind: "standard"; heightFt: number; bulk: string }
  | { kind: "r4"; baseHeightFt: number; localProgramHeightFt: number }
  | { kind: "unparsed"; reason: string };

const STANDARD = /^(\d+)-([A-Z](?:-\d)?)$/;
const R4 = /^(\d+)\/\/(\d+)-R-?4$/;

export function parseHeightLabel(label: string): ParsedHeightLabel {
  const text = label.trim();

  const standard = STANDARD.exec(text);
  if (standard) return { kind: "standard", heightFt: Number(standard[1]), bulk: standard[2]! };

  const r4 = R4.exec(text);
  if (r4) return { kind: "r4", baseHeightFt: Number(r4[1]), localProgramHeightFt: Number(r4[2]) };

  return { kind: "unparsed", reason: unparsedReason(text) };
}

function unparsedReason(text: string): string {
  if (text.includes("//")) return "compound Family Zoning Plan (R-4) label with more than one height per program";
  if (/^\d+\s*\/\s*\d+/.test(text) || /^\d+-\d+/.test(text)) return "label lists more than one height";
  if (/^\d+/.test(text)) return "unrecognized bulk or special district designation";
  return "label has no numeric height";
}
