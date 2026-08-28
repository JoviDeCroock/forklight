import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { MITIGATIONS, type StagedMitigation } from "../server/incident.ts";
import { openSession } from "../server/session-io.ts";

interface StageInput {
  scenario: string;
  rationale: string;
  evidence: string[];
}

export default defineCapability({
  title: "Stage a mitigation",
  description:
    "Turn a simulated scenario into a visible proposal for human review: the scenario's mitigation, your rationale, and evidence references. Staging changes nothing in production — a person applies or dismisses it in the page.",
  input: {
    type: "object",
    properties: {
      scenario: { type: "string", maxLength: 32, description: "Forked scenario whose latest simulated action to stage." },
      rationale: {
        type: "string",
        minLength: 1,
        maxLength: 280,
        description: "Why this is the safest option, in the reviewer's language.",
      },
      evidence: {
        type: "array",
        items: { type: "string", maxLength: 120 },
        description: "Evidence references, e.g. 'web_error_rate 14:05–14:32' or a log line fingerprint.",
      },
    },
    required: ["scenario", "rationale"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      result: { type: "string", enum: ["ok", "unknown_scenario", "nothing_simulated"] },
      staged: { type: "object" },
    },
    required: ["result"],
  },
  effect: "write",
  middleware: ["session"],
  expose: { http: true, webmcp: true },
  async run({ input, request, context }: CapabilityRunArgs<StageInput>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const scenario = state.scenarios.find((s) => s.id === input.scenario);
    if (!scenario) {
      await io.log("mitigation.stage", `Unknown scenario ${input.scenario}`, startedAt, "error");
      return { result: "unknown_scenario" };
    }
    const last = scenario.actions[scenario.actions.length - 1];
    if (!last) {
      await io.log("mitigation.stage", `Nothing simulated in ${scenario.name}`, startedAt, "error");
      return { result: "nothing_simulated" };
    }
    for (const existing of state.staged) {
      if (existing.status === "staged") existing.status = "dismissed";
    }
    const staged: StagedMitigation = {
      id: `p-${state.seq++}`,
      scenarioId: scenario.id,
      mitigation: last.mitigation,
      rationale: input.rationale,
      evidence: input.evidence ?? [],
      status: "staged",
      stagedVia: io.transport === "webmcp" ? "webmcp" : "http",
    };
    state.staged.push(staged);
    await io.save();
    await io.log(
      "mitigation.stage",
      `Staged “${MITIGATIONS[last.mitigation].title}” from ${scenario.name} for human review`,
      startedAt,
    );
    return { result: "ok", staged };
  },
});
