// Node-only: a disk cache for DataSF responses during development and a replay
// source for tests. Never import this from browser code.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchJson } from "../datasf";

interface CacheEntry {
  url: string;
  fetchedAt: string;
  body: unknown;
}

export function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

/** Wraps a fetcher so each URL is fetched once and then served from `dir`. */
export function withDiskCache(fetchJson: FetchJson, dir: string): FetchJson {
  return async (url) => {
    const file = join(dir, `${cacheKey(url)}.json`);
    try {
      const entry = JSON.parse(await readFile(file, "utf8")) as CacheEntry;
      return entry.body;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const body = await fetchJson(url);
    await mkdir(dir, { recursive: true });
    const entry: CacheEntry = { url, fetchedAt: new Date().toISOString(), body };
    await writeFile(file, JSON.stringify(entry));
    return body;
  };
}
