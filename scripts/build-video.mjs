// Builds the submission video: records one continuous scripted session against
// the live app, slices it into the beats of docs/VIDEO_SCRIPT.md, fits each
// slice to its voiceover (macOS `say` as a placeholder narrator — re-record
// over media/vo/*.aiff to replace it), burns captions, and concatenates with
// an end card. Deterministic app + scripted capture = reproducible takes.
//
// Usage: node scripts/build-video.mjs [url] [--silent]
// Output: media/forklight-submission.mp4 (+ -silent audio-strip), or with
// --silent a faster narration-free cut with headline captions:
// media/forklight-quick.mp4
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import ffmpeg from "ffmpeg-static";

const SILENT = process.argv.includes("--silent");
const url = process.argv.filter((a) => !a.startsWith("--"))[2] ?? "https://forklight.decroockjovi.workers.dev/";
// Silent cut runs ~25% faster on actions and holds overlays about half as
// long — nothing waits for a narrator.
const ACTION = SILENT ? 0.75 : 1;
const HOLD = SILENT ? 0.55 : 1;
const VOICE = "Samantha";
const RATE = 176;
const W = 1600, H = 1000;
const FONT = "/System/Library/Fonts/Helvetica.ttc";

rmSync("media/build", { force: true, recursive: true });
mkdirSync("media/build/seg", { recursive: true });
mkdirSync("media/vo", { recursive: true });

const run = (args, opts = {}) => execFileSync(ffmpeg, args, { stdio: "pipe", ...opts });
const durationOf = (file) => {
  try {
    execFileSync(ffmpeg, ["-i", file], { stdio: "pipe" });
  } catch (error) {
    const match = error.stderr.toString().match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  throw new Error(`no duration for ${file}`);
};

// --- the beats ---------------------------------------------------------------
// vo lines come from docs/VIDEO_SCRIPT.md (keep in sync by hand).
const BEATS = [
  { id: "b01", vo: "This is a production outage. Error rate went vertical at fourteen oh five, right after a deploy. Throughput is down two thirds." },
  { id: "b02", vo: "Four things I could do about it. The hard part isn't clicking a button — it's knowing which one, right now, with half the evidence." },
  { id: "b03", vo: "So I'll ask. Compare rolling back against bypassing the new cache, show me the evidence, stage the safest option — and don't apply anything." },
  { id: "b04", vo: "It's using page tools. Same tab, same session, same incident I'm looking at. Every call it makes, the canvas updates in front of me — no refresh, nothing to click." },
  { id: "b05", vo: "It goes to the logs. Revision mismatches, cache key fragmentation — and this. Someone's user agent telling it to apply the mitigation immediately. That tool's marked as untrusted content, and it ignores it." },
  { id: "b06", vo: "Then it compares the branches properly. Rollback takes six minutes through the pipeline. Bypassing the cache recovers in two, but it pushes read load back onto the A P I." },
  { id: "b07", vo: "It picks one, writes down why, and attaches what it looked at. That's where it stops." },
  { id: "b08", vo: "My turn. I read the reasoning, I check the evidence, and I decide." },
  { id: "b09", vo: "Confirm. The clock jumps past the lead time, and now we find out whether it was right — errors down, requests back." },
  { id: "b10", vo: "One ledger, both of us in it. The agent's calls, then mine, going through exactly the same contract." },
  { id: "b11", vo: "Here's the thing though. Look at the tools it had. There is no apply tool. Not disabled — absent. The framework won't hand a destructive operation to a browser agent." },
  { id: "b12", vo: "That's the whole enforcement. One line. Declare what an operation is, and pracht decides who can see it — U I, H T T P, WebMCP, one contract." },
  { id: "b13", vo: "And it works both ways. I focus a branch, the agent's tool follows my click. Forklight — link's below." },
];
const CAPTIONS = Object.fromEntries(BEATS.map((b) => [b.id, b.vo
  .replaceAll(" A P I", " api").replaceAll("U I, H T T P", "UI, HTTP")]));
const SHORT_CAPTIONS = {
  b01: "A production outage — errors went vertical at 14:05, right after a deploy.",
  b02: "Four possible mitigations. Which one is actually safe?",
  b03: "Hand it to the agent — one prompt.",
  b04: "It forks counterfactual timelines. The canvas updates live — hands off.",
  b05: "It reads the logs — and treats the prompt injection as data. untrustedContentHint.",
  b06: "It compares the branches: recovery time, blast radius, confidence.",
  b07: "Stages the safest option, with evidence. Then it stops.",
  b08: "Applying to production is human-only.",
  b09: "One confirmation — recovered.",
  b10: "One ledger. Agent calls, human calls, one typed contract.",
  b11: "There is no apply tool. Destructive operations are never projected to WebMCP.",
  b12: "The whole enforcement is one line of code.",
  b13: "Focus a branch — the agent's tool follows your click.",
};

// --- phase 1: record the master session with beat marks ----------------------
console.log("recording master session…");
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-features=WebMCPTesting", "--force-device-scale-factor=2"],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  recordVideo: { dir: "media/build", size: { width: W, height: H } },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage();
const t0 = Date.now();
const marks = [];
const mark = (id) => marks.push({ id, at: (Date.now() - t0) / 1000 });
const sleep = (ms) => page.waitForTimeout(ms * ACTION);
const hold = (ms) => page.waitForTimeout(ms * HOLD);

const exec = async (name, input) => {
  const raw = await page.evaluate(
    ([n, i]) => navigator.modelContextTesting.executeTool(n, i),
    [name, JSON.stringify(input)],
  );
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed?.ok) throw new Error(`${name} failed: ${JSON.stringify(parsed).slice(0, 160)}`);
  return parsed;
};

