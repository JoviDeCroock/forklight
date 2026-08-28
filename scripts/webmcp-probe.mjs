// Quick dogfood probe: real Chrome + --enable-features=WebMCPTesting against
// a running dev/preview server. Usage: node scripts/webmcp-probe.mjs [url]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3000/";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-features=WebMCPTesting"],
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.log("PAGEERROR:", String(error).slice(0, 300)));

page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) console.log("NAV:", frame.url());
});
await page.goto(url);
await page.waitForFunction(async () => {
  const listed = await navigator.modelContextTesting?.listTools?.();
  return listed?.length > 0;
});
// The testing hook's view can lag registration; settle before executing.
await page.waitForTimeout(1500);

const report = await page.evaluate(async () => {
  const testing = navigator.modelContextTesting;
  const out = {};
  const listed = await testing.listTools();
  out.tools = listed.map((t) => t.name).sort();

  const exec = async (name, input) => {
    try {
      return await testing.executeTool(name, JSON.stringify(input));
    } catch (error) {
      return { threw: String(error).slice(0, 200) };
    }
  };

  out.snapshot = await exec("incident.snapshot", {});
  out.fork = await exec("scenario.fork", {
    name: "Bypass response cache",
    hypothesis: "Errors stop if web skips the new cache",
  });
  return out;
});

console.log("tools:", JSON.stringify(report.tools));
const parse = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return value;
  }
};
const snapshot = parse(report.snapshot);
const fork = parse(report.fork);
console.log("snapshot.ok:", snapshot?.ok, "| incident:", snapshot?.data?.incident?.id, snapshot?.data?.incident?.status);
console.log("fork.ok:", fork?.ok, "| scenario:", JSON.stringify(fork?.data?.scenario ?? fork));

// Did the UI revalidate and show the fork + ledger rows?
await page.waitForTimeout(1200);
const ui = await page.evaluate(() => ({
  scenarioCards: [...document.querySelectorAll('[data-testid^="scenario-s-"]')].map((n) =>
    n.getAttribute("data-testid"),
  ),
  ledgerEntries: document.querySelectorAll('[data-testid="ledger-entry"]').length,
  toolCountChip: document.querySelector('[data-testid="tool-count"]')?.textContent ?? null,
}));
console.log("ui:", JSON.stringify(ui));
await browser.close();
