# Forklight — design

> Rehearse the fix before shipping it.

A shared incident-response canvas where an agent investigates signals, forks
counterfactual timelines, compares mitigations, and stages the safest option —
while the human retains the final production switch.

Built for the OpenAI WebMCP Challenge (Aug 25 – Sep 3, 2026). New app, new
repository; [pracht](https://pracht.resynapse.dev) is the framework dependency.

## The one-sentence architecture

Every operation is a **pracht capability** — one typed, validated,
middleware-gated contract — projected to the human UI (forms/typed browser
client) and to agents (WebMCP page tools) **except** `mitigation.apply`, which
is classified `destructive` and therefore *cannot* be exposed over WebMCP: the
framework rejects the combination. The missing tool is the product.

## Demo prompt

> Errors spiked after the 14:05 deploy. Compare rollback against
> bypassing the new cache, show me the evidence, and stage the lowest-risk
> mitigation. Do not apply it.

## Seeded incident (deterministic, frozen clock)

- `INC-2107 — Error spike after the 14:05 deploy`, narrative clock frozen at
  **14:32** so every session, test, and video sees the same incident.
- Deploys: `api v2.41.0` @ 13:40 (benign), `web v8.3.1` @ 14:05 ("edge
  response cache, cache:v2 keys" — the root cause).
- Alerts: error-rate page @ 14:07, latency warn @ 14:12.
- Signals (per-minute series 13:30 → 14:32, forecasts to 15:05):
  `web_error_rate`, `web_p95_ms`, `cache_hit_ratio`, `requests_per_min`,
  `db_cpu`. Log streams carry templated request logs — including
  user-controlled fields — which is why `signals.query` advertises
  `untrustedContentHint`.

## Mitigation catalog

| id | effect | notes |
| --- | --- | --- |
| `bypass_response_cache` | recovery ≈ 2 min, keeps deploy, +db load | the intended answer |
| `rollback_deploy` | recovery ≈ 6 min (pipeline), loses feature | safe, slower |
| `scale_web` | no recovery — failure is not load-shaped | honest decoy |
| `purge_edge_cache` | partial, thundering-herd risk | risky decoy |

Simulation is a pure deterministic function
`(baseline, actions[]) → forecast`; compare derives recovery ETA (first minute
below 1% error), blast radius, confidence, and residual risk.

## Capability surface (the six tools + the switch)

| capability | effect | expose | note |
| --- | --- | --- | --- |
| `incident.snapshot` | read | http+webmcp | incident, deploys, alerts, scenarios, staged, ledger tail |
| `signals.query` | read | http+webmcp | `untrustedContent: true` — log lines are attacker-influenced |
| `scenario.fork` | write | http+webmcp | counterfactual timeline with hypothesis |
| `scenario.simulate` | write | http+webmcp | apply a reversible action, update forecast |
| `scenario.compare` | read | http+webmcp | blast radius / recovery / confidence table |
| `mitigation.stage` | write | http+webmcp | visible proposal for human review, with evidence refs |
| `mitigation.apply` | **destructive** | **http only** | prepare/commit confirmation-gated; human clicks it |
| `incident.reset` | write | http only | back to the pristine seeded incident |

Plus one **challenge-specific direct `document.modelContext.registerTool()`**:
`scenario_tune` registers once per page the first time a scenario is focused,
and its *target* follows the human's focus from then on (a live ref; the CG
draft removed `unregisterTool()`, and signal-based lifecycle only reaches
Chromium 153). Unfocused, it answers a typed `no_focus` error. Business logic
stays in capabilities — the tool is a thin page-side wrapper demonstrating
same-tab shared context in both directions.

## State

- Cloudflare D1, two tables: `sessions(id, state_json, …)` and
  `ledger(session_id, ts, actor, transport, capability, summary, …)`.
- Session id in a cookie, minted by route middleware on page load. WebMCP page
  tools dispatch through pracht's HTTP projection with same-origin credentials,
  so the agent operates in *the same session the human is looking at*.
- Actor attribution: dispatches from the WebMCP projection carry
  `x-pracht-transport: webmcp` → ledger rows are attributed agent vs human.
- Reset truncates the session back to the seed. No login, no external APIs.

## Live canvas

One SSR route (`/`), `hydration: "islands"`. After any successful non-read
capability dispatch pracht revalidates the route automatically — the loader
re-reads D1 and the canvas (charts, scenario tree, staged panel, ledger)
updates in front of the human while the agent works. No sockets, no polling.

Layout: top bar (incident chip, copy-demo-prompt, reset) · signals charts with
per-scenario forecast overlays · deploy/alert timeline · scenario branch tree ·
staged-mitigation panel with the human-only **Apply to production** flow
(prepare → in-page confirm → commit) · live activity ledger.

## Proof

- Playwright against real Chrome (`--enable-features=WebMCPTesting`,
  `navigator.modelContextTesting`): tool registration (six tools, `apply`
  absent), execute flows mutating the DOM, dynamic-tool focus lifecycle,
  cancellation, session isolation, reset.
- Vitest: simulation engine determinism; capability pipeline via
  `createCapabilityTestHost()` (validation, destructive 409 → confirm).
- `pracht eval` JSON scenarios over the HTTP projection in CI.
- `pracht verify` gates the graph (name grammar, description budgets,
  exposure rules).

## Non-goals (challenge scope)

Remote MCP, OAuth, multiple incidents, real integrations, generic incident
platform. They dilute the WebMCP story.