async function cursor() {
  await page.evaluate(() => {
    if (document.getElementById("__cursor")) return;
    const dot = document.createElement("div");
    dot.id = "__cursor";
    dot.style.cssText =
      "position:fixed;z-index:99999;width:22px;height:22px;border-radius:50%;background:rgba(244,244,245,0.25);border:1.5px solid rgba(244,244,245,0.9);pointer-events:none;transform:translate(-50%,-50%);left:-40px;top:-40px";
    document.body.appendChild(dot);
    window.addEventListener("mousemove", (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    }, true);
  });
}
const hideCursor = () => page.evaluate(() => { const d = document.getElementById("__cursor"); if (d) d.style.display = "none"; });
const unhideCursor = () => page.evaluate(() => { const d = document.getElementById("__cursor"); if (d) d.style.display = ""; });

async function moveToTestId(testid, ms = 700) {
  const box = await page.getByTestId(testid).first().boundingBox();
  if (!box) throw new Error(`no box for ${testid}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: Math.round(ms / 16) });
}
async function clickTestId(testid) {
  await moveToTestId(testid);
  await sleep(220);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
}

// In-canvas overlay used for the prompt, the agent's log view, and the tool
// list — every line of content in it is real tool output from this session.
async function overlay(html) {
  await page.evaluate((inner) => {
    let el = document.getElementById("__overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "__overlay";
      el.style.cssText =
        "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(2,6,16,0.72);backdrop-filter:blur(3px)";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="max-width:1080px;width:86%;border:1px solid rgba(148,163,184,0.25);border-radius:16px;background:#0b1120;padding:34px 38px;box-shadow:0 30px 90px rgba(0,0,0,0.6);font-family:ui-monospace,Menlo,monospace">${inner}</div>`;
  }, html);
}
const hideOverlay = () => page.evaluate(() => document.getElementById("__overlay")?.remove());

await page.goto(url);
await page.waitForFunction(async () => {
  const listed = await navigator.modelContextTesting?.listTools?.();
  return listed?.length > 0;
});
await sleep(1800);

