import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { replayDataSf } from "./datasf";
import { serveMap } from "./map";

const SHOTS = "e2e/screenshots";

// Fail any test whose page logs an error or throws.
let problems: string[] = [];
let missing: string[] = [];
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  missing = await replayDataSf(page);
  await serveMap(page);
});
test.afterEach(() => {
  expect(missing, "DataSF requests without a recording").toEqual([]);
  expect(problems).toEqual([]);
});

const label = (page: Page) => page.getByTestId("step-label");
const currentSentence = (page: Page) => page.locator("[aria-current=step] .sentence");
const next = (page: Page) => page.getByRole("button", { name: "Next →" });
const fast = (page: Page) => page.getByRole("button", { name: "2×" }).click();

/**
 * The WebGL canvas drew a real scene, not a blank clear color (polls until the first frames land).
 * Reading the canvas waits for SwiftShader (software WebGL) to finish every queued frame, which after
 * a heavy scene has been switched and scrubbed can take most of a minute; such tests pass a longer timeout.
 */
async function expectSceneDrawn(page: Page, timeout = 20_000) {
  await expect.poll(() => distinctColors(page), { timeout }).toBeGreaterThan(20);
}

function distinctColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector(".scene canvas") as HTMLCanvasElement | null;
    if (!canvas) return 0;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 64;
    const ctx = probe.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return seen.size;
  });
}

test("fixture A: Next steps through every rule to the result", async ({ page }) => {
  await page.goto("/?parcel=fixture-a");
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expectSceneDrawn(page);
  await fast(page);

  const expected: [string, string | RegExp][] = [
    ["Rule 1 of 11: Homes, up to two units", /^RH-2 lots are for homes: two units per lot/],
    ["Rule 2 of 11: Where height is measured from", /no ground elevations for this lot, so it is treated as flat/],
    ["Rule 3 of 11: Housing Choice-SF", "Housing Choice-SF: doesn't apply, because no part of this lot has a local-program height."],
    ["Rule 4 of 11: Height limit", "Height limit: 40 ft (40-X)."],
    ["Rule 5 of 11: RH-2 dwelling cap", /assumes a flat lot: 40 ft\. Already satisfied/],
    ["Rule 6 of 11: Rear yard", "Rear yard: 30% of 100 ft lot depth = 30 ft."],
    ["Rule 7 of 11: Front setback", /0 ft, your setting.*Already satisfied/],
    ["Rule 8 of 11: Front height plane", /above 30 ft, the building steps back at 45°/],
    ["Rule 9 of 11: Bulk limits", "Bulk limits: 40-X: bulk district X has no length or diagonal limits."],
    ["Rule 10 of 11: Narrow streets", /^Not modeled:/],
    ["Rule 11 of 11: Cross-slope", /^Not modeled:/],
  ];
  for (const [i, [stepLabel, sentence]] of expected.entries()) {
    await next(page).click();
    await expect(label(page)).toHaveText(stepLabel);
    await expect(currentSentence(page)).toHaveText(sentence);
    await expect(page).toHaveURL(new RegExp(`step=${i + 1}`));
    if (i === 2) {
      // No local-program height here, so there's no switch.
      await expect(page.getByRole("switch")).toHaveCount(0);
    }
    if (i === 5) {
      await expect(page.locator(".dimension-label").first()).toHaveText("30 ft");
      await expect(page.locator("[aria-current=step] .removed-line")).toContainText("30,000 cu ft removed");
      await page.screenshot({ path: `${SHOTS}/fixture-a-rear-yard.png` });
    }
  }

  await next(page).click();
  await expect(label(page)).toHaveText("Result");
  await expect(next(page)).toBeDisabled();
  const summary = page.getByTestId("summary");
  await expect(summary).toContainText("68,750 cu ft");
  await expect(summary).toContainText("1,750 sq ft");
  await expect(summary).toContainText("4 stories");
  await expect(summary).toContainText("6,875 sq ft");
  await expect(summary).toContainText("34.4% of the block survived.");
  await expect(page.locator(".rule-card")).toHaveCount(11);
  await expect(page.locator(".tag-unverified")).toHaveCount(6);
  await expect(page.locator(".rule-card").filter({ hasText: "RH-2 dwelling cap" })).toContainText("in effect since 2015-12-04");
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/fixture-a-result.png` });
});

test("Back, arrow keys and deep links move between steps", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=6");
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(label(page)).toHaveText("Rule 5 of 11: RH-2 dwelling cap");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(label(page)).toHaveText("Rule 7 of 11: Front setback");
  await page.goto("/?parcel=fixture-a&step=99");
  await expect(label(page)).toHaveText("Result");
});

test("real lot 667 Hampshire St: every step from DataSF data", async ({ page }) => {
  await page.goto("/?parcel=4025007");
  await fast(page);
  await expect(page.locator(".fact-card h2")).toHaveText("667 Hampshire St");
  await expect(page.locator(".fact-card")).toContainText("25.0 ft wide × 100.0 ft deep");
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expectSceneDrawn(page);

  const sentences: string[] = [];
  for (let i = 1; i <= 11; i++) {
    await next(page).click();
    await expect(label(page)).toContainText(`Rule ${i} of 11`);
    sentences.push((await currentSentence(page).textContent()) ?? "");
    if (i === 7) await page.screenshot({ path: `${SHOTS}/hampshire-front-setback.png` });
  }
  expect(sentences[1]).toMatch(/^Where height is measured from: the lot slopes up from the street/);
  expect(sentences[2]).toBe("Housing Choice-SF: doesn't apply, because no part of this lot has a local-program height.");
  expect(sentences[4]).toMatch(/^RH-2 dwelling cap: the rear lot line averages 5\.\d ft higher than the front .*, so 40 ft\./);
  expect(sentences[5]).toBe("Rear yard: 30% of 100 ft lot depth = 30 ft.");
  expect(sentences[6]).toContain("this shows the 10 ft maximum.");

  await next(page).click();
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("4 stories"); // stepping up the gentle slope
  await expect(page.getByTestId("summary")).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/hampshire-result.png` });
});

