import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import {
  ALERTS,
  DEPLOYS,
  METRICS,
  MITIGATIONS,
  assessScenario,
  metricAt,
  minuteToClock,
  type MetricId,
} from "../server/incident.ts";
import { openSession } from "../server/session-io.ts";
import { readLedger } from "../server/store.ts";

export default defineCapability({
  title: "Incident snapshot",
  description:
    "Current view of the live incident: status, deploys, alerts, latest metric values, existing scenario forks with their forecasts, staged mitigations, and recent activity. Call this first to orient.",
  input: { type: "object", properties: {}, additionalProperties: false },
  output: {
    type: "object",
    properties: {
      incident: { type: "object" },
      clock: { type: "string" },
      deploys: { type: "array", items: { type: "object" } },
      alerts: { type: "array", items: { type: "object" } },
      metrics: { type: "array", items: { type: "object" } },
      scenarios: { type: "array", items: { type: "object" } },
      staged: { type: "array", items: { type: "object" } },
      ledger: { type: "array", items: { type: "object" } },
      mitigations: { type: "array", items: { type: "object" } },
      usage: { type: "string" },
    },
    required: ["incident", "clock", "scenarios", "usage"],
  },
  effect: "read",
  middleware: ["session"],
  expose: { http: true, webmcp: true },
  async run({ request, context }: CapabilityRunArgs<Record<never, never>>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const applied = state.incident.applied;
    const appliedActions = applied ? [{ mitigation: applied.mitigation, atMinute: applied.atMinute }] : [];
    const snapshot = {
      incident: {
        ...state.incident,
        startedAtClock: minuteToClock(35),
      },
      clock: minuteToClock(state.clockMinute),
      deploys: DEPLOYS.map((d) => ({ ...d, atClock: minuteToClock(d.minute) })),
      alerts: ALERTS.map((a) => ({ ...a, atClock: minuteToClock(a.minute) })),
      metrics: (Object.keys(METRICS) as MetricId[]).map((id) => ({
        id,
        label: METRICS[id].label,
        unit: METRICS[id].unit,
        preIncident: METRICS[id].pre,
        now: metricAt(id, state.clockMinute, appliedActions),
      })),
      scenarios: state.scenarios.map((s) => ({
        ...s,
        assessment: s.id === "main" ? null : assessScenario(state, s),
      })),
      staged: state.staged.filter((s) => s.status !== "dismissed"),
      ledger: await readLedger(io.db, io.sessionId, 15),
      mitigations: Object.values(MITIGATIONS).map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        leadTimeMinutes: m.leadTimeMinutes,
      })),
      usage:
        "Investigate with signals.query, then scenario.fork → scenario.simulate → scenario.compare → mitigation.stage. Applying a mitigation to production is deliberately not available to agents: the human approves staged proposals in the page.",
    };
    await io.log("incident.snapshot", "Read incident snapshot", startedAt);
    return snapshot;
  },
});