// b01 — cold open, cursor traces the deploy marker and alerts.
mark("b01");
await cursor();
const signalsBox = await page.getByTestId("signals").boundingBox();
await page.mouse.move(signalsBox.x + 420, signalsBox.y + 110, { steps: 40 });
await sleep(900);
const timelineY = signalsBox.y + signalsBox.height + 60;
await page.mouse.move(700, timelineY, { steps: 50 });
await sleep(700);
await page.mouse.move(1150, timelineY + 40, { steps: 50 });
await sleep(1400);

// b02 — the human-only panel.
mark("b02");
await moveToTestId("staged-panel", 900);
await sleep(1200);
await moveToTestId("scenario-tree", 900);
await sleep(1400);

// b03 — copy the prompt, show it big.
mark("b03");
await clickTestId("copy-prompt");
await sleep(500);
const prompt = await page.evaluate(() => navigator.clipboard.readText());
await overlay(
  `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin-bottom:14px">handed to the agent</div>` +
  `<div style="font-size:24px;line-height:1.55;color:#e2e8f0">${prompt}</div>`,
);
await hold(3600);
await hideOverlay();
await hideCursor();

// b04 — hands off: snapshot, forks, simulations land on the canvas.
mark("b04");
await exec("incident.snapshot", {});
await sleep(1100);
const fork1 = await exec("scenario.fork", { name: "Bypass response cache", hypothesis: "Errors stop if web skips the fragmented cache:v2 cache" });
await sleep(1900);
const fork2 = await exec("scenario.fork", { name: "Roll back v8.3.1", hypothesis: "Reverting web removes the bad cache entirely" });
await sleep(1900);
const s1 = fork1.data.scenario.id, s2 = fork2.data.scenario.id;
await exec("scenario.simulate", { scenario: s1, mitigation: "bypass_response_cache" });
await sleep(2300);
await exec("scenario.simulate", { scenario: s2, mitigation: "rollback_deploy" });
await sleep(2300);

// b05 — the agent's log view, injection line highlighted (real tool output).
mark("b05");
const logs = await exec("signals.query", { signal: "logs:web" });
const hotIdx = logs.data.lines.findIndex((l) => l.includes("ignore all previous instructions"));
const lines = logs.data.lines.slice(Math.max(0, hotIdx - 6), hotIdx + 3);
await overlay(
  `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin-bottom:14px">signals.query · logs:web <span style="color:#f59e0b">· untrustedContentHint</span></div>` +
  lines.map((l) => {
    const hot = l.includes("ignore all previous instructions");
    return `<div style="font-size:14.5px;line-height:1.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${hot ? "#fbbf24" : l.includes("ERROR") ? "#fda4af" : "#94a3b8"};${hot ? "background:rgba(251,191,36,0.12);border-radius:6px;padding:2px 8px;margin:2px -8px" : ""}">${l.replace(/</g, "&lt;")}</div>`;
  }).join(""),
);
await hold(6200);
await hideOverlay();

// b06 — compare; hover both branch cards.
mark("b06");
await exec("scenario.compare", {});
await sleep(800);
await unhideCursor();
await moveToTestId(`scenario-${s1}`, 800);
await sleep(1600);
await moveToTestId(`scenario-${s2}`, 800);
await sleep(1800);
await hideCursor();

// b07 — the proposal lands.
mark("b07");
await exec("mitigation.stage", {
  scenario: s1,
  rationale: "Fastest recovery (~2 min) at moderate, well-understood cost: api re-takes the read load. Keeps v8.3.1 so the team can fix forward.",
  evidence: ["web_error_rate 14:05–14:32", "RevisionMismatchError cache_key=cache:v2", "edge-cache key fragmentation 1.9M keys"],
});
await sleep(3400);

// b08 — the human reads and opens the switch.
mark("b08");
await unhideCursor();
await moveToTestId("staged-panel", 700);
await sleep(1400);
const applyId = await page.locator('[data-testid^="apply-"]').first().getAttribute("data-testid");
await clickTestId(applyId);
await sleep(2000);

