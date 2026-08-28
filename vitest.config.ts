import { defineConfig } from "vitest/config";

// Deliberately standalone: loading vite.config.ts would pull in the pracht
// plugin (and the Cloudflare adapter) for tests that only need plain Node.
// Playwright owns tests/e2e; vitest never looks at it.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".wrangler/**"],
    setupFiles: ["tests/unit/setup.ts"],
    // src/server/audit.ts logs one line per dispatch; keep it for failures
    // only so a green run stays readable.
    silent: "passed-only",
  },
});