test("the setback slider recomputes the envelope", async ({ page }) => {
  await page.goto("/?parcel=4025007&step=7");
  await expect(currentSentence(page)).toContainText("this shows the 10 ft maximum.");
  await page.locator(".setback-slider input").fill("4");
  await expect(page).toHaveURL(/setback=4/);
  await expect(currentSentence(page)).toHaveText("Front setback: 4 ft, your setting. The rule matches the shallower neighbor's setback, up to 10 ft.");
  // 4 ft x 25 ft x 40 ft, less where the ground rises into the strip (replayed USGS terrain).
  await expect(page.locator("[aria-current=step] .removed-line")).toContainText("3,982 cu ft removed");
});

test("corner lot 2550 19th St asks which side is the front", async ({ page }) => {
  await page.goto("/?parcel=4025006");
  const prompt = page.getByRole("region", { name: "Choose the front" });
  await expect(prompt).toContainText("Which side is the front?");
  await expect(page.locator(".side-label")).toHaveCount(2);
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/corner-prompt.png` });

  await prompt.getByRole("button", { name: /Side B/ }).click();
  await expect(page).toHaveURL(/front=1/);
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expect(page.locator(".fact-card")).toContainText("40.0 ft wide × 64.8 ft deep");
});

test("a lot outside the covered districts says so", async ({ page }) => {
  // 2139 Polk St: a named neighborhood commercial district, each of which has its own control table.
  await page.goto("/?parcel=0571003");
  await expect(page.locator(".notice")).toContainText("Zoned NCD. Rule files exist for RH-1(D), RH-1, RH-1(S), RH-2, RH-3, RM-1–RM-4, NC-1–NC-3, NC-S only so far");
  await expect(page.locator(".fact-card")).toContainText("NCD");
});

test("a fresh visit plays the arrival, then waits at the starting block", async ({ page }) => {
  await page.goto("/?parcel=fixture-a");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 10_000 });
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expect(page).toHaveURL(/step=0/);
  await expect(page.getByTestId("hud-volume")).toHaveText("200,000 cu ft");
});

test("Play runs the whole sequence to the result", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=0");
  await fast(page);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(label(page)).toHaveText("Result", { timeout: 30_000 });
  await expect(page).toHaveURL(/step=12/);
  await expect(page.getByTestId("summary")).toContainText("68,750 cu ft");
  await expect(page.getByTestId("hud-volume")).toHaveText("68,750 cu ft");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/fixture-a-played.png` });
});

