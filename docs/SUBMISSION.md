# Forklight — Devpost submission text

**Tagline:** Rehearse the fix before shipping it. An incident canvas where the agent investigates, forks and stages — and the apply tool does not exist.

**Live:** `https://forklight.decroockjovi.workers.dev` *(TODO: replace with the deployed URL)*
**Repo:** https://github.com/JoviDeCroock/forklight (MIT)
**Video:** *(TODO: YouTube link)*

---

## Inspiration

Every conversation about agents in production ends at the same wall. Nobody minds an agent reading dashboards. Everybody minds an agent restarting the database. The usual answer is "do not deploy anything" in a system prompt, which is not a boundary — it is a wish.

Incident response is the sharpest version of it. During an outage the expensive part is not clicking the button — it is working out *which* button, on partial evidence, while requests fail. That is what an agent is good at, and what humans do worst at 3 a.m.

## What it does

Forklight opens on a live outage: error rate climbing since the 14:05 deploy, throughput down, two alerts firing. An agent in the same tab picks up six page tools.

It reads the metric series and the raw logs. It forks the observed timeline into counterfactual branches — roll back the deploy, bypass the new response cache — and simulates a mitigation inside each. Dashed forecasts appear on every chart, one per branch. It compares them on recovery time, blast radius, confidence and residual risk, then stages the option it can defend, with its rationale and evidence.

Then it stops. There is no apply tool.

Applying is a button in the page. You click, confirm, and the mitigation lands: the clock jumps past its lead time and the charts show whether the agent was right. Every call from either side lands in one ledger, tagged **agent** or **you**.

Two of the four mitigations are decoys. Scaling out does nothing — the failure is a revision-consistency check, not saturation. The agent has to be right, not just decisive.

## How we built it

Forklight is built on [pracht](https://pracht.resynapse.dev), an open-source Preact metaframework, using its capability layer. Every operation is one typed definition — schema in, schema out, declared effect — projected to the human UI, an HTTP endpoint, and a WebMCP page tool. The app has no agent-specific code path.

That is what makes the missing tool real. `mitigation.apply` is declared `effect: "destructive"`, and pracht refuses to project destructive capabilities to WebMCP: the build fails if you try, because a browser host's approval dialog is not a security boundary. Human applies still run a server-verified prepare/commit gate — a 409 with a signed token bound to that input, then a byte-identical confirmed call.

Tools dispatch through the same-origin session cookie, so the agent mutates the incident the human is watching, and pracht revalidates the route after every non-read call: the canvas updates live, no sockets, no polling. Going the other way, focusing a branch registers a `scenario_tune` tool bound to it — the human's click picks the target, the agent picks the action. `signals.query` carries `untrustedContentHint`, because the seeded logs contain user-controlled text, including a line asking the agent to apply the mitigation immediately. It cannot.

The incident engine is pure — no clock, no randomness — so every visitor sees the identical outage. State is per-session in Cloudflare D1, on Workers.

## What makes it different

Most agent demos widen what an agent can touch, then bolt guardrails on top. Forklight puts the design work in the shape of the surface: declaring what an operation *is* decides what an agent can see, and the framework enforces it — so the property survives the next refactor and the next clever prompt. The agent does the thinking that is slow under pressure. The human takes responsibility for production.

## What's next

Real telemetry behind the same capability contract, so the tool surface stays identical while the data goes live. Multi-participant canvases, where two responders and an agent fork one incident at once, and a staged proposal can page a second engineer rather than wait for whoever is at the keyboard.
