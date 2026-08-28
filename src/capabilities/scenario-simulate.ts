import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { MITIGATIONS, assessScenario, type MitigationId } from "../server/incident.ts";
import { openSession } from "../server/session-io.ts";

interface SimulateInput {
  scenario: string;
  mitigation: MitigationId;
  delayMinutes: number;
}

export default defineCapability({
  title: "Simulate a mitigation",
  description:
    "Apply a reversible action inside a forked scenario and recompute its forecast. Nothing touches production — this updates the counterfactual timeline and the visual forecast the human is looking at.",
  input: {
    type: "object",
    properties: {
      scenario: { type: "string", maxLength: 32, description: "Forked scenario id (not main)." },
      mitigation: {
        type: "string",
        enum: ["bypass_price_cache", "rollback_deploy", "scale_checkout", "purge_edge_cache"],
        description: "Mitigation from the catalog in incident.snapshot.",
      },
      delayMinutes: {
        type: "integer",
        minimum: 0,
        maximum: 30,
        default: 0,
        description: "Start the action this many minutes after now.",
      },
    },
    required: ["scenario", "mitigation"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      result: {
        type: "string",
        enum: ["ok", "unknown_scenario", "cannot_modify_main", "already_simulated"],
      },
      assessment: { type: "object" },
    },
    required: ["result"],
  },
  effect: "write",
  middleware: ["session"],
  expose: { http: true, webmcp: true },
  async run({ input, request, context }: CapabilityRunArgs<SimulateInput>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const scenario = state.scenarios.find((s) => s.id === input.scenario);
    if (!scenario) {
      await io.log("scenario.simulate", `Unknown scenario ${input.scenario}`, startedAt, "error");
      return { result: "unknown_scenario" };
    }
    if (scenario.id === "main") {
      await io.log("scenario.simulate", "Refused to modify the observed timeline", startedAt, "error");
      return { result: "cannot_modify_main" };
    }
    if (scenario.actions.some((a) => a.mitigation === input.mitigation)) {
      await io.log("scenario.simulate", `${MITIGATIONS[input.mitigation].title} already simulated in ${scenario.name}`, startedAt, "error");
      return { result: "already_simulated" };
    }
    scenario.actions.push({ mitigation: input.mitigation, atMinute: state.clockMinute + input.delayMinutes });
    await io.save();
    const assessment = assessScenario(state, scenario);
    await io.log(
      "scenario.simulate",
      `Simulated “${MITIGATIONS[input.mitigation].title}” in ${scenario.name} — recovery ${assessment.recoveryAtClock ?? "not reached"}`,
      startedAt,
    );
    return { result: "ok", assessment };
  },
});