test("the scrubber jumps to a rule's tick and drags both ways", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=0");
  await page.getByRole("button", { name: "Go to rule 6: Rear yard" }).click();
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expect(page).toHaveURL(/step=6/);
  const scrubber = page.getByRole("slider", { name: "Timeline" });
  await scrubber.fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("hud-volume")).toHaveText("68,750 cu ft");
  await scrubber.fill("0");
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expect(page.getByTestId("hud-volume")).toHaveText("200,000 cu ft");
  await scrubber.fill("520");
  await expect(label(page)).toHaveText(/^Rule \d+ of 11/);
  await page.screenshot({ path: `${SHOTS}/fixture-a-scrubbed.png` });
});

test("switching a rule off recomputes the envelope and keeps the step", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=6");
  await page.getByRole("button", { name: "Turn off Rear yard" }).click();
  await expect(page).toHaveURL(/off=rear-yard/);
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expect(page.locator("[aria-current=step] .chip")).toHaveText("Off");
  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  // 40 ft over the whole 2,500 sq ft lot, less the 1,250 cu ft front plane.
  await expect(page.getByTestId("summary")).toContainText("98,750 cu ft");
  await page.getByRole("button", { name: "Turn on Rear yard" }).click();
  await expect(page).not.toHaveURL(/off=/);
  await expect(page.getByTestId("summary")).toContainText("68,750 cu ft");
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("crossfades instead of flying, sweeping and lifting, and still plays through", async ({ page }) => {
    await page.goto("/?parcel=fixture-a&step=0");
    await expect(page.locator(".lot-view")).toHaveAttribute("data-motion", "reduced");
    await fast(page);
    await page.getByRole("button", { name: "Play" }).click();
    await expect(label(page)).toHaveText("Result", { timeout: 20_000 });
    await expect(page.getByTestId("summary")).toContainText("68,750 cu ft");
  });
});

test("playback costs little JavaScript per frame", async ({ page }) => {
  // Software WebGL (SwiftShader) here: frame rate depends on canvas size, so measure
  // main-thread script time per frame on a small canvas instead of trusting fps.
  await page.setViewportSize({ width: 640, height: 420 });
  await page.goto("/?parcel=fixture-a&step=0");
  await expectSceneDrawn(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const scriptSeconds = async () =>
    (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "ScriptDuration")!.value;
  await page.getByRole("button", { name: "Play" }).click();
  const before = await scriptSeconds();
  const frames = await page.evaluate(
    () =>
      new Promise<{ count: number; seconds: number }>((resolve) => {
        let count = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
          count++;
          if (t - t0 < 3000) requestAnimationFrame(tick);
          else resolve({ count, seconds: (t - t0) / 1000 });
        };
        requestAnimationFrame(tick);
      }),
  );
  const msPerFrame = ((await scriptSeconds()) - before) * 1000 / frames.count;
  const fps = frames.count / frames.seconds;
  test.info().annotations.push({ type: "perf", description: `${fps.toFixed(1)} fps, ${msPerFrame.toFixed(2)} ms script per frame (640×420, SwiftShader)` });
  console.log(`perf: ${fps.toFixed(1)} fps, ${msPerFrame.toFixed(2)} ms script per frame`);
  expect(msPerFrame).toBeLessThan(5);
});

test("a front choice that leaves nothing still reaches the result and says why", async ({ page }) => {
  // 1042 Persia Ave (RH-1) measured from its 100 ft side is 25 ft deep: 15 ft rear yard + 10 ft setback.
  await page.goto("/?parcel=6094001&front=0&step=99");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("0 cu ft");
  await expect(page.locator(".fact-card")).toContainText("Nothing is left: together these limits cover the whole lot.");
  await page.locator(".front-note").getByRole("button", { name: "Change" }).click();
  await page.getByRole("region", { name: "Choose the front" }).getByRole("button", { name: /Side B/ }).click();
  await expect(page).toHaveURL(/front=1/);
  await expect(page.locator(".fact-card")).not.toContainText("Nothing is left");
});

test("a hillside lot measures its slope: 124 Clarendon Ave falls from the street", async ({ page }) => {
  await page.goto("/?parcel=2687029&step=5");
  await expect(page.locator(".fact-card h2")).toHaveText("124 Clarendon Ave");
  // USGS 3DEP ground, measured along the lot lines (replayed).
  await expect(page.getByTestId("ground")).toContainText(/Rear 3\d\.\d ft lower than front · level with or below the street/);
  await expect(page.locator(".fact-card")).toContainText("USGS 3DEP 1 m LiDAR (CA_SanFrancisco_B23): 2023-04-20");
  await expect(label(page)).toHaveText("Rule 5 of 12: RH-1(D) dwelling cap");
  await expect(currentSentence(page)).toHaveText(
    /^RH-1\(D\) dwelling cap: the rear lot line averages 3\d\.\d ft lower than the front \(.*\), 20 ft or more, so 30 ft instead of 35 ft\.$/,
  );
  await expect(page.locator("[data-rule=height-reference] .sentence")).toContainText("slopes down from the street, so heights are measured from the curb");
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/clarendon-slope-cap.png` });
  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/clarendon-slope-result.png` });
});

