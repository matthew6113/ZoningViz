import { expect, test, type Page } from "@playwright/test";
import { replayDataSf } from "./datasf";
import { mapCenter, mapReady, serveMap } from "./map";

const SHOTS = "e2e/screenshots";
const HAMPSHIRE = "/?at=-122.40779,37.76102,18.5"; // 667 Hampshire St (4025007, RH-2) in the middle
const POTRERO = "/?at=-122.407501,37.761155,19"; // 650 Potrero Ave (4025003A, PDR-1-G): not covered

let problems: string[] = [];
let missing: string[] = [];
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  missing = await replayDataSf(page);
});
test.afterEach(() => {
  expect(missing, "DataSF requests without a recording").toEqual([]);
  expect(problems).toEqual([]);
});

const factTitle = (page: Page) => page.locator(".fact-card h2");
const tooltip = (page: Page) => page.getByTestId("map-tooltip");

test("hovering shows the lot; clicking flies in and opens it; ← Map returns to the same spot", async ({ page }) => {
  await serveMap(page);
  await page.goto(HAMPSHIRE);
  await mapReady(page);
  const center = await mapCenter(page);

  await page.mouse.move(center.x, center.y);
  await expect(tooltip(page)).toBeVisible();
  await expect(tooltip(page)).toContainText("667 Hampshire St");
  await expect(tooltip(page)).toContainText("Block/lot 4025007 · RH-2 · Residential, House, Two Family");
  await expect(tooltip(page)).toContainText("Click to see its envelope");
  await page.screenshot({ path: `${SHOTS}/map-hover.png` });

  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/map-flight.png` });
  await expect(page).toHaveURL(/parcel=4025007/);
  await expect(factTitle(page)).toHaveText("667 Hampshire St");
  await expect(page.getByTestId("step-label")).toHaveText("Start: everything up to 80 ft");
  await page.screenshot({ path: `${SHOTS}/map-opened.png` });
  const at = new URL(page.url()).searchParams.get("at");
  expect(at).toMatch(/^-122\.\d+,37\.\d+,\d+\.\d+$/);

  await page.getByRole("link", { name: "← Map" }).click();
  await expect(page).not.toHaveURL(/parcel=/);
  expect(new URL(page.url()).searchParams.get("at")).toBe(at);
  await expect(page.getByTestId("map")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Address or block/lot" })).toBeVisible();

  // The browser's Back and Forward move between the map and the lot too.
  await page.goBack();
  await expect(factTitle(page)).toHaveText("667 Hampshire St");
  await page.goBack();
  await expect(page).not.toHaveURL(/parcel=/);
});

test("search finds a lot by address and by block/lot", async ({ page }) => {
  await serveMap(page);
  await page.goto("/");
  await mapReady(page);
  const search = page.getByRole("combobox", { name: "Address or block/lot" });

  await search.fill("667 hamp");
  await page.getByRole("option", { name: /667 Hampshire St/ }).click();
  await expect(page).toHaveURL(/parcel=4025007/);
  await expect(factTitle(page)).toHaveText("667 Hampshire St");

  await page.getByRole("link", { name: "← Map" }).click();
  await search.fill("4025/006");
  await expect(page.getByRole("option", { name: "Block/lot 4025006" })).toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/parcel=4025006/);
  await expect(page.getByText("Which side is the front?")).toBeVisible();

  await page.getByRole("link", { name: "← Map" }).click();
  await search.fill("Hampshire");
  await expect(page.getByRole("listbox")).toContainText("Start with the house number");
});

test("the zoning colors can be switched off and on", async ({ page }) => {
  await serveMap(page);
  await page.goto(HAMPSHIRE);
  await mapReady(page);
  const toggle = page.getByRole("button", { name: "Zoning colors" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("legend")).toContainText("RH-1(D)");
  const tinted = await page.getByTestId("map").screenshot();
  await page.screenshot({ path: `${SHOTS}/map-tint.png` });

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("legend")).toHaveCount(0);
  await expect.poll(async () => (await page.getByTestId("map").screenshot()).equals(tinted)).toBe(false);

  await toggle.click();
  await expect(page.getByTestId("legend")).toBeVisible();
});

test("a lot whose zoning isn't covered explains why and stays on the map", async ({ page }) => {
  await serveMap(page);
  await page.goto(POTRERO);
  await mapReady(page);
  const center = await mapCenter(page);
  await page.mouse.move(center.x, center.y);
  await expect(tooltip(page)).toContainText("650 Potrero Ave");
  await expect(tooltip(page)).toContainText("Zoned PDR-1-G.");

  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("map-popup")).toContainText("Zoned PDR-1-G. Rule files exist for RH-1(D), RH-1, RH-1(S), RH-2, RH-3, RM-1–RM-4, RTO-1, RTO-M, RTO-C, NC-1–NC-3, NC-S, NCT-1–NCT-3, NCD-24TH-NOE-VALLEY, NCD-BAYVIEW, NCD-BROADWAY, NCD-CASTRO, NCD-COLE VALLEY, NCD-CORTLAND AVENUE, NCD-EXCELSIOR, NCD-GEARY BOULEVARD, NCD-HAIGHT, NCD-INNER BALBOA STREET, NCD-INNER CLEMENT, NCD-INNER SUNSET, NCD-INNER TARAVAL STREET, NCD-IRVING, NCD-JAPANTOWN, NCD-JUDAH, NCD-LAKESIDE VILLAGE, NCD-LELAND, NCD-LOWER HAIGHT STREET, NCD-LOWER POLK STREET, NCD-MISSION BERNAL, NCD-NORIEGA, NCD-NORTH BEACH, NCD-OUTER BALBOA STREET, NCD-OUTER CLEMENT, NCD-PACIFIC, NCD-POLK, NCD-SACRAMENTO, NCD-SAN BRUNO AVENUE, NCD-TARAVAL, NCD-UNION, NCD-UPPER FILLMORE, NCD-WEST PORTAL, NCT-24TH-MISSION, NCT-DIVISADERO, NCT-FILLMORE, NCT-FOLSOM, NCT-GLEN PARK, NCT-HAYES, NCT-MISSION, NCT-OCEAN, NCT-SOMA, NCT-UPPER MARKET, NCT-VALENCIA only so far");
  await page.waitForTimeout(300);
  await expect(page).not.toHaveURL(/parcel=/);
});

test("an RH-1(D) lot shows its side yards", async ({ page }) => {
  await serveMap(page);
  await page.goto("/?parcel=2687029&step=7");
  await expect(factTitle(page)).toHaveText("124 Clarendon Ave");
  await expect(page.getByTestId("step-label")).toHaveText("Rule 7 of 12: Side yards");
  const card = page.locator("[aria-current=step]");
  await expect(card.locator(".sentence")).toHaveText("Side yards: this lot is 50.6 ft wide (50 ft or more), so 5 ft on each side.");
  await expect(card.locator(".plain")).toContainText("Not shown: buildings 25 feet tall or less may shift width");
  await expect(card.locator("footer")).toContainText("in effect since 1978-10-06");
  await expect(card.locator(".tag-unverified")).toHaveCount(0);
  await expect(page.locator(".dimension-label").filter({ hasText: "5 ft" })).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS}/clarendon-side-yards.png` });

  // Back to the map, centered on this lot (the link carried no map view).
  await page.getByRole("link", { name: "← Map" }).click();
  await mapReady(page);
  expect(new URL(page.url()).searchParams.get("at")).toMatch(/^-122\.45\d+,37\.75\d+,17\.50$/);
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("opens a lot without the flight", async ({ page }) => {
    await serveMap(page);
    await page.goto(HAMPSHIRE);
    await mapReady(page);
    const center = await mapCenter(page);
    await page.mouse.click(center.x, center.y);
    await expect(page).toHaveURL(/parcel=4025007/);
    await expect(page.locator(".lot-view")).toHaveAttribute("data-motion", "reduced");
  });
});

test("without tiles the map says how to build them, and search still works", async ({ page }) => {
  await serveMap(page, { tiles: "missing" });
  await page.goto("/");
  await expect(page.getByTestId("tiles-missing")).toContainText("pnpm build-tiles");
  await page.getByRole("combobox", { name: "Address or block/lot" }).fill("4025007");
  await page.keyboard.press("Enter");
  await expect(factTitle(page)).toHaveText("667 Hampshire St");
  // The 404 for the tiles file is this test's premise, not a fault.
  problems = problems.filter((p) => !p.includes("status of 404"));
});
