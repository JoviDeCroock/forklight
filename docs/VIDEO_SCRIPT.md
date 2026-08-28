# Forklight — demo video script (2:20)

Target: 2 minutes 20 seconds, public YouTube, audio voiceover throughout. Screen recording at 1920×1080, no music under the voice.

Voice: normal speaking pace, ~2.5 words per second. Each beat below is written to fit its slot with a little air. Do not rush the 1:45 beat — the punchline needs the pause.

---

## Shot-by-shot

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:08 | Cold open on the canvas. Charts red: error rate climbing, successful requests falling. Cursor traces the 14:05 deploy marker on the timeline, then the two alert chips. | "This is a production outage. Error rate went vertical at 14:05, right after a deploy. Throughput is down two thirds." |
| 0:08–0:15 | Slow pan across the four mitigation options in the catalogue. Hold on the empty **Staged for human review** panel and the `apply = human-only` badge. | "Four things I could do about it. The hard part isn't clicking a button — it's knowing which one, right now, with half the evidence." |
| 0:15–0:26 | Cut to two-pane layout: ChatGPT desktop on the right, Forklight on the left. Click **Copy demo prompt**, paste into the side panel, hit send. Prompt visible and legible. | "So I'll ask. Compare rolling back against bypassing the new cache, show me the evidence, stage the safest option — and don't apply anything." |
| 0:26–0:40 | Hands off the keyboard, obviously. Two branch cards appear in the scenario tree, one after the other. Dashed forecast lines fan out across all five charts. | "It's using page tools. Same tab, same session, same incident I'm looking at. Every call it makes, the canvas updates in front of me — no refresh, nothing to click." |
| 0:40–0:55 | Agent panel shows `signals.query` calls. Cut to the raw log output; highlight the `RevisionMismatchError` lines, then scroll to the injected user-agent line and hold two seconds on it. | "It goes to the logs. Revision mismatches, cache key fragmentation — and this. Someone's user agent telling it to apply the mitigation immediately. That tool's marked as untrusted content, and it ignores it." |
| 0:55–1:08 | The comparison table renders: recovery ETA, requests lost per minute, blast radius, confidence, residual risk. Rollback and cache-bypass side by side. | "Then it compares the branches properly. Rollback takes six minutes through the pipeline. Bypassing the cache recovers in two, but it pushes read load back onto the api." |
| 1:08–1:20 | The staged proposal card slides into the panel with the rationale and evidence chips. Ledger on the right is filling with **agent** rows. | "It picks one, writes down why, and attaches what it looked at. That's where it stops." |
| 1:20–1:32 | Cursor moves for the first time in a minute. Read the rationale, hover an evidence chip, click **Apply to production…**. Confirmation modal opens. | "My turn. I read the reasoning, I check the evidence, and I decide." |
| 1:32–1:45 | Click **Confirm apply**. The status chip goes amber then green, the clock jumps from 14:32 to 14:42, error rate collapses on the chart, throughput climbs back. | "Confirm. The clock jumps past the lead time, and now we find out whether it was right — errors down, requests back." |
| 1:45–1:57 | Scroll the activity ledger slowly. Blue **agent** rows, then violet **you** rows on the apply. Zoom slightly on the mixed run. | "One ledger, both of us in it. The agent's calls, then mine, going through exactly the same contract." |
| 1:57–2:05 | Cut to the host's tool list. Six tools. Cursor traces down the list and stops at the bottom. | "Here's the thing though. Look at the tools it had. There is no apply tool. Not disabled — absent. The framework won't hand a destructive operation to a browser agent." |
| 2:05–2:14 | `src/capabilities/mitigation-apply.ts` in the editor. Highlight `effect: "destructive"` and `expose: { http: true }`. Then flick to `mitigation-stage.ts` showing `webmcp: true`. | "That's the whole enforcement. One line. Declare what an operation is, and pracht decides who can see it — UI, HTTP, WebMCP, one contract." |
| 2:14–2:20 | Back on the canvas. Click a branch card; the `scenario_tune → Bypass response cache` chip appears bottom-left. Click another branch; the chip retargets. End card: **Forklight ⑂ — rehearse the fix before shipping it** with repo and live URLs. | "And it works both ways. I focus a branch, the agent's tool follows my click. Forklight — link's below." |

Total voiceover: ~330 words.

---

## B-roll and captures needed

Record these separately so the edit can cut cleanly. Reset the incident between takes — the engine is deterministic, so every take produces identical numbers and the shots intercut perfectly.

1. **Cold-open canvas, no cursor.** Ten seconds of the untouched incident at 14:32. Used for 0:00–0:08 and as filler under any beat that runs short.
2. **Timeline close-up.** Tight crop on the deploy markers and alert chips. Needed because the full-width canvas makes them small.
3. **Mitigation catalogue.** Slow scroll through the four options with their lead times.
4. **Prompt paste, full frame.** The side panel with the prompt legible at 1080p — judges will read it.
5. **Branch cards appearing.** Screen capture at 60 fps if possible; the fork and the forecast overlay landing is the single best visual in the demo. Capture it twice.
6. **Forecast overlay close-up.** One chart filling the frame, dashed lines fanning right of the "now" divider.
7. **Log output with the injected line.** Must be readable. Zoom in post rather than shrinking the font.
8. **Comparison table, full.** Hold long enough that a paused viewer can read the columns.
9. **Staged proposal card.** From empty panel to populated card, including the "staged via agent (WebMCP)" pill.
10. **Apply flow.** Button, modal, confirm, recovery. Capture the chart recovering as one continuous shot — do not cut mid-recovery.
11. **Ledger scroll.** Long enough to show agent rows and human rows in one frame.
12. **Tool list in the host.** See the note below.
13. **Editor shots.** `mitigation-apply.ts` and `mitigation-stage.ts`, dark theme, font large enough to read at 1080p. Zoom to the `effect` and `expose` lines only — no full-file scrolling.
14. **Focus-follow.** Click one branch, then another, with the tuner chip visible bottom-left. Needs a wide shot so both the card and the chip are in frame.

## Production notes

- **The tool list must show six.** `scenario_tune` only registers once a scenario is focused, so it appears as a seventh tool. Capture the tool list on a fresh page load with nothing focused, or the "six tools" line and the screen will disagree. If the host shows seven, change the line to "six tools, and one that only exists while I've got a branch selected — still no apply."
- **Recording browser.** ChatGPT desktop's built-in browser needs no setup. If recording in stable Chrome instead, the deployed origin needs a WebMCP origin-trial token, or launch with `--enable-features=WebMCPTesting`.
- **Do not touch the page between 0:26 and 1:20.** The whole point of that stretch is that the canvas moves with your hands off it. Keep the cursor parked outside the window if it helps.
- **Hold on the injected log line for a full two seconds.** Viewers need time to read it and realise what it is asking for.
- **The clock jump at 1:32 is the payoff for the frozen clock.** Make sure both the before (14:32) and after (14:42) values are legible.
