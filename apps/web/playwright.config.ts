import { defineConfig } from "@playwright/test";

// @playwright/test is pinned to 1.56.1 so it uses the Chromium build that is
// already installed (PLAYWRIGHT_BROWSERS_PATH); nothing is downloaded.
// DataSF is replayed from e2e/fixtures/datasf; LIVE=1 fetches and records.
export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.output",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1360, height: 820 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
