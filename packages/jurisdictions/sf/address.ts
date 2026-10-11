import type { SfAddress } from "./types";

// Street addresses: display labels for parcel records and the city's address
// list, and normalizing what people type into the search box.

/** The address fields of a parcel record (acdm-wktn). */
export interface ParcelAddressFields {
  from_address_num?: string;
  to_address_num?: string;
  street_name?: string;
  street_type?: string;
}

export function addressOf(row: ParcelAddressFields): SfAddress {
  const from = cleanNumber(row.from_address_num);
  const to = cleanNumber(row.to_address_num);
  // About 1,400 active records carry the literal street name "UNKNOWN".
  const rawStreet = row.street_name?.trim();
  const street = rawStreet && rawStreet.toUpperCase() !== "UNKNOWN" ? rawStreet : null;
  const streetType = row.street_type?.trim() || null;
  let label: string | null = null;
  if (street) {
    const numbers = from && to && from !== to ? `${from}–${to}` : (from ?? to);
    label = [numbers, displayAddress(street), streetType && titleCase(streetType)].filter(Boolean).join(" ");
  }
  return { from, to, street, streetType, label };
}

/** "667 HAMPSHIRE ST" → "667 Hampshire St"; "752 04TH AVE" → "752 4th Ave". */
export function displayAddress(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => (/^\d/.test(word) && /[A-Z]/i.test(word) ? word.replace(/^0+(?=\d)/, "").toLowerCase() : titleCase(word)))
    .join(" ");
}

function cleanNumber(value: string | undefined): string | null {
  const text = value?.trim();
  return text && text !== "0" ? text : null;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// The address list spells street types the USPS way; people type them out.
const STREET_TYPES: Record<string, string> = {
  STREET: "ST",
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  DRIVE: "DR",
  TERRACE: "TER",
  PLACE: "PL",
  COURT: "CT",
  LANE: "LN",
  ROAD: "RD",
  WAY: "WAY",
  ALLEY: "ALY",
  HIGHWAY: "HWY",
  CIRCLE: "CIR",
  PLAZA: "PLZ",
};

/**
 * What someone typed, in the address list's spelling: upper case, single
 * spaces, no punctuation, spelled-out street types shortened, and one-digit
 * numbered streets zero-padded the way the list writes them ("4th Ave" → "04TH AVE").
 */
export function normalizeAddressQuery(text: string): string {
  const words = text
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, i) => {
      if (i === 0) return word;
      if (/^\d(ST|ND|RD|TH)$/.test(word)) return `0${word}`;
      return STREET_TYPES[word] ?? word;
    })
    .join(" ");
}