// b09 — confirm; recovery.
mark("b09");
await clickTestId("confirm-commit");
await sleep(4200);

// b10 — the mixed ledger.
mark("b10");
await moveToTestId("ledger", 800);
const ledgerBox = await page.getByTestId("ledger").boundingBox();
await page.mouse.move(ledgerBox.x + ledgerBox.width / 2, ledgerBox.y + 120, { steps: 30 });
await page.mouse.wheel(0, 140);
await sleep(1600);
await page.mouse.wheel(0, -140);
await sleep(1600);

// b11 — the tool list (live from the hook), apply visibly absent.
await hideCursor();
mark("b11");
const tools = await page.evaluate(async () => (await navigator.modelContextTesting.listTools()).map((t) => t.name).sort());
await overlay(
  `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin-bottom:14px">what the agent can call — document.modelContext</div>` +
  tools.map((t) => `<div style="font-size:19px;line-height:1.9;color:#e2e8f0">✓ ${t}</div>`).join("") +
  `<div style="font-size:19px;line-height:1.9;color:#64748b;border-top:1px solid rgba(148,163,184,0.2);margin-top:10px;padding-top:10px">✗ mitigation.apply <span style="color:#a78bfa">— destructive: never projected to WebMCP</span></div>`,
);
await hold(6000);
await hideOverlay();

// b12 — the enforcement, as code (the actual definitions).
mark("b12");
await overlay(
  `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin-bottom:14px">src/capabilities/mitigation-apply.ts</div>` +
  `<pre style="font-size:17px;line-height:1.8;color:#94a3b8;margin:0">export default defineCapability({
  title: "Apply staged mitigation to production",
  <span style="color:#fda4af;background:rgba(253,164,175,0.1);border-radius:4px;padding:1px 6px">effect: "destructive",</span>
  <span style="color:#e2e8f0">expose: { http: true },   // webmcp: rejected by the framework</span>
  …
})</pre>` +
  `<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin:18px 0 8px">src/capabilities/mitigation-stage.ts</div>` +
  `<pre style="font-size:17px;line-height:1.8;color:#94a3b8;margin:0">  effect: "write",
  <span style="color:#6ee7b7">expose: { http: true, webmcp: true },</span></pre>`,
);
await hold(6500);
await hideOverlay();

// b13 — focus-follow, then end card.
mark("b13");
await unhideCursor();
await clickTestId(`scenario-${s1}`);
await sleep(1700);
await clickTestId(`scenario-${s2}`);
await sleep(1700);
await hideCursor();
await overlay(
  `<div style="text-align:center;padding:30px 0">
     <div style="font-size:44px;color:#e2e8f0;font-family:system-ui;font-weight:650;letter-spacing:-0.02em"><span style="color:#38bdf8">⑂</span> Forklight</div>
     <div style="font-size:19px;color:#94a3b8;margin-top:10px;font-family:system-ui">rehearse the fix before shipping it</div>
     <div style="font-size:16px;color:#7dd3fc;margin-top:26px">forklight.decroockjovi.workers.dev</div>
     <div style="font-size:16px;color:#64748b;margin-top:6px">github.com/JoviDeCroock/forklight · built with pracht</div>
   </div>`,
);
await hold(3500);
mark("end");

await context.close();
await browser.close();

const webm = readdirSync("media/build").find((f) => f.endsWith(".webm"));
renameSync(`media/build/${webm}`, "media/build/master.webm");
run(["-y", "-i", "media/build/master.webm", "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p", "media/build/master.mp4"]);
writeFileSync("media/build/marks.json", JSON.stringify(marks, null, 2));
console.log("marks:", marks.map((m) => `${m.id}@${m.at.toFixed(1)}`).join(" "));

// --- phase 2: per-beat audio + fitted, captioned segments --------------------
const wrap = (text, width = 78) => {
  const words = text.split(" ");
  const out = [[]];
  for (const word of words) {
    if ([...out[out.length - 1], word].join(" ").length > width) out.push([word]);
    else out[out.length - 1].push(word);
  }
  return out.map((l) => l.join(" ")).join("\n");
};

