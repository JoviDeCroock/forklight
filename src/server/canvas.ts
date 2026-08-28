// View model for the incident canvas route. Pure projection of session state —
// no ledger writes, so loader revalidation never pollutes the activity feed.
import {
  ALERTS,
  DEPLOYS,
  HORIZON,
  METRICS,
  MITIGATIONS,
  WINDOW_START,
  assessScenario,
  metricAt,
  minuteToClock,
  series,
  type MetricId,
  type ScenarioAssessment,
  type SessionState,
  type SeriesPoint,
} from "./incident.ts";
import { readLedger, type LedgerEntry } from "./store.ts";

export interface ChartData {
  id: MetricId;
  label: string;
  unit: string;
  preIncident: number;
  now: number;
  observed: SeriesPoint[];
  forecasts: { scenarioId: string; name: string; points: SeriesPoint[] }[];
}

export interface CanvasData {
  incident: SessionState["incident"] & { startedAtClock: string };
  clock: string;
  clockMinute: number;
  deploys: { id: string; service: string; version: string; minute: number; atClock: string; summary: string }[];
  alerts: { id: string; severity: string; minute: number; atClock: string; summary: string }[];
  charts: ChartData[];
  scenarios: {
    id: string;
    name: string;
    parent: string | null;
    hypothesis: string | null;
    actions: { mitigation: string; title: string; atClock: string }[];
    assessment: ScenarioAssessment | null;
  }[];
  staged: SessionState["staged"];
  ledger: LedgerEntry[];
  mitigations: { id: string; title: string; description: string; leadTimeMinutes: number }[];
}

export async function buildCanvasData(
  db: D1Database,
  sessionId: string,
  state: SessionState,
): Promise<CanvasData> {
  const applied = state.incident.applied;
  const baseActions = applied ? [{ mitigation: applied.mitigation, atMinute: applied.atMinute }] : [];
  const from = Math.max(WINDOW_START, state.clockMinute - 45);
  const forecastTo = Math.min(HORIZON, state.clockMinute + 25);

  const charts: ChartData[] = (Object.keys(METRICS) as MetricId[]).map((id) => ({
    id,
    label: METRICS[id].label,
    unit: METRICS[id].unit,
    preIncident: METRICS[id].pre,
    now: metricAt(id, state.clockMinute, baseActions),
    observed: series(id, baseActions, from, state.clockMinute),
    forecasts: state.scenarios
      .filter((s) => s.id !== "main" && s.actions.length > 0)
      .map((s) => ({
        scenarioId: s.id,
        name: s.name,
        points: series(id, [...baseActions, ...s.actions], state.clockMinute, forecastTo),
      })),
  }));

  return {
    incident: { ...state.incident, startedAtClock: minuteToClock(35) },
    clock: minuteToClock(state.clockMinute),
    clockMinute: state.clockMinute,
    deploys: DEPLOYS.map((d) => ({ ...d, atClock: minuteToClock(d.minute) })),
    alerts: ALERTS.map((a) => ({ ...a, atClock: minuteToClock(a.minute) })),
    charts,
    scenarios: state.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      parent: s.parent,
      hypothesis: s.hypothesis,
      actions: s.actions.map((a) => ({
        mitigation: a.mitigation,
        title: MITIGATIONS[a.mitigation].title,
        atClock: minuteToClock(a.atMinute),
      })),
      assessment: s.id === "main" ? null : assessScenario(state, s),
    })),
    staged: state.staged.filter((s) => s.status !== "dismissed"),
    ledger: await readLedger(db, sessionId, 40),
    mitigations: Object.values(MITIGATIONS).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      leadTimeMinutes: m.leadTimeMinutes,
    })),
  };
}
