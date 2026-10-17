import file from "./specialUse.json";
import type { SfParcel } from "./types";

// Special use districts are listed, never modeled. A few get a note (specialUse.json)
// saying what they allow and, from the lot's zoning, whether this lot can use them.
// Notes follow the district files' rules: every value comes from the cited text, and a
// note stays `verified: false` until a person checks it (sf/districts/VERIFY.md).

export interface SpecialUseNote {
  /** The district's `name` in DataSF's Special Use Districts layer, matched exactly. */
  name: string;
  title: string;
  plain: string;
  citation: string;
  verified: boolean;
  /** ISO date the cited text took effect; null while unverified. */
  effectiveDate: string | null;
  eligibility: {
    citation: string;
    /** Zoning codes that qualify anywhere in the district. */
    zoning: string[];
    /** Zoning codes that qualify only within `area`, which the app doesn't check. */
    zoningInArea: string[];
    area: string;
    /** Who qualifies, for lots that don't. */
    who: string;
    /** Other special use districts whose lots are excluded (by layer name). */
    excludedWith: { name: string; title: string }[];
  };
}

export interface SpecialUseFact {
  /** The layer's name. */
  name: string;
  title: string;
  /** The layer's link to the code. */
  url: string | null;
  /** The note, when there is one: what the district allows, its citation and verification. */
  note: Pick<SpecialUseNote, "plain" | "citation" | "verified" | "effectiveDate"> | null;
  /** Whether this lot can use the district, when the note says who can. */
  applies: { status: "yes" | "depends" | "no"; sentence: string } | null;
}

export const SPECIAL_USE_NOTES: readonly SpecialUseNote[] = file.notes;

/** The lot's special use districts, noted ones first; null when the layer couldn't be read. */
export function specialUseFacts(parcel: Pick<SfParcel, "zoning" | "specialUseDistricts">): SpecialUseFact[] | null {
  const districts = parcel.specialUseDistricts;
  if (!districts) return null;
  const names = new Set(districts.map((d) => d.name));
  const facts = districts.map((district): SpecialUseFact => {
    const note = SPECIAL_USE_NOTES.find((n) => n.name === district.name);
    if (!note) return { name: district.name, title: district.name, url: district.url, note: null, applies: null };
    const { plain, citation, verified, effectiveDate } = note;
    return {
      name: district.name,
      title: note.title,
      url: district.url,
      note: { plain, citation, verified, effectiveDate },
      applies: eligibility(note, parcel.zoning.codes, names),
    };
  });
  return [...facts.filter((f) => f.note), ...facts.filter((f) => !f.note)];
}

function eligibility(note: SpecialUseNote, codes: string[], districtNames: Set<string>): SpecialUseFact["applies"] {
  const rule = note.eligibility;
  const excluded = rule.excludedWith.find((e) => districtNames.has(e.name));
  if (excluded) {
    return { status: "no", sentence: `This lot is also in the ${excluded.title}, which ${rule.citation} excludes, so it can't use this.` };
  }
  if (codes.length !== 1) {
    const zoning = codes.length ? `split between ${codes.join(" and ")}` : "unknown";
    return { status: "depends", sentence: `Open to ${rule.who}; this lot's zoning is ${zoning}.` };
  }
  const code = codes[0]!;
  if (rule.zoning.includes(code)) return { status: "yes", sentence: `${code} lots here can use it (${rule.citation}).` };
  if (rule.zoningInArea.includes(code)) {
    return { status: "depends", sentence: `${code} lots can use it only in ${rule.area} (${rule.citation}), which isn't checked here.` };
  }
  return { status: "no", sentence: `Open to ${rule.who} (${rule.citation}); this lot is ${code}, so it can't use this.` };
}
