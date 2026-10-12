// Node-only: a disk cache for DataSF responses during development and a replay
// source for tests. Never import this from browser code.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchJson, type FetchJson } from "../datasf";

interface CacheEntry {
  url: string;
  /** The POST body, for requests that have one. */
  request?: string;
  fetchedAt: string;
  body: unknown;
}

/** File name for a response: the URL's hash, plus the POST body's when there is one. */
export function cacheKey(url: string, body?: string): string {
  return createHash("sha256")
    .update(body === undefined ? url : `${url}\n${body}`)
    .digest("hex")
    .slice(0, 32);
}

/** Wraps a fetcher so each URL is fetched once and then served from `dir`. */
export function withDiskCache(fetchJson: FetchJson, dir: string): FetchJson {
  return async (url, request) => {
    const file = join(dir, `${cacheKey(url, request)}.json`);
    try {
      const entry = JSON.parse(await readFile(file, "utf8")) as CacheEntry;
      return entry.body;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const body = await fetchJson(url, request);
    await mkdir(dir, { recursive: true });
    const entry: CacheEntry = { url, ...(request === undefined ? {} : { request }), fetchedAt: new Date().toISOString(), body };
    await writeFile(file, JSON.stringify(entry));
    return body;
  };
}

/**
 * The fetcher the CLIs use: cached under .cache/datasf at the repo root
 * (ZONINGVIZ_CACHE_DIR overrides), or uncached with `noCache` / ZONINGVIZ_NO_CACHE=1.
 */
export function devFetchJson(options: { noCache?: boolean } = {}): FetchJson {
  if (options.noCache || process.env.ZONINGVIZ_NO_CACHE === "1") return fetchJson;
  const dir = process.env.ZONINGVIZ_CACHE_DIR ?? join(import.meta.dirname, "..", "..", "..", "..", ".cache", "datasf");
  return withDiskCache(fetchJson, dir);
}
