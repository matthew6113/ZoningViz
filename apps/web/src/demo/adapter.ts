import { createSfAdapter, normalizeAddressQuery, type FetchJson, type SfAdapter, type SfAddressMatch } from "@zoningviz/jurisdictions/sf";
import { EXAMPLES } from "../map/examples";
import { NOT_IN_DEMO } from "./demo";
import { recordingPath, requestKey } from "./key";

/** Answers the adapter's requests from the recordings published with the demo. */
const replayFetchJson: FetchJson = async (url, body) => {
  const response = await fetch(new URL(recordingPath(await requestKey(url, body)), document.baseURI));
  if (!response.ok) throw new Error(NOT_IN_DEMO);
  return response.json();
};

/** Address search over the example lots ("667 hamp", "752 4th"). */
export function searchExamples(text: string, limit = 8): SfAddressMatch[] {
  const query = normalizeAddressQuery(text);
  if (query.length < 3) return [];
  return EXAMPLES.filter((example) => {
    if (!example.at) return false;
    // "766–772 Francisco St" is found from either number.
    const range = /^(\d+)[–-](\d+)(.*)$/.exec(example.label);
    const forms = range ? [`${range[1]}${range[3]}`, `${range[2]}${range[3]}`] : [example.label];
    return forms.some((form) => normalizeAddressQuery(form).startsWith(query));
  })
    .slice(0, limit)
    .map((example) => ({ label: example.label, blklot: example.id, lon: example.at![0], lat: example.at![1] }));
}

export function demoAdapter(): SfAdapter {
  return { ...createSfAdapter({ fetchJson: replayFetchJson }), searchAddresses: async (text, limit) => searchExamples(text, limit) };
}
