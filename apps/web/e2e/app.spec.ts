import { expect, test, type Page } from "@playwright/test";
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

/** The WebGL canvas drew a real scene, not a blank clear color (polls until the first frames land). */
async function expectSceneDrawn(page: Page) {
  await expect.poll(() => distinctColors(page), { timeout: 20_000 }).toBeGreaterThan(20);
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
    ["Rule 1 of 9: Homes, up to two units", /^RH-2 lots are for homes: two units per lot/],
    ["Rule 2 of 9: Where height is measured from", /no ground elevations for this lot, so it is treated as flat/],
    ["Rule 3 of 9: Height limit", "Height limit: 40 ft (40-X)."],
    ["Rule 4 of 9: RH-2 dwelling cap", /assumes a flat lot: 40 ft\. Already satisfied/],
    ["Rule 5 of 9: Rear yard", "Rear yard: 30% of 100 ft lot depth = 30 ft."],
    ["Rule 6 of 9: Front setback", /0 ft, your setting.*Already satisfied/],
    ["Rule 7 of 9: Front height plane", /above 30 ft, the building steps back at 45°/],
    ["Rule 8 of 9: Narrow streets", /^Not modeled:/],
    ["Rule 9 of 9: Cross-slope", /^Not modeled:/],
  ];
  for (const [i, [stepLabel, sentence]] of expected.entries()) {
    await next(page).click();
    await expect(label(page)).toHaveText(stepLabel);
    await expect(currentSentence(page)).toHaveText(sentence);
    await expect(page).toHaveURL(new RegExp(`step=${i + 1}`));
    if (i === 4) {
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
  await expect(page.locator(".rule-card")).toHaveCount(9);
  await expect(page.locator(".tag-unverified")).toHaveCount(9);
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/fixture-a-result.png` });
});

test("Back, arrow keys and deep links move between steps", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=5");
  await expect(label(page)).toHaveText("Rule 5 of 9: Rear yard");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(label(page)).toHaveText("Rule 4 of 9: RH-2 dwelling cap");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(label(page)).toHaveText("Rule 6 of 9: Front setback");
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
  for (let i = 1; i <= 9; i++) {
    await next(page).click();
    await expect(label(page)).toContainText(`Rule ${i} of 9`);
    sentences.push((await currentSentence(page).textContent()) ?? "");
    if (i === 5) await page.screenshot({ path: `${SHOTS}/hampshire-front-setback.png` });
  }
  expect(sentences[1]).toMatch(/^Where height is measured from: the lot slopes up from the street/);
  expect(sentences[3]).toMatch(/^RH-2 dwelling cap: the rear lot line averages 5\.\d ft higher than the front .*, so 40 ft\./);
  expect(sentences[4]).toBe("Rear yard: 30% of 100 ft lot depth = 30 ft.");
  expect(sentences[5]).toContain("this shows the 10 ft maximum.");

  await next(page).click();
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("4 stories"); // stepping up the gentle slope
  await expect(page.getByTestId("summary")).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/hampshire-result.png` });
});

test("the setback slider recomputes the envelope", async ({ page }) => {
  await page.goto("/?parcel=4025007&step=6");
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
  await page.goto("/?parcel=0119012");
  await expect(page.locator(".notice")).toContainText("Zoned RM-2. Rule files exist for RH-1(D), RH-1, RH-1(S), RH-2, RH-3 only so far");
  await expect(page.locator(".fact-card")).toContainText("RM-2");
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
  await expect(page).toHaveURL(/step=10/);
  await expect(page.getByTestId("summary")).toContainText("68,750 cu ft");
  await expect(page.getByTestId("hud-volume")).toHaveText("68,750 cu ft");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/fixture-a-played.png` });
});

test("the scrubber jumps to a rule's tick and drags both ways", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=0");
  await page.getByRole("button", { name: "Go to rule 5: Rear yard" }).click();
  await expect(label(page)).toHaveText("Rule 5 of 9: Rear yard");
  await expect(page).toHaveURL(/step=5/);
  const scrubber = page.getByRole("slider", { name: "Timeline" });
  await scrubber.fill("1000");
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("hud-volume")).toHaveText("68,750 cu ft");
  await scrubber.fill("0");
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expect(page.getByTestId("hud-volume")).toHaveText("200,000 cu ft");
  await scrubber.fill("520");
  await expect(label(page)).toHaveText(/^Rule \d of 9/);
  await page.screenshot({ path: `${SHOTS}/fixture-a-scrubbed.png` });
});

test("switching a rule off recomputes the envelope and keeps the step", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=5");
  await page.getByRole("button", { name: "Turn off Rear yard" }).click();
  await expect(page).toHaveURL(/off=rear-yard/);
  await expect(label(page)).toHaveText("Rule 5 of 9: Rear yard");
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
  await page.goto("/?parcel=2687029&step=4");
  await expect(page.locator(".fact-card h2")).toHaveText("124 Clarendon Ave");
  // USGS 3DEP ground, measured along the lot lines (replayed).
  await expect(page.getByTestId("ground")).toContainText(/Rear 3\d\.\d ft lower than front · level with or below the street/);
  await expect(page.locator(".fact-card")).toContainText("USGS 3DEP 1 m LiDAR (CA_SanFrancisco_B23): 2023-04-20");
  await expect(label(page)).toHaveText("Rule 4 of 10: RH-1(D) dwelling cap");
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
