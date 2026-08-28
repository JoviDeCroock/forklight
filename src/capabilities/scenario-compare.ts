import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { assessScenario, type ScenarioAssessment } from "../server/incident.ts";
import { openSession } from "../server/session-io.ts";

interface CompareInput {
  scenarios: string[];
}

const BLAST_ORDER = { low: 0, moderate: 1, high: 2 } as const;

function rank(a: ScenarioAssessment, b: ScenarioAssessment): number {
  const aRecovers = a.recoveryEtaMinutes !== null ? 0 : 1;
  const bRecovers = b.recoveryEtaMinutes !== null ? 0 : 1;
  if (aRecovers !== bRecovers) return aRecovers - bRecovers;
  if (a.confidence !== b.confidence) return b.confidence - a.confidence;
  const aBlast = a.blastRadius ? BLAST_ORDER[a.blastRadius.level] : 3;
  const bBlast = b.blastRadius ? BLAST_ORDER[b.blastRadius.level] : 3;
  if (aBlast !== bBlast) return aBlast - bBlast;
  return (a.recoveryEtaMinutes ?? 99) - (b.recoveryEtaMinutes ?? 99);
}

export default defineCapability({
  title: "Compare scenarios",
  description:
    "Side-by-side assessment of forked scenarios: projected recovery time, orders lost per minute, blast radius, confidence, and residual risk — plus an honest recommendation with its reasoning.",
  input: {
    type: "object",
    properties: {
      scenarios: {
        type: "array",
        items: { type: "string", maxLength: 32 },
        description: "Scenario ids to compare. Omit to compare every fork.",
      },
    },
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      result: { type: "string", enum: ["ok", "nothing_to_compare"] },
      comparisons: { type: "array", items: { type: "object" } },
      recommendation: { type: "object" },
    },
    required: ["result"],
  },
  effect: "read",
  middleware: ["session"],
  expose: { http: true, webmcp: true },
  async run({ input, request, context }: CapabilityRunArgs<CompareInput>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const wanted = input.scenarios?.length
      ? state.scenarios.filter((s) => input.scenarios.includes(s.id) && s.id !== "main")
      : state.scenarios.filter((s) => s.id !== "main");
    const withActions = wanted.filter((s) => s.actions.length > 0);
    if (withActions.length === 0) {
      await io.log("scenario.compare", "Nothing to compare yet", startedAt, "error");
      return { result: "nothing_to_compare" };
    }
    const comparisons = withActions.map((s) => assessScenario(state, s)).sort(rank);
    const best = comparisons[0];
    const reason =
      best.recoveryEtaMinutes === null
        ? "No compared scenario reaches recovery inside the forecast window."
        : `Recovers by ${best.recoveryAtClock} (${best.recoveryEtaMinutes} min) with ${Math.round(best.confidence * 100)}% confidence and ${best.blastRadius?.level ?? "unknown"} blast radius${
            comparisons.length > 1 ? `; ranked above ${comparisons.length - 1} alternative${comparisons.length > 2 ? "s" : ""} on confidence, blast radius, then speed` : ""
          }.`;
    await io.log(
      "scenario.compare",
      `Compared ${withActions.length} scenario${withActions.length > 1 ? "s" : ""} — best: ${best.name}`,
      startedAt,
    );
    return {
      result: "ok",
      comparisons,
      recommendation: { scenarioId: best.scenarioId, name: best.name, reason },
    };
  },
});
