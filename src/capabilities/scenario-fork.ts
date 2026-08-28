import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { openSession } from "../server/session-io.ts";

interface ForkInput {
  name: string;
  hypothesis: string;
  from: string;
}

export default defineCapability({
  title: "Fork a scenario",
  description:
    "Create a counterfactual timeline branching from the observed incident (or another fork). Give it a short name and the hypothesis it tests, then use scenario.simulate to try mitigations inside it.",
  input: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60, description: "Short label, e.g. 'Bypass price cache'." },
      hypothesis: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "What this timeline tests, e.g. 'Errors stop if pricing reads skip the new cache'.",
      },
      from: { type: "string", default: "main", maxLength: 32, description: "Parent scenario id. Default: main." },
    },
    required: ["name", "hypothesis"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      result: { type: "string", enum: ["ok", "unknown_parent", "too_many_scenarios"] },
      scenario: { type: "object" },
    },
    required: ["result"],
  },
  effect: "write",
  middleware: ["session"],
  expose: { http: true, webmcp: true },
  async run({ input, request, context }: CapabilityRunArgs<ForkInput>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const parent = state.scenarios.find((s) => s.id === input.from);
    if (!parent) {
      await io.log("scenario.fork", `Unknown parent ${input.from}`, startedAt, "error");
      return { result: "unknown_parent" };
    }
    if (state.scenarios.length >= 7) {
      await io.log("scenario.fork", "Scenario limit reached", startedAt, "error");
      return { result: "too_many_scenarios" };
    }
    const scenario = {
      id: `s-${state.seq++}`,
      name: input.name,
      parent: parent.id,
      hypothesis: input.hypothesis,
      actions: [...parent.actions],
    };
    state.scenarios.push(scenario);
    await io.save();
    await io.log("scenario.fork", `Forked “${input.name}” from ${parent.id === "main" ? "the observed timeline" : parent.name}`, startedAt);
    return { result: "ok", scenario };
  },
});
