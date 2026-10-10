import { expect, test, type Page } from "@playwright/test";
import { replayDataSf } from "./datasf";

const SHOTS = "e2e/screenshots";

// Fail any test whose page logs an error or throws.
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

const label = (page: Page) => page.getByTestId("step-label");
const currentSentence = (page: Page) => page.locator("[aria-current=step] .sentence");
const next = (page: Page) => page.getByRole("button", { name: "Next →" });

/** The WebGL canvas drew a real scene, not a blank clear color (polls until the first frames land). */
async function expectSceneDrawn(page: Page) {
  await expect.poll(() => distinctColors(page), { timeout: 20_000 }).toBeGreaterThan(20);
}

function distinctColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector(".scene canvas") as HTMLCanvasElement;
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

  const expected: [string, string | RegExp][] = [
    ["Rule 1 of 7: Homes, up to two units", "RH-2 lots are for homes, with up to two dwelling units on a lot."],
    ["Rule 2 of 7: Height limit", "Height limit: 40 ft (40-X)."],
    ["Rule 3 of 7: RH-2 dwelling cap", /Already satisfied/],
    ["Rule 4 of 7: Rear yard", "Rear yard: 30% of 100 ft lot depth = 30 ft."],
    ["Rule 5 of 7: Front setback", /0 ft, your setting.*Already satisfied/],
    ["Rule 6 of 7: Front height plane", /above 30 ft, the building steps back at 45°/],
    ["Rule 7 of 7: Slope can lower the limit", /^Not modeled:/],
  ];
  for (const [i, [stepLabel, sentence]] of expected.entries()) {
    await next(page).click();
    await expect(label(page)).toHaveText(stepLabel);
    await expect(currentSentence(page)).toHaveText(sentence);
    await expect(page).toHaveURL(new RegExp(`step=${i + 1}`));
    if (i === 3) {
      await expect(page.locator(".dimension-label")).toHaveText("30 ft");
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
  await expect(page.locator(".rule-card")).toHaveCount(7);
  await expect(page.locator(".tag-unverified")).toHaveCount(7);
  await expectSceneDrawn(page);
  await page.screenshot({ path: `${SHOTS}/fixture-a-result.png` });
});

test("Back, arrow keys and deep links move between steps", async ({ page }) => {
  await page.goto("/?parcel=fixture-a&step=4");
  await expect(label(page)).toHaveText("Rule 4 of 7: Rear yard");
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(label(page)).toHaveText("Rule 3 of 7: RH-2 dwelling cap");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(label(page)).toHaveText("Rule 5 of 7: Front setback");
  await page.goto("/?parcel=fixture-a&step=99");
  await expect(label(page)).toHaveText("Result");
});

test("real lot 667 Hampshire St: every step from DataSF data", async ({ page }) => {
  await page.goto("/?parcel=4025007");
  await expect(page.locator(".fact-card h2")).toHaveText("667 Hampshire St");
  await expect(page.locator(".fact-card")).toContainText("25.0 ft wide × 100.0 ft deep");
  await expect(label(page)).toHaveText("Start: everything up to 80 ft");
  await expectSceneDrawn(page);

  const sentences: string[] = [];
  for (let i = 1; i <= 7; i++) {
    await next(page).click();
    await expect(label(page)).toContainText(`Rule ${i} of 7`);
    sentences.push((await currentSentence(page).textContent()) ?? "");
    if (i === 5) await page.screenshot({ path: `${SHOTS}/hampshire-front-setback.png` });
  }
  expect(sentences[3]).toBe("Rear yard: 30% of 100 ft lot depth = 30 ft.");
  expect(sentences[4]).toContain("Showing the 10 ft maximum.");

  await next(page).click();
  await expect(label(page)).toHaveText("Result");
  await expect(page.getByTestId("summary")).toContainText("4 stories");
  await expect(page.getByTestId("summary")).toBeInViewport();
  await page.screenshot({ path: `${SHOTS}/hampshire-result.png` });
});

test("the setback slider recomputes the envelope", async ({ page }) => {
  await page.goto("/?parcel=4025007&step=5");
  await expect(currentSentence(page)).toContainText("Showing the 10 ft maximum.");
  await page.locator(".setback-slider input").fill("4");
  await expect(page).toHaveURL(/setback=4/);
  await expect(currentSentence(page)).toHaveText("Front setback: 4 ft, your setting. The rule follows the neighbors' setbacks, up to 10 ft.");
  await expect(page.locator("[aria-current=step] .removed-line")).toContainText("4,000 cu ft removed");
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
  await expect(page.locator(".notice")).toContainText("Rule files exist for RH-2 only so far");
  await expect(page.locator(".fact-card")).toContainText("RM-2");
});
