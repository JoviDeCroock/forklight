// Records demo footage by driving the real app in real Chrome with the WebMCP
// testing hook: the agent beats run as genuine tool executions, the human
// beats as mouse interactions with a synthetic cursor overlay. Deterministic
// by design — the incident engine has no clock and no randomness.
//
// Usage: node scripts/record-demo.mjs [url] [clip]
//   clip: full | agent | switch | tune   (default: full)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import ffmpeg from "ffmpeg-static";

const url = process.argv[2] ?? "http://localhost:3000/";
const clip = process.argv[3] ?? "full";
const outDir = "media/raw";
mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 1600, height: 1000 };
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-features=WebMCPTesting", "--force-device-scale-factor=2"],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  recordVideo: { dir: outDir, size: VIEWPORT },
});
const page = await context.newPage();

const sleep = (ms) => page.waitForTimeout(ms);

async function ready() {
  await page.waitForFunction(async () => {
    const listed = await navigator.modelContextTesting?.listTools?.();
    return listed?.length > 0;
  });
  await sleep(1600);
}

async function exec(name, input) {
  const raw = await page.evaluate(
    ([n, i]) => navigator.modelContextTesting.executeTool(n, i),
    [name, JSON.stringify(input)],
  );
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed?.ok) throw new Error(`${name} failed: ${JSON.stringify(parsed).slice(0, 200)}`);
  return parsed;
}

// Synthetic cursor for human beats (headless recordings have no OS cursor).
async function showCursor() {
  await page.evaluate(() => {
    if (document.getElementById("__cursor")) return;
    const dot = document.createElement("div");
    dot.id = "__cursor";
    dot.style.cssText =
      "position:fixed;z-index:99999;width:22px;height:22px;border-radius:50%;" +
      "background:rgba(244,244,245,0.25);border:1.5px solid rgba(244,244,245,0.9);" +
      "pointer-events:none;transform:translate(-50%,-50%);transition:width .12s,height .12s;left:-40px;top:-40px";
    document.body.appendChild(dot);
    window.addEventListener(
      "mousemove",
      (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
      },
      true,
    );
    window.addEventListener(
      "mousedown",
      () => {
        dot.style.width = "14px";
        dot.style.height = "14px";
        setTimeout(() => {
          dot.style.width = "22px";
          dot.style.height = "22px";
        }, 140);
      },
      true,
    );
  });
}

async function moveTo(testid, ms = 700) {
  const box = await page.getByTestId(testid).first().boundingBox();
  if (!box) throw new Error(`no box for ${testid}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: Math.round(ms / 16) });
}

async function click(testid) {
  await moveTo(testid);
  await sleep(250);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}

// --- beats --------------------------------------------------------------------

async function agentInvestigates({ pace = 1 } = {}) {
  // The agent orients, digs into evidence, forks two counterfactuals,
  // simulates, compares, and stages — the canvas updates after each call.
  await exec("incident.snapshot", {});
  await sleep(1400 * pace);
  await exec("signals.query", { signal: "logs:checkout-web" });
  await sleep(1600 * pace);
  await exec("signals.query", { signal: "checkout_error_rate" });
  await sleep(1400 * pace);
  const fork1 = await exec("scenario.fork", {
    name: "Bypass price cache",
    hypothesis: "Errors stop if cart pricing skips the fragmented price:v2 cache",
  });
  await sleep(2100 * pace);
  const fork2 = await exec("scenario.fork", {
    name: "Roll back v8.3.1",
    hypothesis: "Reverting checkout-web removes the bad cache entirely",
  });
  await sleep(2100 * pace);
  const s1 = fork1.data.scenario.id;
  const s2 = fork2.data.scenario.id;
  await exec("scenario.simulate", { scenario: s1, mitigation: "bypass_price_cache" });
  await sleep(2600 * pace);
  await exec("scenario.simulate", { scenario: s2, mitigation: "rollback_deploy" });
  await sleep(2600 * pace);
  await exec("scenario.compare", {});
  await sleep(1700 * pace);
  await exec("mitigation.stage", {
    scenario: s1,
    rationale:
      "Fastest recovery (~2 min) at moderate, well-understood cost: origin re-takes pricing reads. Keeps v8.3.1 so the team can fix forward.",
    evidence: [
      "checkout_error_rate 14:05–14:32",
      "PriceMismatchError cache_key=price:v2",
      "edge-cache key fragmentation 1.9M keys",
    ],
  });
  await sleep(2400 * pace);
  return { s1, s2 };
}

async function humanApplies() {
  await showCursor();
  const proposal = await page
    .locator('[data-testid^="apply-"]')
    .first()
    .getAttribute("data-testid");
  await sleep(900);
  await click(proposal);
  await sleep(1500);
  await click("confirm-commit");
  await sleep(3200);
}

async function focusFollow(s2) {
  await showCursor();
  await click(`scenario-${s2}`);
  await sleep(1800);
  await exec("scenario_tune", { mitigation: "purge_edge_cache" });
  await sleep(2800);
}

// --- clips --------------------------------------------------------------------

await page.goto(url);
await ready();
await sleep(2200); // establish the incident

let name = clip;
if (clip === "full") {
  // The human copies the demo prompt (handing off to the agent), then the
  // agent works the canvas.
  await showCursor();
  await click("copy-prompt");
  await sleep(1400);
  const { s2 } = await agentInvestigates();
  await sleep(1200);
  await focusFollow(s2);
  await humanApplies();
  await sleep(2000);
} else if (clip === "agent") {
  await agentInvestigates({ pace: 0.7 });
} else if (clip === "switch") {
  await agentInvestigates({ pace: 0.45 });
  await humanApplies();
  await sleep(1600);
} else if (clip === "tune") {
  const { s2 } = await agentInvestigates({ pace: 0.45 });
  await focusFollow(s2);
} else {
  throw new Error(`unknown clip ${clip}`);
}

await context.close();
await browser.close();

// Rename the recording and convert to mp4.
const webm = readdirSync(outDir).filter((f) => f.endsWith(".webm")).sort().pop();
const base = `media/forklight-${name}`;
renameSync(`${outDir}/${webm}`, `${base}.webm`);
execFileSync(ffmpeg, [
  "-y", "-i", `${base}.webm`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "18",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-vf", "scale=1920:1200:flags=lanczos",
  `${base}.mp4`,
]);
console.log(`wrote ${base}.webm and ${base}.mp4`);