test("an uphill lot: 118 Dellbrook Ave rises 37 ft, so 40 ft and no front plane, stepping up the hill", async ({ page }) => {
  await page.goto("/?parcel=2820020&step=9");
  await expect(page.locator(".fact-card h2")).toHaveText("118 Dellbrook Ave");
  await expect(page.getByTestId("ground")).toContainText(/Rear 3\d\.\d ft higher than front · slopes up from the street/);
  await expect(label(page)).toHaveText("Rule 9 of 12: Front height plane");
  await expect(page.locator("[aria-current=step] .chip")).toHaveText("Doesn't apply");
  await expect(currentSentence(page)).toHaveText(/^Front height plane: doesn't apply, because the rear lot line averages 3\d\.\d ft higher than the front \(20 ft or more\)\.$/);
  await expect(page.locator("[data-rule=rh-dwelling-height] .sentence")).toContainText("so 40 ft instead of 35 ft");
  await expect(page.locator("[data-rule=height-reference] .sentence")).toContainText("the lot slopes up from the street");
  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("4 stories");
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/dellbrook-uphill-result.png` });
});

test("an RM-2 lot: 619 Chestnut St keeps a 30% rear yard, and its floor-area limit covers shops only", async ({ page }) => {
  await page.goto("/?parcel=0065024&step=5");
  await expect(page.locator(".fact-card h2")).toHaveText("619–621 Chestnut St");
  await expect(label(page)).toHaveText("Rule 5 of 11: Rear yard");
  await expect(currentSentence(page)).toHaveText("Rear yard: 30% of 97.7 ft lot depth = 29.3 ft.");

  // The FAR card is a budget with a gauge, not a cut, so it has no on/off switch.
  const far = page.locator("[data-rule=far]");
  await expect(far.locator(".sentence")).toContainText("1.8 × 3,346 sq ft = 6,023 sq ft. Homes don't count toward it.");
  await expect(far.getByTestId("far-gauge")).toContainText("could be non-residential, and homes may use any of it");
  await expect(far.locator(".eye")).toHaveCount(0);
  await expect(page.locator("[data-rule=front-modulation]")).toContainText("Not modeled");

  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("far-cap")).toHaveText("6,023 sq ft (FAR 1.8; homes aren't limited)");
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/chestnut-rm2-result.png` });
});

test("an NC-2 lot: 2385 Folsom St has a 14 ft shop floor, and its rear yard starts above it", async ({ page }) => {
  await page.goto("/?parcel=3593008&step=6");
  await expect(page.locator(".fact-card h2")).toHaveText("2385–2389 Folsom St");
  await expect(page.locator("[data-rule=ground-floor] .sentence")).toContainText(
    "a shop or other non-residential ground floor must be at least 14 ft floor to floor, because this lot is in a 45 ft height district",
  );
  await expect(label(page)).toHaveText("Rule 6 of 12: Rear yard");
  await expect(currentSentence(page)).toHaveText(/^Rear yard: 25% of 95 ft lot depth = 23\.7 ft\. It starts above the 14 ft first story/);
  await expect(page.locator(".dimension-label").filter({ hasText: "14 ft first story" })).toHaveCount(1);
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/folsom-nc2-rear-yard.png` });

  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("4 stories at 10 ft floor-to-floor, 14 ft ground floor");
  await expect(page.getByTestId("far-cap")).toContainText("(FAR 2.5; homes aren't limited)");
});

test("bulk limits: 800 Powell St (RM-4, 65-A) is trimmed to a 110 ft box above 40 ft", async ({ page }) => {
  await page.goto("/?parcel=0243017&front=0&step=7");
  await expect(page.locator(".fact-card h2")).toHaveText("800 Powell St");
  await expect(label(page)).toHaveText("Rule 7 of 10: Bulk limits");
  await expect(currentSentence(page)).toHaveText(
    /^Bulk limits: 65-A: above 40 ft, no floor may be longer than 110 ft or measure more than 125 ft corner to corner\. Above 40 ft the envelope is 116\.\d ft wide .* so the upper floors are drawn as a 110 ft × \d+(\.\d)? ft box at the front; they could sit anywhere on the lot within those dimensions\.$/,
  );
  await expect(page.locator("[aria-current=step] .removed-line")).toContainText("cu ft removed");
  await expect(page.locator(".dimension-label").filter({ hasText: /^110 ft$/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Turn off Bulk limits" })).toBeVisible();
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/powell-bulk.png` });
});