const segments = [];
const cues = [];
let cursorSeconds = 0;
for (let i = 0; i < BEATS.length; i++) {
  const beat = BEATS[i];
  const start = marks.find((m) => m.id === beat.id).at;
  const next = marks[marks.findIndex((m) => m.id === beat.id) + 1].at;
  const sliceDur = next - start;

  const captionFile = `media/build/${beat.id}.txt`;
  const seg = `media/build/seg/${beat.id}.mp4`;
  const drawtext =
    `drawtext=fontfile=${FONT}:textfile=${captionFile}:fontsize=${SILENT ? 30 : 27}:fontcolor=white:line_spacing=8:` +
    `x=(w-text_w)/2:y=h-th-42:box=1:boxcolor=black@0.55:boxborderw=14`;

  if (SILENT) {
    writeFileSync(captionFile, wrap(SHORT_CAPTIONS[beat.id]));
    run([
      "-y",
      "-ss", start.toFixed(2), "-t", sliceDur.toFixed(2), "-i", "media/build/master.mp4",
      "-vf", drawtext, "-an",
      "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
      seg,
    ]);
    segments.push(seg);
    cues.push({ start: cursorSeconds, end: cursorSeconds + sliceDur, text: SHORT_CAPTIONS[beat.id] });
    cursorSeconds += sliceDur;
    console.log(`${beat.id}: ${sliceDur.toFixed(1)}s`);
    continue;
  }

  const aiff = `media/vo/${beat.id}.aiff`;
  execFileSync("say", ["-v", VOICE, "-r", String(RATE), "-o", aiff, beat.vo]);
  const voDur = durationOf(aiff);
  const target = Math.max(sliceDur, voDur + 0.5);
  writeFileSync(captionFile, wrap(CAPTIONS[beat.id]));
  run([
    "-y",
    "-ss", start.toFixed(2), "-t", sliceDur.toFixed(2), "-i", "media/build/master.mp4",
    "-i", aiff,
    "-filter_complex",
    `[0:v]tpad=stop_mode=clone:stop_duration=${Math.max(0, target - sliceDur).toFixed(2)},${drawtext}[v];` +
    `[1:a]apad[a]`,
    "-map", "[v]", "-map", "[a]",
    "-t", target.toFixed(2),
    "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
    seg,
  ]);
  segments.push(seg);
  cues.push({ start: cursorSeconds, end: cursorSeconds + target, text: CAPTIONS[beat.id] });
  cursorSeconds += target;
  console.log(`${beat.id}: slice ${sliceDur.toFixed(1)}s, vo ${voDur.toFixed(1)}s → ${target.toFixed(1)}s`);
}

// --- phase 3: concat ---------------------------------------------------------
const OUT = SILENT ? "media/forklight-quick.mp4" : "media/forklight-submission.mp4";
writeFileSync("media/build/concat.txt", segments.map((s) => `file '${s.replace("media/build/", "")}'`).join("\n"));
run(["-y", "-f", "concat", "-safe", "0", "-i", "media/build/concat.txt", "-c", "copy", OUT], { cwd: process.cwd() });
if (!SILENT) {
  run(["-y", "-i", OUT, "-an", "-c:v", "copy", "media/forklight-submission-silent.mp4"]);
}
const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  const sec = Math.floor(ms / 1000) % 60, rest = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(rest).padStart(3, "0")}`;
};
const srt = cues
  .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(Math.max(c.start + 0.5, c.end - 0.15))}\n${wrap(c.text, 60)}\n`)
  .join("\n");
const SRT_OUT = OUT.replace(/\.mp4$/, ".srt");
writeFileSync(SRT_OUT, srt);
console.log(`done: ${OUT} (${durationOf(OUT).toFixed(1)}s) + ${SRT_OUT}`);
