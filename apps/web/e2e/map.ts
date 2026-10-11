import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

// The map's two outside sources, served locally so the tests run offline:
// the basemap style becomes a plain background, and the parcel tiles come from
// a small committed tileset around the demo lots (`pnpm build-tiles --fixture`).
const FIXTURES = join(import.meta.dirname, "fixtures");

export async function serveMap(page: Page, options: { tiles?: "fixture" | "missing" } = {}) {
  const style = await readFile(join(FIXTURES, "basemap-style.json"), "utf8");
  await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (route) =>
    route.request().url().includes("/styles/")
      ? route.fulfill({ body: style, contentType: "application/json", headers: { "access-control-allow-origin": "*" } })
      : route.abort(),
  );
  const tiles = options.tiles === "missing" ? null : await readFile(join(FIXTURES, "tiles", "sf.pmtiles"));
  await page.route(/\/tiles\/sf\.pmtiles$/, (route) => {
    if (!tiles) return route.fulfill({ status: 404, body: "not found" });
    // PMTiles reads the archive with HTTP range requests and insists on 206 answers.
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()["range"] ?? "");
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), tiles.length - 1) : tiles.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      body: tiles.subarray(start, end + 1),
      headers: {
        "content-type": "application/octet-stream",
        "accept-ranges": "bytes",
        ...(range ? { "content-range": `bytes ${start}-${end}/${tiles.length}` } : {}),
      },
    });
  });
}

/** Waits until the map has drawn its tiles once. */
export async function mapReady(page: Page) {
  await page.locator("[data-testid=map][data-ready=true]").waitFor({ timeout: 30_000 });
}

/** The middle of the map, where `?at=` puts a lot. */
export async function mapCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.getByTestId("map").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