test("Housing Choice-SF: 1345 Clement St (NC-1, 40//65-R-4) switches to 65 ft and an 18% rear yard", async ({ page }) => {
  test.setTimeout(180_000); // see expectSceneDrawn: two engine runs and a scrub on a lot with buildings and terrain
  await page.goto("/?parcel=1446048&step=3");
  await expect(page.locator(".fact-card h2")).toHaveText("1345–1347 Clement St");
  await expect(label(page)).toHaveText("Rule 3 of 12: Housing Choice-SF");
  await expect(currentSentence(page)).toHaveText(
    "Housing Choice-SF: off. Under it, the height limit would be 65 ft instead of 40 ft; the rear yard would follow the program's own rule (§206.10(d)(1)(E)(i)–(ii)). Turn it on to see that envelope.",
  );
  await expect(page.locator("[data-rule=mapped-height] .sentence")).toHaveText(
    "Height limit: 40 ft (40//65-R-4; up to 65 ft under Housing Choice-SF, which isn't switched on).",
  );

  const toggle = page.getByRole("switch", { name: "Housing Choice-SF: off" });
  await toggle.click();
  await expect(page).toHaveURL(/program=1/);
  await expect(page.getByRole("switch", { name: "Housing Choice-SF: on" })).toHaveAttribute("aria-checked", "true");
  await expect(label(page)).toHaveText("Rule 3 of 12: Housing Choice-SF");
  await expect(currentSentence(page)).toHaveText(/^Housing Choice-SF: on\. Under it, the height limit is 65 ft instead of 40 ft; .* Not drawn: the optional height bonuses/);
  await expect(page.locator("[data-rule=mapped-height] .sentence")).toHaveText("Height limit: 65 ft under Housing Choice-SF (40//65-R-4; 40 ft without it).");
  await expect(page.locator("[data-rule=rear-yard] .sentence")).toHaveText(/^Rear yard: 18% of 100 ft lot depth = 18 ft\. It starts above the 14 ft first story/);
  await expect(page.locator("[data-rule=rear-yard] footer a")).toContainText("§206.10(d)(1)(E)(i)–(ii)");
  await page.locator("[data-rule=local-program]").screenshot({ path: `${SHOTS}/clement-housing-choice-card.png` });

  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  const summary = page.getByTestId("summary");
  await expect(summary).toContainText("6 stories");
  await expect(summary).toContainText("26,775 sq ft");
  await expect(page.getByTestId("program-compare")).toHaveText("15,750 sq ft in 4 stories (+11,025 sq ft, +2 stories with the program)");
  await expectSceneDrawn(page, 120_000);
  await page.screenshot({ path: `${SHOTS}/clement-housing-choice.png` });

  // Off again: the URL forgets it and the comparison goes away.
  await page.getByRole("switch", { name: "Housing Choice-SF: on" }).click();
  await expect(page).not.toHaveURL(/program=/);
  await expect(summary).toContainText("15,750 sq ft");
  await expect(page.getByTestId("program-compare")).toHaveCount(0);
});

