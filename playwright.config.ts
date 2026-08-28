import { defineConfig, devices } from "@playwright/test";

// The WebMCP page-tool API only exists in real Chrome behind
// --enable-features=WebMCPTesting, which is what exposes
// navigator.modelContextTesting to the test.
const PORT = Number(process.env.FORKLIGHT_E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Every spec drives one shared D1 through the preview worker; serial keeps
  // the transcript readable and the incident state attributable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // No retries on purpose: a flaky proof is not a proof.
  retries: 0,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // CI pins Chrome 151 via an explicit executable (152 removed the
    // modelContextTesting automation hook); locally the installed Chrome is
    // used through the channel.
    ...(process.env.CHROME_EXECUTABLE_PATH ? {} : { channel: "chrome" as const }),
    launchOptions: {
      args: ["--enable-features=WebMCPTesting"],
      ...(process.env.CHROME_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
        : {}),
    },
  },
  webServer: {
    // `pracht preview` builds, then serves the production build on workerd
    // with the local D1 state in .wrangler/. The confirmation secret also
    // lives in .dev.vars, which is what the worker actually reads.
    command: `npx pracht preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // wrangler logs a line per asset request; only surface real problems.
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PRACHT_CONFIRMATION_SECRET:
        process.env.PRACHT_CONFIRMATION_SECRET ?? "dev-only-forklight-confirmation-secret",
    },
  },
});
