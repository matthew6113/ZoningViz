import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { cacheKey } from "../../../packages/jurisdictions/sf/node/cache";

// Serves the app's DataSF requests from recorded responses (the same files
// `pnpm parcel` caches), so the browser tests run offline. With LIVE=1, misses
// are fetched from Node and recorded.
const DIR = join(import.meta.dirname, "fixtures", "datasf");
const LIVE = process.env.LIVE === "1";

export async function replayDataSf(page: Page): Promise<string[]> {
  const missing: string[] = [];
  await page.route(/^https:\/\/data\.sf\.gov\//, async (route) => {
    const url = route.request().url();
    const file = join(DIR, `${cacheKey(url)}.json`);
    let body: unknown;
    try {
      body = (JSON.parse(await readFile(file, "utf8")) as { body: unknown }).body;
    } catch {
      if (!LIVE) {
        missing.push(url);
        return route.fulfill({ status: 599, body: `Not recorded: ${url} (run LIVE=1 pnpm e2e to record)` });
      }
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      body = await response.json();
      await mkdir(DIR, { recursive: true });
      await writeFile(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), body }));
    }
    return route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } });
  });
  return missing;
}