test("Housing Choice-SF on a hillside: 124 Clarendon Ave drops its 30 ft slope cap and front plane", async ({ page }) => {
  await page.goto("/?parcel=2687029&program=1&step=5");
  await expect(label(page)).toHaveText("Rule 5 of 12: RH-1(D) dwelling cap");
  await expect(page.locator("[aria-current=step] .chip")).toHaveText("Doesn't apply");
  await expect(currentSentence(page)).toHaveText(
    "RH-1(D) dwelling cap: doesn't apply under Housing Choice-SF. Section 261 doesn't apply to Housing Choice-SF projects (§206.10(d)(1)(C)).",
  );
  // Nothing to switch off on a rule that doesn't apply.
  await expect(page.locator("[data-rule=rh-dwelling-height] .eye")).toHaveCount(0);
  await expect(page.locator("[data-rule=front-plane] .chip")).toHaveText("Doesn't apply");
  await expect(page.locator("[data-rule=mapped-height] .sentence")).toHaveText("Height limit: 40 ft under Housing Choice-SF (40//40-R-4; the same without it).");
  await page.getByRole("slider", { name: "Timeline" }).fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("program-compare")).toContainText("with the program");
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/clarendon-housing-choice.png` });
});

/** Saves a download into e2e/screenshots and measures it in the page: size, plus red (removed volume) and dark (text) pixels per region. */
async function measurePng(page: Page, download: Download, regions: [number, number, number, number][]) {
  const path = `${SHOTS}/${download.suggestedFilename()}`;
  await download.saveAs(path);
  const data = (await readFile(path)).toString("base64");
  return page.evaluate(
    async ({ data, regions }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const counts = regions.map(([x0, y0, x1, y1]) => {
        const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        let red = 0;
        let dark = 0;
        for (let i = 0; i < px.length; i += 4) {
          const [r, g, b] = [px[i]!, px[i + 1]!, px[i + 2]!];
          if (r - g > 60 && r - b > 60) red++;
          if (r < 80 && g < 80 && b < 80) dark++;
        }
        return { red, dark };
      });
      return { width: img.width, height: img.height, counts };
    },
    { data, regions },
  );
}

test("Save image: the rear-yard view as a PNG with its red piece, rule card and link, the page untouched", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=6");
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expectSceneDrawn(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save image" }).click()]);
  expect(download.suggestedFilename()).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-rule-6.png");
  const png = await measurePng(page, download, [[0, 0, 1600, 900]]); // the scene
  expect(png.width).toBe(1600);
  expect(png.counts[0]!.red).toBeGreaterThan(2000);
  // The caption band: dark heading and sentence text below the scene.
  const caption = await measurePng(page, download, [[0, png.height - 420, 1600, png.height]]);
  expect(caption.counts[0]!.dark).toBeGreaterThan(2000);
  await expect(page).toHaveURL(/step=6/);
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expect(page.getByRole("button", { name: "Save image" })).toBeEnabled();
});

test("Storyboard: one tile per cut, red only where a rule removes volume, the playhead untouched", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=6");
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expectSceneDrawn(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Storyboard" }).click()]);
  expect(download.suggestedFilename()).toBe("zoningviz-fixture-a-synthetic-25-100-ft-lot-storyboard.png");
  // Start, height limit, rear yard, front plane, result: 3 columns of 640 px tiles, 2 rows.
  const tile = (column: number, row: number): [number, number, number, number] => {
    const x = 48 + column * 660;
    const y = 200 + row * (480 + 84 + 20);
    return [x, y, x + 640, y + 470];
  };
  const png = await measurePng(page, download, [tile(0, 0), tile(1, 0), tile(2, 0), tile(1, 1)]);
  expect(png.width).toBe(48 * 2 + 3 * 640 + 2 * 20);
  expect(png.height).toBeGreaterThan(2 * 480 + 200);
  const [start, height, rear, result] = png.counts;
  expect(start!.red).toBe(0);
  expect(height!.red).toBeGreaterThan(2000);
  expect(rear!.red).toBeGreaterThan(500);
  expect(result!.red).toBe(0);
  await expect(page).toHaveURL(/step=6/);
  await expect(label(page)).toHaveText("Rule 6 of 11: Rear yard");
  await expect(page.getByTestId("hud-volume")).toHaveText("100,000 cu ft");
});

test("share images work on a hillside lot and with Housing Choice-SF on", async ({ page }) => {
  for (const [query, name] of [
    ["parcel=2687029&step=99", "zoningviz-124-clarendon-ave-storyboard.png"],
    ["parcel=1446048&program=1&step=99", "zoningviz-1345-1347-clement-st-storyboard.png"],
  ] as const) {
    await page.goto(`/?${query}`);
    await expect(label(page)).toHaveText("Result");
    await expectSceneDrawn(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Storyboard" }).click()]);
    expect(download.suggestedFilename()).toBe(name);
    const png = await measurePng(page, download, [[0, 0, 600, 200]]);
    expect(png.counts[0]!.dark).toBeGreaterThan(500); // the heading
  }
  const [view] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save image" }).click()]);
  expect(view.suggestedFilename()).toBe("zoningviz-1345-1347-clement-st-result.png");
  await view.saveAs(`${SHOTS}/${view.suggestedFilename()}`);
});
