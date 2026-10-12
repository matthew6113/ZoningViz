import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { cacheKey } from "../../../packages/jurisdictions/sf/node/cache";

// Serves the app's DataSF and USGS elevation requests from recorded responses
// (the same files `pnpm parcel` caches), so the browser tests run offline.
// With LIVE=1, misses are fetched from Node and recorded.
const DIR = join(import.meta.dirname, "fixtures", "datasf");
const LIVE = process.env.LIVE === "1";

export async function replayDataSf(page: Page): Promise<string[]> {
  const missing: string[] = [];
  await page.route(/^https:\/\/(data\.sf\.gov|elevation\.nationalmap\.gov)\//, async (route) => {
    const url = route.request().url();
    const request = route.request().method() === "POST" ? (route.request().postData() ?? "") : undefined;
    const file = join(DIR, `${cacheKey(url, request)}.json`);
    let body: unknown;
    try {
      body = (JSON.parse(await readFile(file, "utf8")) as { body: unknown }).body;
    } catch {
      if (!LIVE) {
        missing.push(url);
        return route.fulfill({ status: 599, body: `Not recorded: ${url} (run LIVE=1 pnpm e2e to record)` });
      }
      const response = await fetch(
        url,
        request === undefined
          ? { headers: { Accept: "application/json" } }
          : { method: "POST", body: request, headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" } },
      );
      if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
        // Pass a failure through unrecorded (the app treats a failed elevation request as a flat lot).
        return route.fulfill({ status: response.ok ? 502 : response.status, body: await response.text() });
      }
      body = await response.json();
      await mkdir(DIR, { recursive: true });
      await writeFile(file, JSON.stringify({ url, ...(request === undefined ? {} : { request }), fetchedAt: new Date().toISOString(), body }));
    }
    return route.fulfill({ json: body, headers: { "access-control-allow-origin": "*" } });
  });
  return missing;
}
