# Forklight — promo copy

Placeholders to fill before posting: `[VIDEO]` YouTube link · `[REPO]` https://github.com/JoviDeCroock/forklight · `[LIVE]` deployed URL.

---

## X / Twitter thread

**1/5** — hook, attach the 25s "missing tool" clip

```
Forklight, my WebMCP challenge entry: an incident canvas an agent drives.

It reads the signals, forks counterfactual timelines, compares mitigations, stages the safest.

Then it stops. The apply tool doesn't exist over WebMCP — the framework won't project it.

[VIDEO]
```

**2/5** — the prompt

```
The entire demo is one prompt, pasted into the browser side panel:

"Errors spiked after the 14:05 deploy. Compare rolling back against bypassing the new cache, show me the evidence, and stage the lowest-risk mitigation. Do not apply anything."
```

**3/5** — why the tool is missing

```
mitigation.apply is declared effect: "destructive".

pracht refuses to project destructive capabilities as WebMCP page tools — the build fails if you try. A browser host's approval dialog isn't a security boundary.

Six tools reach the agent. The switch isn't one.
```

**4/5** — the live canvas + focus-follow

```
Both directions work.

Agent calls a tool → the route revalidates → charts, branches and ledger update with my hands off the page.

I focus a branch → a scenario_tune tool binds to it. My click picks the target, the agent picks the action.

No sockets. No polling.
```

**5/5** — the framework, the links

```
One typed capability per operation — schema in, schema out, declared effect. pracht projects it to the UI, HTTP and WebMCP page tools. No agent-specific code path in the app.

Cloudflare Workers + D1. MIT.

Live: https://forklight.decroockjovi.workers.dev
Code: [REPO]
Framework: pracht.resynapse.dev
```

---

## Standalone launch tweet

```
Forklight ⑂ — an incident canvas where an agent investigates, forks timelines, compares mitigations and stages the safest one, and the apply tool literally doesn't exist over WebMCP.

Agent prepares. Human commits. Enforced by the framework, not a prompt.

[VIDEO]
```

---

## LinkedIn

```
Every discussion about agents in production stalls in the same place: nobody minds an agent reading dashboards, everybody minds an agent restarting the database. The usual answer is "don't deploy anything" in a system prompt — a wish, not a boundary.

So I built Forklight for OpenAI's WebMCP Challenge, a shared incident-response canvas. An agent in the same browser tab investigates a live production outage, forks counterfactual timelines, compares mitigations on recovery time and blast radius, and stages the safest with its evidence. Then it stops.

Applying to production is a button a person clicks. Not because of a prompt — the operation is classified destructive, and the framework refuses to expose destructive capabilities to browser agents. The build fails if you try.

Demo, video and MIT source: [REPO]
```

---

## Clip moments

Three 15–30s cuts from the main video, each usable standalone with captions burned in (most people watch muted).

1. **"Watch the canvas fork itself"** — 0:26–0:55. Prompt already sent, hands off the keyboard. Branch cards appear, dashed forecasts fan across the charts, ledger fills with agent rows. Caption: *nobody is touching this page*. Best clip for the thread's post 4.
2. **"The missing tool"** — 1:57–2:14. The host's tool list, then the cut to `effect: "destructive"` in the editor. Caption: *six tools. no apply.* Strongest standalone; use it on post 1 and the launch tweet.
3. **"Focus-follow"** — 2:14–2:20, extended with the b-roll capture to about 15s. Click a branch, the `scenario_tune` chip retargets, click another, it retargets again. Caption: *my click picks the target, the agent picks the action*. Niche but the WebMCP crowd will get it immediately.

## Alt text for attached media

**Video (forklight-quick.mp4 / forklight-submission.mp4):**

> Screen recording of Forklight, a dark incident-response dashboard showing a production outage: an error-rate chart spiking after a 14:05 deploy. A cursor copies a demo prompt, then an AI agent takes over hands-free: two counterfactual scenario cards appear ("Bypass response cache", "Roll back v8.3.1"), dashed forecast lines land on every chart, a log view highlights a prompt-injection attempt in a user-agent string, and a proposal card is staged with rationale and evidence. A human clicks "Apply to production", confirms in a dialog, and the charts recover; the status chip turns green. An activity ledger lists every call, labelled agent or you. A final panel lists the agent's six tools, with "mitigation.apply — destructive: never projected to WebMCP" shown as absent.

**Still (still-mid.png):**

> Dark ops dashboard mid-incident: a large error-rate chart at 18.3% with two dashed recovery forecasts, an observed-record timeline with deploy and alert markers, two scenario cards comparing recovery time, confidence and blast radius, an amber "staged for review" proposal with evidence chips and a green "Apply to production" button, and an activity ledger of agent tool calls.

**Still (still-recovered.png):**

> The same dashboard after the fix: status chip reads "recovered", error rate at 0.2% with the spike collapsed, the clock advanced to 14:42, a green applied-mitigation card, and a ledger topped by a human "mitigation.apply — APPLIED" entry above the agent's earlier calls.
